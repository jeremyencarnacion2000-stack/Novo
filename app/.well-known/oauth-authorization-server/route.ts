import { NextResponse } from 'next/server'
import { getIssuer } from '@/lib/mcp/resource'
import { OAUTH_ROUTES } from '@/lib/mcp/oidc-provider'
import { MCP_SCOPES } from '@/lib/mcp/scopes'

// RFC8414 OAuth 2.0 Authorization Server Metadata. Hand-written rather than
// proxied through oidc-provider: oidc-provider's own well-known routes are
// fixed at its Koa app root and aren't remappable to live under /api/oauth/*
// alongside its other endpoints, and the MCP spec only requires "at least
// one of" RFC8414 or OIDC discovery — this alone satisfies that, so OIDC
// discovery (which we don't otherwise need; no id_token/userinfo flow here)
// is skipped.
export async function GET() {
  const issuer = getIssuer()

  return NextResponse.json({
    issuer,
    authorization_endpoint: `${issuer}${OAUTH_ROUTES.authorization}`,
    token_endpoint: `${issuer}${OAUTH_ROUTES.token}`,
    registration_endpoint: `${issuer}${OAUTH_ROUTES.registration}`,
    revocation_endpoint: `${issuer}${OAUTH_ROUTES.revocation}`,
    jwks_uri: `${issuer}${OAUTH_ROUTES.jwks}`,
    scopes_supported: MCP_SCOPES,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
  })
}
