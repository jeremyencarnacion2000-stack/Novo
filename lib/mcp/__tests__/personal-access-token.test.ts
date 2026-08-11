/** @jest-environment node */

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
})
