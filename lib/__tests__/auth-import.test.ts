/** @jest-environment node */

describe('auth configuration import', () => {
  afterEach(() => {
    jest.resetModules()
    jest.restoreAllMocks()
  })

  it('does not emit environment or provider diagnostics merely by being imported', async () => {
    jest.doMock('@next-auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }))
    jest.doMock('next-auth/providers/google', () => () => ({ id: 'google', type: 'oauth' }))
    jest.doMock('next-auth/providers/spotify', () => () => ({ id: 'spotify', type: 'oauth' }))
    jest.doMock('next-auth/providers/credentials', () => () => ({ id: 'credentials', type: 'credentials' }))
    jest.doMock('@/lib/prisma', () => ({ prisma: {} }))
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => ({ allowed: true }) }))

    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    await import('../auth')

    expect(log).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('does not log OAuth redirect URLs that may contain authorization codes', async () => {
    jest.doMock('@next-auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }))
    jest.doMock('next-auth/providers/google', () => () => ({ id: 'google', type: 'oauth' }))
    jest.doMock('next-auth/providers/spotify', () => () => ({ id: 'spotify', type: 'oauth' }))
    jest.doMock('next-auth/providers/credentials', () => () => ({ id: 'credentials', type: 'credentials' }))
    jest.doMock('@/lib/prisma', () => ({ prisma: {} }))
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => ({ allowed: true }) }))
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const { authOptions } = await import('../auth')

    const result = await authOptions.callbacks!.redirect!({
      url: '/oauth/consent/request?code=private-authorization-code',
      baseUrl: 'https://novo.test',
    })

    expect(result).toBe('https://novo.test/oauth/consent/request?code=private-authorization-code')
    expect(log).not.toHaveBeenCalled()
  })

  it('keeps OAuth credentials out of the browser session payload', async () => {
    jest.doMock('@next-auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }))
    jest.doMock('next-auth/providers/google', () => () => ({ id: 'google', type: 'oauth' }))
    jest.doMock('next-auth/providers/spotify', () => () => ({ id: 'spotify', type: 'oauth' }))
    jest.doMock('next-auth/providers/credentials', () => () => ({ id: 'credentials', type: 'credentials' }))
    jest.doMock('@/lib/prisma', () => ({ prisma: {} }))
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: () => ({ allowed: true }) }))

    const { authOptions } = await import('../auth')
    const callback = authOptions.callbacks?.session
    expect(callback).toBeDefined()

    const session = await callback!({
      session: { user: { id: 'user-1', name: 'Angel', email: 'angel@example.com', image: null } },
      token: { id: 'user-1', name: 'Angel', accessToken: 'oauth-secret', refreshToken: 'refresh-secret', provider: 'google' },
    } as any)

    expect((session as any).user.id).toBe('user-1')
    expect((session as any).accessToken).toBeUndefined()
    expect((session as any).refreshToken).toBeUndefined()
    expect((session as any).provider).toBeUndefined()
  })
})
