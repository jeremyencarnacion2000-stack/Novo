import { createHmac, randomBytes } from 'node:crypto'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { prisma } from '@/lib/prisma'

export const MCP_DEVICE_SCOPES = [
  'tasks:read', 'tasks:write', 'goals:read', 'recommendations:read',
  'recommendations:update', 'activity:write',
] as const
export type McpDeviceScope = (typeof MCP_DEVICE_SCOPES)[number]

function tokenPepper(): string {
  const configured = process.env.MCP_TOKEN_PEPPER || process.env.NEXTAUTH_SECRET
  if (configured) return configured

  // Tests and local prototypes can exercise the implementation without
  // embedding a production secret. Production must explicitly configure one.
  if (process.env.NODE_ENV !== 'production') return 'novo-local-mcp-token-pepper'
  throw new Error('MCP_TOKEN_PEPPER or NEXTAUTH_SECRET must be configured in production')
}

export function hashMcpPersonalAccessToken(token: string): string {
  return createHmac('sha256', tokenPepper()).update(token).digest('hex')
}

export function normalizeMcpDeviceScopes(scopes: readonly string[]): McpDeviceScope[] {
  const requested = new Set(scopes)
  const normalized: McpDeviceScope[] = ['tasks:read', 'goals:read', 'recommendations:read']
  if (requested.has('tasks:write')) {
    normalized.push('tasks:write', 'recommendations:update', 'activity:write')
  }
  return normalized
}

export function createMcpPersonalAccessTokenSecret(): string {
  return `novo_mcp_${randomBytes(32).toString('base64url')}`
}

export function mcpTokenPrefix(token: string): string {
  return token.slice(0, 17)
}

export async function issueMcpPersonalAccessToken(input: {
  userId: string
  name: string
  scopes: readonly string[]
  expiresAt: Date
}) {
  const token = createMcpPersonalAccessTokenSecret()
  const scopes = normalizeMcpDeviceScopes(input.scopes)
  const record = await prisma.mcpPersonalAccessToken.create({
    data: {
      userId: input.userId,
      name: input.name.trim(),
      tokenPrefix: mcpTokenPrefix(token),
      tokenHash: hashMcpPersonalAccessToken(token),
      scopes,
      expiresAt: input.expiresAt,
    },
  })

  return { record, token }
}

export async function validateMcpPersonalAccessToken(token: string): Promise<
  | { ok: true; userId: string; authInfo: AuthInfo; tokenId: string }
  | { ok: false }
> {
  if (!token.startsWith('novo_mcp_') || token.length < 30) return { ok: false }

  const record = await prisma.mcpPersonalAccessToken.findUnique({
    where: { tokenHash: hashMcpPersonalAccessToken(token) },
    select: {
      id: true,
      userId: true,
      scopes: true,
      expiresAt: true,
      revokedAt: true,
    },
  })

  if (!record || record.revokedAt || !record.expiresAt || record.expiresAt <= new Date()) return { ok: false }

  await prisma.mcpPersonalAccessToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  })

  return {
    ok: true,
    userId: record.userId,
    tokenId: record.id,
    authInfo: {
      token,
      clientId: `novo-device:${record.id}`,
      scopes: record.scopes,
      expiresAt: Math.floor(record.expiresAt.getTime() / 1000),
    },
  }
}
