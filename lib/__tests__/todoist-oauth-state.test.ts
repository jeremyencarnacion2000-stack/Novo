import { createIntegrationOAuthState, createTodoistOAuthState, parseIntegrationOAuthState, parseTodoistOAuthState, verifyTodoistOAuthState } from '@/lib/todoist-oauth-state'

describe('Todoist OAuth state', () => {
  beforeEach(() => { Object.assign(process.env, { NODE_ENV: 'test' }) })
  it('creates valid random user-bound state', () => { const a = createTodoistOAuthState('u1'); const b = createTodoistOAuthState('u1'); expect(a).not.toBe(b); expect(verifyTodoistOAuthState(a, 'u1')).toBe(true); expect(verifyTodoistOAuthState(a, 'u2')).toBe(false) })
  it.each([null, '', 'abc', 'a.b.c', '%%% .sig'])('rejects malformed state %p', (v) => expect(parseTodoistOAuthState(v)).toBeNull())
  it('rejects tampering and expiry', () => { const s = createTodoistOAuthState('u'); const [body] = s.split('.'); expect(parseTodoistOAuthState(`${body}.bad`)).toBeNull(); const old = Buffer.from(JSON.stringify({ nonce: 'a'.repeat(43), userId: 'u', provider: 'todoist', issuedAt: Date.now() - 700000 })).toString('base64url'); expect(parseTodoistOAuthState(`${old}.bad`)).toBeNull() })
  it('fails closed without a secret outside test mode', () => { const old = process.env.NODE_ENV; Object.assign(process.env, { NODE_ENV: 'production' }); delete process.env.NEXTAUTH_SECRET; delete process.env.AUTH_SECRET; expect(() => createTodoistOAuthState('u')).toThrow(); Object.assign(process.env, { NODE_ENV: old }) })
})

describe('Integration OAuth state (notion/slack)', () => {
  beforeEach(() => { Object.assign(process.env, { NODE_ENV: 'test' }) })
  it('creates and verifies user-bound state per provider', () => {
    const notion = createIntegrationOAuthState('u1', 'notion')
    const slack = createIntegrationOAuthState('u1', 'slack')
    expect(parseIntegrationOAuthState(notion, 'notion')?.userId).toBe('u1')
    expect(parseIntegrationOAuthState(slack, 'slack')?.userId).toBe('u1')
  })
  it('rejects cross-provider state reuse', () => {
    const notion = createIntegrationOAuthState('u1', 'notion')
    expect(parseTodoistOAuthState(notion)).toBeNull()
    expect(parseIntegrationOAuthState(notion, 'slack')).toBeNull()
    const todoist = createTodoistOAuthState('u1')
    expect(parseIntegrationOAuthState(todoist, 'notion')).toBeNull()
  })
  it('rejects state bound to another user', () => {
    const notion = createIntegrationOAuthState('u1', 'notion')
    const parsed = parseIntegrationOAuthState(notion, 'notion')
    expect(parsed).not.toBeNull()
    expect(parsed?.userId).not.toBe('u2')
  })
})
