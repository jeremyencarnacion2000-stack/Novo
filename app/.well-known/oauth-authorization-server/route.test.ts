jest.mock('@/lib/mcp/oidc-provider', () => ({
  OAUTH_ROUTES: {
    authorization: '/api/oauth/authorize',
    token: '/api/oauth/token',
    registration: '/api/oauth/register',
    revocation: '/api/oauth/revoke',
    jwks: '/api/oauth/jwks',
    device_authorization: '/api/oauth/device/auth',
  },
}))
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers as Record<string, string> | undefined) },
    }),
  },
}))

import { GET } from './route'

describe('OAuth authorization server metadata', () => {
  it('advertises the device authorization grant for desktop sign-in', async () => {
    const response = await GET()
    const metadata = await response.json()

    expect(metadata.device_authorization_endpoint).toMatch(/\/api\/oauth\/device\/auth$/)
    expect(metadata.grant_types_supported).toContain('urn:ietf:params:oauth:grant-type:device_code')
    expect(metadata.grant_types_supported).toContain('refresh_token')
    expect(metadata.scopes_supported).toContain('device:activity:write')
    expect(metadata.scopes_supported).toContain('integrations:read')
    expect(metadata.scopes_supported).toContain('twin:read')
  })
})
