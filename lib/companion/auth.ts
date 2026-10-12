import { validateMcpBearerToken } from '@/lib/mcp/auth'

/** Server-only identity. Never serialize this principal to the native UI. */
export type CompanionOAuthPrincipal = {
  userId: string
  clientId: string
  grantId: string
  scopes: ReadonlySet<string>
  expiresAt: number
}

export class CompanionError extends Error {
  constructor(public readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 503, public readonly code: string) {
    super(code)
    this.name = 'CompanionError'
  }
}

export async function requireCompanionOAuth(request: Request, requiredScopes: readonly string[]): Promise<CompanionOAuthPrincipal> {
  try {
    const validated = await validateMcpBearerToken(request)
    if (!validated.ok) throw new CompanionError(validated.status, 'unauthorized')
    const {clientId, expiresAt} = validated.authInfo
    if (!clientId || typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)
      || expiresAt <= Math.floor(Date.now() / 1000)) throw new CompanionError(401, 'unauthorized')
    const scopes = new Set(validated.authInfo.scopes)
    if (requiredScopes.some(scope => !scopes.has(scope))) throw new CompanionError(403, 'permission_required')

    // Personal tokens are already bound to an account and carry explicit
    // Companion scopes. A synthetic grant identity lets the existing device
    // registry bind them without pretending an OIDC grant exists.
    if (validated.kind === 'pat') {
      if (!validated.tokenId || !validated.userId) throw new CompanionError(401, 'unauthorized')
      return {userId:validated.userId, clientId, grantId:`pat:${validated.tokenId}`, scopes, expiresAt}
    }
    if (!validated.grantId) throw new CompanionError(401, 'unauthorized')

    // AccessToken.isValid only proves the token model's lifetime. Confirm its
    // persisted grant still exists and belongs to this account AND this client.
    const {getOidcProvider} = await import('@/lib/mcp/oidc-provider')
    const grant = await getOidcProvider().Grant.find(validated.grantId)
    if (!grant?.isValid || grant.accountId !== validated.userId || grant.clientId !== clientId) {
      throw new CompanionError(401, 'unauthorized')
    }
    return {userId:validated.userId, clientId, grantId:validated.grantId, scopes, expiresAt}
  } catch (error) {
    if (error instanceof CompanionError) throw error
    // No token, adapter exception, connection string or upstream body escapes.
    throw new CompanionError(503, 'authorization_unavailable')
  }
}
