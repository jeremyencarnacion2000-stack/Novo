import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { getIssuer, getMcpResourceUri } from './resource'
import { validateMcpPersonalAccessToken } from './personal-access-token'

export type McpAuthResult =
  | { ok: true; userId: string; authInfo: AuthInfo }
  | { ok: false; status: 401 | 403; error: string; description: string }

// Validates the Bearer token on an incoming /api/mcp request. Novo is both
// the authorization server and the resource server, so this is a direct
// lookup against our own oidc-provider adapter storage (Postgres) rather
// than a remote introspection round trip — but the check that actually
// matters is the same either way: the token's `aud` (audience) MUST be
// bound to THIS resource server (RFC8707 / MCP spec "Token Handling"). A
// token that is otherwise perfectly valid but was issued for a different
// resource is rejected here, not just a token that's missing or malformed.
export async function validateMcpBearerToken(req: Request): Promise<McpAuthResult> {
  const header = req.headers.get('authorization') || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) {
    return { ok: false, status: 401, error: 'invalid_request', description: 'Missing Bearer token' }
  }
  const token = match[1]

  // Device tokens are deliberately checked before OIDC storage. They are
  // self-contained credentials managed by the user in Novo and carry only
  // their explicitly granted task scopes.
  const personalToken = await validateMcpPersonalAccessToken(token)
  if (personalToken.ok) {
    return {
      ok: true,
      userId: personalToken.userId,
      authInfo: personalToken.authInfo,
    }
  }
  if (token.startsWith('novo_mcp_')) {
    return { ok: false, status: 401, error: 'invalid_token', description: 'Device token is invalid, expired, or revoked' }
  }

  // Keep the OAuth provider lazy: a device-token request neither needs nor
  // initializes the heavier OIDC implementation.
  const { getOidcProvider } = await import('./oidc-provider')
  const provider = getOidcProvider()
  const accessToken = await provider.AccessToken.find(token)
  if (!accessToken || !accessToken.isValid || !accessToken.accountId) {
    return { ok: false, status: 401, error: 'invalid_token', description: 'Token is invalid, expired, or revoked' }
  }

  const resource = getMcpResourceUri()
  const aud = Array.isArray(accessToken.aud) ? accessToken.aud : [accessToken.aud].filter(Boolean)
  if (!aud.includes(resource)) {
    return {
      ok: false,
      status: 401,
      error: 'invalid_token',
      description: 'Token is not valid for this resource (audience mismatch)',
    }
  }

  return {
    ok: true,
    userId: accessToken.accountId,
    authInfo: {
      token,
      clientId: accessToken.clientId || '',
      scopes: Array.from(accessToken.scopes || []),
      expiresAt: accessToken.exp,
      resource: new URL(resource),
    },
  }
}

export function wwwAuthenticateHeader(error?: string, description?: string): string {
  const resourceMetadata = `${getIssuer()}/.well-known/oauth-protected-resource`
  const parts = [`resource_metadata="${resourceMetadata}"`]
  if (error) parts.push(`error="${error}"`)
  if (description) parts.push(`error_description="${description}"`)
  return `Bearer ${parts.join(', ')}`
}
