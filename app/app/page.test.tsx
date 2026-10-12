/** @jest-environment node */

import AppEntryPage from './page'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    cognitiveTwinRecord: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  },
}))

const mockedGetServerSession = getServerSession as jest.Mock
const mockedFindUnique = prisma.cognitiveTwinRecord.findUnique as jest.Mock

describe('app resolver', () => {
  beforeEach(() => {
    mockedGetServerSession.mockReset()
    mockedFindUnique.mockReset()
  })

  it('sends a missing session to web login with the app return target', async () => {
    mockedGetServerSession.mockResolvedValue(null)

    await expect(AppEntryPage()).rejects.toThrow('NEXT_REDIRECT:/auth/signin?callbackUrl=%2Fapp')
    expect(mockedFindUnique).not.toHaveBeenCalled()
  })

  it('sends a signed-in first-run user to onboarding', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { id: 'user-1' } })
    mockedFindUnique.mockResolvedValue({ onboardingCompletedAt: null })

    await expect(AppEntryPage()).rejects.toThrow('NEXT_REDIRECT:/onboarding')
  })

  it('sends a completed user to the product surface, not the landing', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { id: 'user-1' } })
    mockedFindUnique.mockResolvedValue({ onboardingCompletedAt: new Date('2026-09-12T00:00:00.000Z') })

    await expect(AppEntryPage()).rejects.toThrow('NEXT_REDIRECT:/')
  })

  it('fails safe to onboarding when the state check is temporarily unavailable', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { id: 'user-1' } })
    mockedFindUnique.mockRejectedValue(new Error('database unavailable'))

    await expect(AppEntryPage()).rejects.toThrow('NEXT_REDIRECT:/onboarding')
  })
})
