import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncPlugin } from '@/lib/plugins/plugin-orchestrator'
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime'

const actionSchema = z.enum(['sync'])

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const account = await prisma.integrationAccount.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'github' } },
    select: { accessToken: true, metadata: true, createdAt: true, updatedAt: true, lastSyncedAt: true, lastSuccessfulSyncAt: true, syncStatus: true },
  })
  if (!account?.accessToken) return NextResponse.json({ connected: false })
  const metadata = metadataRecord(account.metadata)
  return NextResponse.json({
    connected: true,
    login: typeof metadata.login === 'string' ? metadata.login : null,
    repoCount: typeof metadata.repoCount === 'number' ? metadata.repoCount : null,
    syncStatus: account.syncStatus ?? 'connected',
    lastSyncedAt: account.lastSyncedAt,
    lastSuccessfulSyncAt: account.lastSuccessfulSyncAt,
    connectedAt: account.createdAt,
    updatedAt: account.updatedAt,
  })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const action = actionSchema.safeParse(new URL(request.url).searchParams.get('action') ?? 'sync')
  if (!action.success) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  const account = await prisma.integrationAccount.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'github' } },
    select: { accessToken: true },
  })
  if (!account?.accessToken) return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })

  try {
    const result = await syncPlugin(session.user.id, 'github')
    try {
      const ambient = await runAmbientTwinForUser(session.user.id, { trigger: 'sync' })
      return NextResponse.json({ success: true, result, planning: ambient.planning, recommendation: ambient.recommendation ? { id: ambient.recommendation.id, title: ambient.recommendation.title } : null })
    } catch {
      return NextResponse.json({ success: true, result, planning: 'pending' as const, recommendation: null })
    }
  } catch {
    return NextResponse.json({ error: 'github_sync_failed' }, { status: 502 })
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.integrationAccount.deleteMany({ where: { userId: session.user.id, provider: 'github' } })
  return NextResponse.json({ disconnected: true })
}
