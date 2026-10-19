import { prisma } from '@/lib/prisma'

export type GoogleAccountCandidate = {
  id: string
  access_token: string | null
  refresh_token: string | null
  expires_at: number | null
  scope: string | null
}

export function toGoogleOAuthCredentials(account: GoogleAccountCandidate) {
  return {
    access_token: account.access_token ?? undefined,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  }
}

function normalizeScope(scope: string): string {
  return scope
    .trim()
    .replace(/^https:\/\/www\.googleapis\.com\/auth\//, '')
    .replace(/^https:\/\//, '')
    .replace(/\/$/, '')
}

const GOOGLE_IDENTITY_SCOPES = new Set([
  'openid',
  'email',
  'profile',
  'userinfo.email',
  'userinfo.profile',
])

/**
 * A plain Google login only carries identity scopes. It must not replace an
 * existing connector grant (Gmail, Calendar, Drive, ...), because that would
 * leave the database claiming a capability that the newly stored token cannot
 * actually use. Connector-specific grants are allowed to replace/extend it.
 */
export function shouldPersistGoogleGrant(existingScope: string | null | undefined, incomingScope: string | null | undefined): boolean {
  if (!existingScope) return true
  const incoming = (incomingScope ?? '').split(/\s+/).filter(Boolean).map(normalizeScope)
  const existing = existingScope.split(/\s+/).filter(Boolean).map(normalizeScope)
  const existingHasConnectorScope = existing.some((scope) => !GOOGLE_IDENTITY_SCOPES.has(scope))
  const incomingHasConnectorScope = incoming.some((scope) => !GOOGLE_IDENTITY_SCOPES.has(scope))
  return !existingHasConnectorScope || incomingHasConnectorScope
}

/**
 * Tests an OAuth scope without relying on substring matching. Accounts may
 * store either Google's full URL or the short scope suffix.
 */
export function hasGoogleScopes(scopeValue: string | null | undefined, requiredScopes: string[]): boolean {
  const granted = new Set((scopeValue ?? '').split(/\s+/).filter(Boolean).map(normalizeScope))
  return requiredScopes.every((required) => {
    const normalized = normalizeScope(required)
    if (granted.has(normalized) || (normalized.startsWith('gmail.') && granted.has('mail.google.com'))) return true
    if (normalized === 'gmail.readonly') return granted.has('gmail.modify')
    if (normalized === 'gmail.send') return granted.has('gmail.modify') || granted.has('gmail.compose')
    return false
  })
}

/**
 * A user can have more than one Google Account row after incremental consent.
 * Always select the one that actually has the requested capability; selecting
 * the first row is unsafe because it can be the basic sign-in-only grant.
 */
export async function findGoogleAccountForScopes(
  userId: string,
  requiredScopes: string[] = [],
): Promise<GoogleAccountCandidate | null> {
  const accounts = await prisma.account.findMany({
    where: { userId, provider: 'google' },
    select: { id: true, access_token: true, refresh_token: true, expires_at: true, scope: true },
    orderBy: { expires_at: 'desc' },
  })

  const eligible = accounts.filter((account) =>
    Boolean(account.access_token || account.refresh_token) && hasGoogleScopes(account.scope, requiredScopes),
  )
  if (eligible.length === 0) return null

  const now = Math.floor(Date.now() / 1000)
  eligible.sort((left, right) => {
    const leftUsable = Boolean(left.access_token) && (!left.expires_at || left.expires_at > now + 60)
    const rightUsable = Boolean(right.access_token) && (!right.expires_at || right.expires_at > now + 60)
    if (leftUsable !== rightUsable) return leftUsable ? -1 : 1
    const leftRefreshable = Boolean(left.refresh_token)
    const rightRefreshable = Boolean(right.refresh_token)
    if (leftRefreshable !== rightRefreshable) return leftRefreshable ? -1 : 1
    return (right.expires_at ?? 0) - (left.expires_at ?? 0)
  })

  return eligible[0] ?? null
}
