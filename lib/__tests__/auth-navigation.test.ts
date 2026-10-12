import { isNativeShell, reloadAuthenticatedApp, redirectWhenSessionMissing } from '../auth-navigation'

describe('isNativeShell', () => {
  afterEach(() => {
    delete (window as Window & { Capacitor?: unknown }).Capacitor
  })

  it('recognizes Capacitor without relying on a user-agent override', () => {
    ;(window as Window & { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
    }

    expect(isNativeShell()).toBe(true)
  })

  it('keeps ordinary browser sessions on the web surface', () => {
    expect(isNativeShell()).toBe(false)
  })
})

describe('reloadAuthenticatedApp', () => {
  it('performs a document navigation so SessionProvider rehydrates the new cookie', () => {
    const assign = jest.fn()

    reloadAuthenticatedApp('/cognitive', { assign })

    expect(assign).toHaveBeenCalledWith('/cognitive')
  })
})

describe('redirectWhenSessionMissing', () => {
  it('keeps the authenticated route when the server session probe succeeds', async () => {
    const redirect = jest.fn()

    await redirectWhenSessionMissing(
      async () => ({ user: { id: 'audit-user' } }),
      redirect,
    )

    expect(redirect).not.toHaveBeenCalled()
  })

  it('redirects only after the server session probe confirms no session', async () => {
    const redirect = jest.fn()

    await redirectWhenSessionMissing(async () => null, redirect)

    expect(redirect).toHaveBeenCalledWith('/landing')
  })

  it('supports a native login handoff without exposing the public landing', async () => {
    const redirect = jest.fn()

    await redirectWhenSessionMissing(
      async () => null,
      redirect,
      '/auth/signin?callbackUrl=%2Fchat',
    )

    expect(redirect).toHaveBeenCalledWith('/auth/signin?callbackUrl=%2Fchat')
  })

  it('does not discard the current route when the session probe is temporarily unavailable', async () => {
    const redirect = jest.fn()

    await redirectWhenSessionMissing(async () => {
      throw new Error('network unavailable')
    }, redirect)

    expect(redirect).not.toHaveBeenCalled()
  })
})
