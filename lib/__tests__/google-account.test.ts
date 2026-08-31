/** @jest-environment node */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findMany: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { findGoogleAccountForScopes, hasGoogleScopes, shouldPersistGoogleGrant, toGoogleOAuthCredentials } from '@/lib/google-account'

describe('Google account capability selection', () => {
  beforeEach(() => jest.clearAllMocks())

  it('selects the Google account with the requested Gmail capability rather than the first linked account', async () => {
    ;(prisma.account.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'basic-google-account',
        access_token: 'basic-access',
        refresh_token: 'basic-refresh',
        expires_at: 1_900_000_000,
        scope: 'openid email profile',
      },
      {
        id: 'gmail-google-account',
        access_token: 'gmail-access',
        refresh_token: 'gmail-refresh',
        expires_at: 1_900_000_000,
        scope: 'openid https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar',
      },
    ])

    await expect(findGoogleAccountForScopes('user-1', ['gmail.readonly'])).resolves.toMatchObject({
      id: 'gmail-google-account',
    })
  })

  it('matches the full Google scope URL and rejects an account without the requested capability', () => {
    expect(hasGoogleScopes('openid https://www.googleapis.com/auth/gmail.readonly', ['gmail.readonly'])).toBe(true)
    expect(hasGoogleScopes('openid email profile', ['gmail.readonly'])).toBe(false)
  })

  it('does not let a basic Google login replace an existing expanded grant', () => {
    expect(shouldPersistGoogleGrant(
      'openid https://www.googleapis.com/auth/gmail.readonly',
      'openid email profile',
    )).toBe(false)
    expect(shouldPersistGoogleGrant(
      'openid email profile',
      'openid https://www.googleapis.com/auth/gmail.readonly',
    )).toBe(true)
  })

  it('preserves the durable expiry timestamp so OAuth can refresh instead of retrying a stale token', () => {
    expect(toGoogleOAuthCredentials({ id: 'google', access_token: 'access', refresh_token: 'refresh', expires_at: 1_900_000_000, scope: 'openid' })).toEqual({
      access_token: 'access',
      refresh_token: 'refresh',
      expiry_date: 1_900_000_000_000,
    })
  })
})
