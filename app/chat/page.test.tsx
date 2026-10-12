/** @jest-environment node */

import ChatPage from './page'
import { getServerSession } from 'next-auth'

jest.mock('next-auth', () => ({
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

jest.mock('@/app/ai/page', () => ({
  __esModule: true,
  default: () => null,
}))

const mockedGetServerSession = getServerSession as jest.Mock

describe('chat app entry guard', () => {
  beforeEach(() => {
    mockedGetServerSession.mockReset()
  })

  it('sends an unauthenticated app/PWA entry to web sign-in', async () => {
    mockedGetServerSession.mockResolvedValue(null)

    await expect(ChatPage()).rejects.toThrow('NEXT_REDIRECT:/auth/signin?callbackUrl=%2Fchat')
  })

  it('renders the app surface for an authenticated session', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { id: 'user-1' } })

    await expect(ChatPage()).resolves.toBeTruthy()
  })
})
