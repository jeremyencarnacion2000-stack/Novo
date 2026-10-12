/** @jest-environment node */

import MobileAuthBridge from './page'
import { getServerSession } from 'next-auth/next'

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  },
}))

const mockedGetServerSession = getServerSession as jest.Mock

describe('mobile auth bridge', () => {
  beforeEach(() => mockedGetServerSession.mockReset())

  it('resolves an existing session through the app entry router', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { id: 'user-1' } })

    await expect(MobileAuthBridge()).rejects.toThrow('NEXT_REDIRECT:/app')
  })

  it('sends a missing session to web login with the app callback', async () => {
    mockedGetServerSession.mockResolvedValue(null)

    await expect(MobileAuthBridge()).rejects.toThrow('NEXT_REDIRECT:/auth/signin?callbackUrl=%2Fapp')
  })
})
