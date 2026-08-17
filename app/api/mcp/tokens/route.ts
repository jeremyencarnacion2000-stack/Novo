import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { issueMcpPersonalAccessToken } from '@/lib/mcp/personal-access-token'

const issueSchema = z.object({
  name: z.string().trim().min(1).max(60),
  allowTaskWrites: z.boolean().default(false),
  allowTwinRead: z.boolean().default(false),
  allowIntegrationSync: z.boolean().default(false),
  expiresInDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
})

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
  } catch (error) {
    console.error('[mcp/tokens GET]', error)
    return NextResponse.json({ error: 'Device token service is temporarily unavailable.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = requireUserId(await getServerSession(authOptions))
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = issueSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid token request' }, { status: 400 })

    const activeCount = await prisma.mcpPersonalAccessToken.count({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    })
    if (activeCount >= 10) return NextResponse.json({ error: 'Revoke an existing device token before creating another one.' }, { status: 409 })

    const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
    const scopes = ['tasks:read']
    if (parsed.data.allowTaskWrites) scopes.push('tasks:write')
    if (parsed.data.allowTwinRead) scopes.push('twin:read')
    if (parsed.data.allowIntegrationSync) scopes.push('integrations:read', 'integrations:write')
    const { record, token } = await issueMcpPersonalAccessToken({ userId, name: parsed.data.name, scopes, expiresAt })

    // The raw token is intentionally returned exactly once. All subsequent
    // listings use the non-secret prefix only.
    return NextResponse.json({ token, record: {
      id: record.id, name: record.name, tokenPrefix: record.tokenPrefix,
      scopes: record.scopes, expiresAt: record.expiresAt, createdAt: record.createdAt,
    } }, { status: 201 })
  } catch (error) {
    console.error('[mcp/tokens POST]', error)
    return NextResponse.json({ error: 'Device token service is temporarily unavailable.' }, { status: 503 })
  }
}
