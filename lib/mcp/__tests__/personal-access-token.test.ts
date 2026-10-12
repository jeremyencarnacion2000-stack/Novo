/** @jest-environment node */

jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import {
  createMcpPersonalAccessTokenSecret,
  hashMcpPersonalAccessToken,
  mcpTokenPrefix,
  normalizeMcpDeviceScopes,
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
})
