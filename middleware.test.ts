import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { middleware } from './middleware'

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}))

const mockedGetToken = getToken as jest.Mock

function request(url: string) {
  return new NextRequest(url)
}

describe('request auth boundary', () => {
  beforeEach(() => mockedGetToken.mockReset())

  it('redirects anonymous product routes to login with an encoded return path', async () => {
    mockedGetToken.mockResolvedValue(null)

    const response = await middleware(request('https://productivitynovo.vercel.app/today?from=app'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://productivitynovo.vercel.app/auth/signin?callbackUrl=%2Ftoday%3Ffrom%3Dapp',
    )
  })

  it('lets an authenticated product route reach the server page', async () => {
    mockedGetToken.mockResolvedValue({ sub: 'user-1' })

    const response = await middleware(request('https://productivitynovo.vercel.app/today'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('keeps API errors JSON-shaped instead of redirecting them to HTML login', async () => {
    mockedGetToken.mockResolvedValue(null)

    const response = await middleware(request('https://productivitynovo.vercel.app/api/tasks'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(mockedGetToken).not.toHaveBeenCalled()
  })

  it('keeps the landing, auth, onboarding and install assets public', async () => {
    mockedGetToken.mockResolvedValue(null)

    for (const pathname of ['/landing', '/auth/signin', '/onboarding', '/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource', '/manifest.json', '/sw.js']) {
      const response = await middleware(request(`https://productivitynovo.vercel.app${pathname}`))
      expect(response.status).toBe(200)
    }

    expect(mockedGetToken).not.toHaveBeenCalled()
  })

})
