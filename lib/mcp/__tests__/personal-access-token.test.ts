/** @jest-environment node */

jest.mock('@/lib/prisma', () => ({ prisma: { mcpPersonalAccessToken: { findUnique: jest.fn(), update: jest.fn() } } }))
import { prisma } from '@/lib/prisma'

import {
  createMcpPersonalAccessTokenSecret,
  hashMcpPersonalAccessToken,
  mcpTokenPrefix,
  normalizeMcpDeviceScopes,
  validateMcpPersonalAccessToken,
} from '../personal-access-token'

describe('MCP personal-access-token primitives', () => {
  it('creates opaque secrets and persists only a deterministic digest', () => {
    const token = createMcpPersonalAccessTokenSecret()
    expect(token).toMatch(/^novo_mcp_[A-Za-z0-9_-]{40,}$/)
    expect(hashMcpPersonalAccessToken(token)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashMcpPersonalAccessToken(token)).toBe(hashMcpPersonalAccessToken(token))
    expect(mcpTokenPrefix(token)).not.toContain(token.slice(17))
  })

  it('keeps device tokens task-scoped and always grants read before write', () => {
    expect(normalizeMcpDeviceScopes([])).toEqual(['tasks:read', 'goals:read', 'recommendations:read'])
    expect(normalizeMcpDeviceScopes(['calendar:write', 'tasks:write'])).toEqual(['tasks:read', 'goals:read', 'recommendations:read', 'tasks:write', 'recommendations:update', 'activity:write'])
  })

  it('grants native activity capture only when explicitly requested and never couples it to task writes', () => {
    const captureScopes = normalizeMcpDeviceScopes(['device:activity:write'])
    expect(captureScopes).toContain('device:activity:write')
    expect(captureScopes).not.toContain('tasks:write')
    expect(normalizeMcpDeviceScopes(['tasks:write'])).not.toContain('device:activity:write')
  })

  it('preserves explicit Companion connection and chat scopes without granting task writes', () => {
    const scopes = normalizeMcpDeviceScopes(['device:connect', 'ai:chat'])
    expect(scopes).toContain('device:connect')
    expect(scopes).toContain('ai:chat')
    expect(scopes).not.toContain('tasks:write')
    expect(scopes).not.toContain('device:activity:write')
  })
  it('preserves project and execution permission only when explicitly requested',()=>{
    expect(normalizeMcpDeviceScopes(['device:connect','ai:chat'])).not.toContain('device:work:execute')
    expect(normalizeMcpDeviceScopes(['projects:read','device:work:read','device:work:execute'])).toEqual(expect.arrayContaining(['projects:read','device:work:read','device:work:execute']))
  })
})

describe('personal token authorization and usage audit', () => {
  const token = 'novo_mcp_012345678901234567890123456789012345'
  const now = new Date('2026-10-20T12:00:00Z')
  const record = { id: 'token-id', userId: 'owner', scopes: ['device:connect'], revokedAt: null, expiresAt: new Date('2026-10-21'), lastUsedAt: null }
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers().setSystemTime(now)
    ;(prisma.mcpPersonalAccessToken.findUnique as jest.Mock).mockResolvedValue(record)
    ;(prisma.mcpPersonalAccessToken.update as jest.Mock).mockResolvedValue({ id: record.id })
  })
  afterEach(() => jest.useRealTimers())
  it('does not rewrite a recently used token, but rechecks revocation on every request', async () => {
    ;(prisma.mcpPersonalAccessToken.findUnique as jest.Mock).mockResolvedValueOnce({ ...record, lastUsedAt: new Date('2026-10-20T11:59:00Z') }).mockResolvedValueOnce({ ...record, revokedAt: now })
    expect((await validateMcpPersonalAccessToken(token)).ok).toBe(true)
    expect(await validateMcpPersonalAccessToken(token)).toEqual({ ok: false })
    expect(prisma.mcpPersonalAccessToken.findUnique).toHaveBeenCalledTimes(2)
    expect(prisma.mcpPersonalAccessToken.update).not.toHaveBeenCalled()
  })
  it.each([null, new Date('2026-10-20T11:55:00Z')])('records first use or use after five minutes (%s) without returning the token row', async lastUsedAt => {
    ;(prisma.mcpPersonalAccessToken.findUnique as jest.Mock).mockResolvedValue({ ...record, lastUsedAt })
    expect((await validateMcpPersonalAccessToken(token)).ok).toBe(true)
    expect(prisma.mcpPersonalAccessToken.update).toHaveBeenCalledWith({ where: { id: 'token-id' }, data: { lastUsedAt: now }, select: { id: true } })
  })
  it('rejects expired credentials without touching their audit timestamp', async () => {
    ;(prisma.mcpPersonalAccessToken.findUnique as jest.Mock).mockResolvedValue({ ...record, expiresAt: now })
    expect(await validateMcpPersonalAccessToken(token)).toEqual({ ok: false })
    expect(prisma.mcpPersonalAccessToken.update).not.toHaveBeenCalled()
  })
})
