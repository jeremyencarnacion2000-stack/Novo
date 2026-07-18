/**
 * @jest-environment node
 *
 * Focused verification for the two security-critical properties the MCP
 * resource-server auth layer must have:
 *  1. A request to /api/mcp with no Bearer token is rejected with 401 and a
 *     correctly-formed WWW-Authenticate header (RFC9728 discovery pointer).
 *  2. A token that is otherwise perfectly valid (real accountId, not
 *     expired/revoked) but was issued for a DIFFERENT resource/audience is
 *     still rejected — i.e. audience binding is actually enforced, not just
 *     "a token is present" checking.
 */
const TEST_ISSUER = 'https://novo.test'

jest.mock('@/lib/mcp/resource', () => ({
  getIssuer: () => 'https://novo.test',
  getMcpResourceUri: () => 'https://novo.test/api/mcp',
}))

describe('validateMcpBearerToken', () => {
  afterEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('rejects a request with no Authorization header', async () => {
    jest.doMock('@/lib/mcp/oidc-provider', () => ({
      getOidcProvider: jest.fn(),
    }))
    const { validateMcpBearerToken } = await import('../auth')
    const result = await validateMcpBearerToken(new Request('http://localhost/api/mcp'))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error).toBe('invalid_request')
    }
  })

  it('rejects a token whose audience is a DIFFERENT resource server (audience binding enforced)', async () => {
    const find = jest.fn().mockResolvedValue({
      isValid: true,
      accountId: 'user-1',
      aud: 'https://some-other-app.example/mcp', // NOT this server's resource URI
      clientId: 'client-1',
      scopes: new Set(['tasks:read']),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
    jest.doMock('@/lib/mcp/oidc-provider', () => ({
      getOidcProvider: () => ({ AccessToken: { find } }),
    }))
    const { validateMcpBearerToken } = await import('../auth')
    const result = await validateMcpBearerToken(
      new Request('http://localhost/api/mcp', { headers: { authorization: 'Bearer some-opaque-token' } })
    )

    expect(find).toHaveBeenCalledWith('some-opaque-token')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error).toBe('invalid_token')
      expect(result.description).toMatch(/audience/i)
    }
  })

  it('accepts a token correctly bound to THIS resource server (positive control)', async () => {
    const find = jest.fn().mockResolvedValue({
      isValid: true,
      accountId: 'user-1',
      aud: `${TEST_ISSUER}/api/mcp`, // matches getMcpResourceUri()
      clientId: 'client-1',
      scopes: new Set(['tasks:read', 'tasks:write']),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
    jest.doMock('@/lib/mcp/oidc-provider', () => ({
      getOidcProvider: () => ({ AccessToken: { find } }),
    }))
    const { validateMcpBearerToken } = await import('../auth')
    const result = await validateMcpBearerToken(
      new Request('http://localhost/api/mcp', { headers: { authorization: 'Bearer good-token' } })
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.userId).toBe('user-1')
      expect(result.authInfo.scopes.sort()).toEqual(['tasks:read', 'tasks:write'])
    }
  })
})

describe('GET /api/mcp (no token)', () => {
  it('returns 401 with a spec-shaped WWW-Authenticate header', async () => {
    jest.doMock('@/lib/mcp/oidc-provider', () => ({
      getOidcProvider: jest.fn(() => {
        throw new Error('should not be constructed for an unauthenticated request')
      }),
    }))
    // route.ts pulls in the day-plan generator (for the generate_day_plan
    // tool) which in turn requires OPENROUTER_API_KEY at import time — not
    // relevant to this auth-gating test, so stub it out.
    jest.doMock('@/lib/ai/day-plan-generator', () => ({ generateAndExecuteDayPlan: jest.fn() }))
    const { GET } = await import('../../../app/api/mcp/route')
    const res = await GET(new Request('http://localhost/api/mcp'))

    expect(res.status).toBe(401)
    const wwwAuth = res.headers.get('WWW-Authenticate') || ''
    expect(wwwAuth).toMatch(/^Bearer /)
    expect(wwwAuth).toMatch(/resource_metadata="/)
    expect(wwwAuth).toContain('/.well-known/oauth-protected-resource')
  })
})
