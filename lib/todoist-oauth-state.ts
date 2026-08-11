import crypto from 'node:crypto'

export const TODOIST_OAUTH_STATE_TTL_MS = 10 * 60 * 1000
export type TodoistOAuthPayload = { nonce: string; userId: string; issuedAt: number; provider: 'todoist' }

function secret(): string {
  const value = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  if (value) return value
  if (process.env.NODE_ENV === 'test' || process.env.NOVO_TEST_MODE === '1') return 'novo-test-secret'
  throw new Error('OAuth signing secret is not configured')
}
export function createTodoistOAuthState(userId: string): string {
  const payload: TodoistOAuthPayload = { nonce: crypto.randomBytes(32).toString('base64url'), userId, provider: 'todoist', issuedAt: Date.now() }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${crypto.createHmac('sha256', secret()).update(body).digest('base64url')}`
}
export function parseTodoistOAuthState(value: string | null): TodoistOAuthPayload | null {
  if (!value) return null
  const [body, sig] = value.split('.')
  if (!body || !sig) return null
  try {
    const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as TodoistOAuthPayload
    if (p.provider !== 'todoist' || typeof p.nonce !== 'string' || typeof p.userId !== 'string') return null
    if (Date.now() - p.issuedAt > TODOIST_OAUTH_STATE_TTL_MS || p.issuedAt - Date.now() > 30_000) return null
    return p
  } catch { return null }
}
export function verifyTodoistOAuthState(value: string | null, expectedUserId: string): boolean {
  const p = parseTodoistOAuthState(value)
  return !!p && p.userId === expectedUserId
}
export function hashTodoistNonce(nonce: string): string { return crypto.createHash('sha256').update(nonce).digest('hex') }
