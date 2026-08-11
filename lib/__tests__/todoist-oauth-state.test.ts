import { createTodoistOAuthState, parseTodoistOAuthState, verifyTodoistOAuthState } from '@/lib/todoist-oauth-state'

describe('Todoist OAuth state', () => {
  beforeEach(() => { process.env.NODE_ENV = 'test' })
  it('creates valid random user-bound state', () => { const a = createTodoistOAuthState('u1'); const b = createTodoistOAuthState('u1'); expect(a).not.toBe(b); expect(verifyTodoistOAuthState(a, 'u1')).toBe(true); expect(verifyTodoistOAuthState(a, 'u2')).toBe(false) })
  it.each([null, '', 'abc', 'a.b.c', '%%% .sig'])('rejects malformed state %p', (v) => expect(parseTodoistOAuthState(v)).toBeNull())
  it('rejects tampering and expiry', () => { const s = createTodoistOAuthState('u'); const [body] = s.split('.'); expect(parseTodoistOAuthState(`${body}.bad`)).toBeNull(); const old = Buffer.from(JSON.stringify({ nonce: 'a'.repeat(43), userId: 'u', provider: 'todoist', issuedAt: Date.now() - 700000 })).toString('base64url'); expect(parseTodoistOAuthState(`${old}.bad`)).toBeNull() })
  it('fails closed without a secret outside test mode', () => { const old = process.env.NODE_ENV; process.env.NODE_ENV = 'production'; delete process.env.NEXTAUTH_SECRET; delete process.env.AUTH_SECRET; expect(() => createTodoistOAuthState('u')).toThrow(); process.env.NODE_ENV = old })
})
