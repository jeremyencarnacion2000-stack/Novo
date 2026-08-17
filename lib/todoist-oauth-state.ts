import crypto from 'node:crypto'

export const INTEGRATION_OAUTH_STATE_TTL_MS = 10 * 60 * 1000
export const TODOIST_OAUTH_STATE_TTL_MS = INTEGRATION_OAUTH_STATE_TTL_MS
export type IntegrationOAuthProvider = 'todoist' | 'notion' | 'slack'
export type IntegrationOAuthPayload = { nonce: string; userId: string; issuedAt: number; provider: IntegrationOAuthProvider }
export type TodoistOAuthPayload = IntegrationOAuthPayload & { provider: 'todoist' }

function secret(): string {
  const value = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  if (value) return value
  if (process.env.NODE_ENV === 'test' || process.env.NOVO_TEST_MODE === '1') return 'novo-test-secret'
  throw new Error('OAuth signing secret is not configured')
}
export function createIntegrationOAuthState(userId: string, provider: IntegrationOAuthProvider): string {
  const payload: IntegrationOAuthPayload = { nonce: crypto.randomBytes(32).toString('base64url'), userId, provider, issuedAt: Date.now() }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', secret()).update(body).digest('base64url')}`
}
export function createTodoistOAuthState(userId: string): string {
  return createIntegrationOAuthState(userId, 'todoist')
}
export function parseIntegrationOAuthState(value: string | null, provider?: IntegrationOAuthProvider): IntegrationOAuthPayload | null {
  if (!value) return null
  const parts = value.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  if (!body || !sig) return null
  try {
    const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as IntegrationOAuthPayload
    if ((provider && p.provider !== provider) || !['todoist', 'notion', 'slack'].includes(p.provider) || typeof p.nonce !== 'string' || !/^[A-Za-z0-9_-]{32,}$/.test(p.nonce) || typeof p.userId !== 'string' || !p.userId || !Number.isFinite(p.issuedAt)) return null
    if (Date.now() - p.issuedAt > INTEGRATION_OAUTH_STATE_TTL_MS || p.issuedAt - Date.now() > 30_000) return null
    return p
  } catch { return null }
}
export function parseTodoistOAuthState(value: string | null): TodoistOAuthPayload | null {
  return parseIntegrationOAuthState(value, 'todoist') as TodoistOAuthPayload | null
}
export function verifyTodoistOAuthState(value: string | null, expectedUserId: string): boolean {
  const p = parseTodoistOAuthState(value)
  return !!p && p.userId === expectedUserId
}
export function hashOAuthNonce(nonce: string): string { return crypto.createHash('sha256').update(nonce).digest('hex') }
export function hashTodoistNonce(nonce: string): string { return hashOAuthNonce(nonce) }
