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
})
