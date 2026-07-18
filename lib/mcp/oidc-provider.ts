import Provider, { errors } from 'oidc-provider'
import { oidcAdapterFactory } from './oidc-adapter'
import { getIssuer, getMcpResourceUri } from './resource'
import { MCP_SCOPES } from './scopes'

// oidc-provider mount paths, all namespaced under /api/oauth/* so they live
// behind pages/api/oauth/[...oidc].ts (a Pages Router catch-all — oidc-provider
// is a Koa app that needs real Node http.IncomingMessage/ServerResponse, which
// only Pages Router API routes give you in this Next.js version; App Router
// route handlers only see the Web Request/Response, which is otherwise the
// better fit and is exactly what the MCP endpoint itself uses instead, see
// app/api/mcp/route.ts). The two `.well-known/*` discovery documents are
// NOT served through here — oidc-provider's well-known routes are fixed at
// Koa-root and not remappable, so they're hand-written static JSON at
// app/.well-known/*/route.ts instead, sourced from these same route strings.
export const OAUTH_ROUTES = {
  authorization: '/api/oauth/authorize',
  token: '/api/oauth/token',
  registration: '/api/oauth/register',
  revocation: '/api/oauth/revoke',
  jwks: '/api/oauth/jwks',
  userinfo: '/api/oauth/userinfo',
  introspection: '/api/oauth/introspect',
  end_session: '/api/oauth/session/end',
  device_authorization: '/api/oauth/device/auth',
  code_verification: '/api/oauth/device',
  pushed_authorization_request: '/api/oauth/par',
  backchannel_authentication: '/api/oauth/backchannel',
}

let provider: Provider | undefined

// Singleton — module-level cache. On Vercel each serverless function gets
// its own module instance anyway, so this only saves repeated construction
// within one warm invocation; all real state lives in Postgres via the
// adapter, never in this in-memory object.
export function getOidcProvider(): Provider {
  if (provider) return provider

  const issuer = getIssuer()
  const resource = getMcpResourceUri()

  provider = new Provider(issuer, {
    adapter: oidcAdapterFactory,
    // Dynamic Client Registration only — no pre-registered clients. DCR is
    // what real MCP clients (Claude Desktop/Code) support today; the newer
    // Client ID Metadata Documents mechanism the spec now prefers isn't yet
    // broadly implemented by them, so DCR is the pragmatic choice for actual
    // interop (see report for the version-sensitivity note on this).
    clients: [],
    scopes: MCP_SCOPES,
    claims: {},
    // OAuth 2.1: PKCE is mandatory for every client, not just public ones.
    pkce: { required: () => true },
    routes: OAUTH_ROUTES,
    clientDefaults: {
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      // MCP clients are typically native/desktop apps that can't keep a
      // secret; PKCE is what actually secures the code exchange. Clients
      // that want confidential auth can still request another method during
      // DCR — this is only the default when they don't specify one.
      token_endpoint_auth_method: 'none',
    },
    features: {
      devInteractions: { enabled: false }, // replaced by our own consent screen
      registration: { enabled: true, initialAccessToken: false },
      revocation: { enabled: true },
      resourceIndicators: {
        enabled: true,
        getResourceServerInfo: async (_ctx, resourceIndicator) => {
          if (resourceIndicator !== resource) {
            throw new errors.CustomOIDCProviderError(
              'invalid_target',
              'This authorization server only issues tokens for the Novo MCP resource.'
            )
          }
          return {
            scope: MCP_SCOPES.join(' '),
            audience: resource,
            accessTokenFormat: 'opaque',
            accessTokenTTL: 60 * 60, // 1 hour
          }
        },
        defaultResource: () => resource,
      },
    },
    // Refresh tokens follow the client's declared grant_types, not an
    // offline_access scope — the MCP spec explicitly says resource servers
    // SHOULD NOT expose offline_access, since refresh isn't a resource
    // requirement, but MCP clients (Claude Desktop/Code) still need
    // long-lived sessions without re-prompting the user every hour.
    issueRefreshToken: async (_ctx, client) => !!client.grantTypes?.includes('refresh_token'),
    ttl: {
      AccessToken: 60 * 60,
      RefreshToken: 60 * 60 * 24 * 30,
      AuthorizationCode: 60,
      Interaction: 60 * 15,
      Grant: 60 * 60 * 24 * 365,
      Session: 60 * 60 * 24 * 365,
    },
    interactions: {
      url: (_ctx, interaction) => `/oauth/consent/${interaction.uid}`,
    },
    // No real "account" beyond the Novo userId — tools/resources look up
    // real data straight from Prisma by userId, this is not used for id_token
    // claims (we don't run an openid-scope flow).
    findAccount: async (_ctx, sub) => ({
      accountId: sub,
      claims: async () => ({ sub }),
    }),
    cookies: {
      keys: [process.env.NEXTAUTH_SECRET || 'novo-oidc-dev-secret-change-me'],
    },
  })

  // Trust Vercel's proxy (x-forwarded-proto/host) so oidc-provider computes
  // https:// URLs correctly behind the platform's load balancer.
  provider.proxy = true

  return provider
}
