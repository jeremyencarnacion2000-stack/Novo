import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { issueMcpPersonalAccessToken } from '@/lib/mcp/personal-access-token'
import { withProviderSyncLock } from '@/lib/provider-sync-lock'

const issueSchema = z.object({
  name: z.string().trim().min(1).max(60),
  allowTaskWrites: z.boolean().default(false),
  allowDeviceActivity: z.boolean().default(false),
  allowTwinRead: z.boolean().default(false),
  allowProjectsRead: z.boolean().default(false),
  allowIntegrationRead: z.boolean().default(false),
  allowIntegrationSync: z.boolean().default(false),
  allowCompanion: z.boolean().default(false),
  allowWorkContext: z.boolean().default(false),
  allowWorkExecution:z.boolean().default(false),
  expiresInDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
}).strict().refine(input=>(!input.allowWorkExecution && !input.allowWorkContext)||input.allowCompanion,{message:'Companion consent required'})

function requireUserId(session: { user?: { id?: string | null } } | null): string | null {
  return session?.user?.id ?? null
}

export async function GET() {
  try {
    const userId = requireUserId(await getServerSession(authOptions))
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tokens = await prisma.mcpPersonalAccessToken.findMany({
      where: { userId },
      select: {
        id: true, name: true, tokenPrefix: true, scopes: true, expiresAt: true,
        lastUsedAt: true, revokedAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ tokens })
  } catch {
    console.error('[mcp/tokens GET] Request failed.')
    return NextResponse.json({ error: 'Device token service is temporarily unavailable.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = requireUserId(await getServerSession(authOptions))
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = issueSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid token request' }, { status: 400 })

    const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
    const scopes = ['tasks:read']
    if (parsed.data.allowTaskWrites) scopes.push('tasks:write')
    if (parsed.data.allowDeviceActivity) scopes.push('device:activity:write')
    if (parsed.data.allowTwinRead) scopes.push('twin:read')
    if (parsed.data.allowProjectsRead) scopes.push('projects:read')
    if (parsed.data.allowIntegrationRead) scopes.push('integrations:read')
    if (parsed.data.allowIntegrationSync) scopes.push('integrations:read', 'integrations:write')
    if (parsed.data.allowCompanion) scopes.push('device:connect', 'ai:chat')
    if (parsed.data.allowWorkContext) scopes.push('projects:read', 'device:work-context:read', 'device:work-context:write')
    if(parsed.data.allowWorkExecution)scopes.push('projects:read','device:work:read','device:work:execute','device:work-context:read','device:work-context:write')
    // Count and insert under the same advisory lock. Without this, two device
    // requests arriving together can both observe nine active tokens and issue
    // an eleventh one, bypassing the product limit.
    const result = await withProviderSyncLock(prisma, `novo:mcp-tokens:${userId}`, async (tx) => {
      const activeCount = await tx.mcpPersonalAccessToken.count({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      })
      if (activeCount >= 10) return { limitReached: true as const }
      const issued = await issueMcpPersonalAccessToken({ userId, name: parsed.data.name, scopes, expiresAt }, tx)
      return { limitReached: false as const, ...issued }
    })
    if (result.limitReached) return NextResponse.json({ error: 'Revoke an existing device token before creating another one.' }, { status: 409 })
    const { record, token } = result

    // The raw token is intentionally returned exactly once. All subsequent
    // listings use the non-secret prefix only.
    return NextResponse.json({ token, record: {
      id: record.id, name: record.name, tokenPrefix: record.tokenPrefix,
      scopes: record.scopes, expiresAt: record.expiresAt, createdAt: record.createdAt,
    } }, { status: 201 })
  } catch {
    console.error('[mcp/tokens POST] Request failed.')
    return NextResponse.json({ error: 'Device token service is temporarily unavailable.' }, { status: 503 })
  }
}
