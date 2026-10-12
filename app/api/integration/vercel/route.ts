import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decryptIntegrationCredential, encryptIntegrationCredential } from '@/lib/companion/credential-vault'
import { fetchVercelProjects, type VercelProjectOption } from '@/lib/companion/vercel'

export const dynamic = 'force-dynamic'

const connectSchema = z.object({
  accessToken: z.string().trim().min(1).max(2048),
  teamId: z.string().trim().min(1).max(128).optional(),
}).strict()

const selectionSchema = z.object({
  selectedProjectIds: z.array(z.string().min(1).max(128)).max(10),
}).strict()

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function readProjects(metadata: Record<string, unknown>): VercelProjectOption[] {
  if (!Array.isArray(metadata.projects)) return []
  return metadata.projects.flatMap((value) => {
    if (!value || typeof value !== 'object') return []
    const item = value as Record<string, unknown>
    if (typeof item.id !== 'string' || typeof item.name !== 'string') return []
    return [{ id: item.id.slice(0, 128), name: item.name.slice(0, 100) }]
  }).slice(0, 100)
}

async function ownerId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return session?.user?.id ?? null
}

export async function GET() {
  const userId = await ownerId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const account = await prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId, provider: 'vercel' } },
      select: { metadata: true, syncStatus: true, lastSuccessfulSyncAt: true },
    })
    if (!account) return NextResponse.json({ connected: false, projects: [], selectedProjectIds: [] }, { headers: { 'Cache-Control': 'no-store' } })

    const metadata = metadataRecord(account.metadata)
    const projects = readProjects(metadata)
    const projectIds = new Set(projects.map((project) => project.id))
    const selectedProjectIds = Array.isArray(metadata.selectedProjectIds)
      ? [...new Set(metadata.selectedProjectIds.filter((id): id is string => typeof id === 'string' && projectIds.has(id)))].slice(0, 10)
      : []

    return NextResponse.json({
      connected: true,
      teamId: typeof metadata.teamId === 'string' ? metadata.teamId : null,
      projects: projects.map((project) => ({ ...project, selected: selectedProjectIds.includes(project.id) })),
      selectedProjectIds,
      syncStatus: account.syncStatus ?? 'connected',
      lastSuccessfulSyncAt: account.lastSuccessfulSyncAt,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    console.error('[companion/vercel GET] Connection status unavailable.')
    return NextResponse.json({ error: 'vercel_connection_unavailable' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  const userId = await ownerId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = connectSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_vercel_connection' }, { status: 400 })

  let projects: VercelProjectOption[]
  try {
    // This token check is deliberately limited to the documented GET projects endpoint.
    projects = await fetchVercelProjects(parsed.data.accessToken, parsed.data.teamId)
  } catch (error) {
    const category = error instanceof Error ? error.message : 'provider_unavailable'
    if (category === 'provider_auth_required' || category === 'provider_permission_denied') {
      return NextResponse.json({ error: category }, { status: 400 })
    }
    console.error('[companion/vercel POST] Provider read failed.')
    return NextResponse.json({ error: category === 'provider_rate_limited' ? category : 'provider_unavailable' }, { status: 503 })
  }

  let encryptedToken: string
  try {
    encryptedToken = encryptIntegrationCredential(parsed.data.accessToken, { userId, provider: 'vercel' })
  } catch {
    return NextResponse.json({ error: 'credential_storage_unavailable' }, { status: 503 })
  }

  try {
    const existing = await prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId, provider: 'vercel' } },
      select: { metadata: true },
    })
    const existingMetadata = metadataRecord(existing?.metadata)
    const existingSelected = new Set(Array.isArray(existingMetadata.selectedProjectIds)
      ? existingMetadata.selectedProjectIds.filter((id): id is string => typeof id === 'string')
      : [])
    const availableIds = new Set(projects.map((project) => project.id))
    const selectedProjectIds = [...existingSelected].filter((id) => availableIds.has(id)).slice(0, 10)
    const metadata = { teamId: parsed.data.teamId ?? null, projects, selectedProjectIds }

    await prisma.integrationAccount.upsert({
      where: { userId_provider: { userId, provider: 'vercel' } },
      create: {
        userId,
        provider: 'vercel',
        accessToken: encryptedToken,
        tokenType: 'Bearer',
        scope: 'read:projects read:deployments',
        syncStatus: 'connected',
        metadata,
      },
      update: {
        accessToken: encryptedToken,
        tokenType: 'Bearer',
        scope: 'read:projects read:deployments',
        syncStatus: 'connected',
        syncErrorCode: null,
        syncErrorMessage: null,
        metadata,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ connected: true, projects, selectedProjectIds }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    console.error('[companion/vercel POST] Credential save failed.')
    return NextResponse.json({ error: 'vercel_connection_unavailable' }, { status: 503 })
  }
}

export async function PATCH(request: NextRequest) {
  const userId = await ownerId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = selectionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_project_selection' }, { status: 400 })

  try {
    const account = await prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId, provider: 'vercel' } },
      select: { metadata: true },
    })
    if (!account) return NextResponse.json({ error: 'vercel_not_connected' }, { status: 404 })

    const metadata = metadataRecord(account.metadata)
    const projects = readProjects(metadata)
    const validIds = new Set(projects.map((project) => project.id))
    if (parsed.data.selectedProjectIds.some((id) => !validIds.has(id))) {
      return NextResponse.json({ error: 'invalid_project_selection' }, { status: 400 })
    }
    const selectedProjectIds = [...new Set(parsed.data.selectedProjectIds)]
    await prisma.integrationAccount.update({
      where: { userId_provider: { userId, provider: 'vercel' } },
      data: { metadata: { ...metadata, selectedProjectIds }, updatedAt: new Date() },
    })
    return NextResponse.json({ selectedProjectIds }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    console.error('[companion/vercel PATCH] Project selection unavailable.')
    return NextResponse.json({ error: 'vercel_connection_unavailable' }, { status: 503 })
  }
}

export async function DELETE() {
  const userId = await ownerId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await prisma.integrationAccount.deleteMany({ where: { userId, provider: 'vercel' } })
    return NextResponse.json({ disconnected: true })
  } catch {
    console.error('[companion/vercel DELETE] Disconnect failed.')
    return NextResponse.json({ error: 'vercel_connection_unavailable' }, { status: 503 })
  }
}
