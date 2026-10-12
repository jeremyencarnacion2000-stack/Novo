import { decryptIntegrationCredential, encryptIntegrationCredential, resolveIntegrationCredential } from '@/lib/companion/credential-vault'

describe('integration credential vault', () => {
  const originalSecret = process.env.NEXTAUTH_SECRET

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = 'unit-test-secret-with-adequate-entropy'
  })

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.NEXTAUTH_SECRET
    else process.env.NEXTAUTH_SECRET = originalSecret
  })

  it('encrypts credentials at rest and decrypts only for the same owner/provider', () => {
    const stored = encryptIntegrationCredential('vercel-private-token', { userId: 'owner-a', provider: 'vercel' })

    expect(stored).not.toContain('vercel-private-token')
    expect(stored).toMatch(/^novo:v1:/)
    expect(decryptIntegrationCredential(stored, { userId: 'owner-a', provider: 'vercel' })).toBe('vercel-private-token')
    expect(() => decryptIntegrationCredential(stored, { userId: 'owner-b', provider: 'vercel' })).toThrow()
  })

  it('refuses to create credentials when the application secret is unavailable', () => {
    delete process.env.NEXTAUTH_SECRET

    expect(() => encryptIntegrationCredential('token', { userId: 'owner-a', provider: 'vercel' })).toThrow('credential_storage_unavailable')
  })

  it('resolves encrypted credentials for the owning provider and supports legacy plaintext records', () => {
    const context = { userId: 'owner-a', provider: 'github' }
    const stored = encryptIntegrationCredential('github-private-token', context)

    expect(resolveIntegrationCredential(stored, context)).toBe('github-private-token')
    expect(resolveIntegrationCredential('legacy-github-token', context)).toBe('legacy-github-token')
    expect(() => resolveIntegrationCredential(stored, { userId: 'owner-b', provider: 'github' })).toThrow('credential_decryption_failed')
    expect(() => resolveIntegrationCredential('novo:unknown-format', context)).toThrow('credential_decryption_failed')
  })
})
