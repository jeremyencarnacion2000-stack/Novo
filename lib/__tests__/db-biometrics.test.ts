/** @jest-environment node */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    task: { findMany: jest.fn() },
    fitnessEntry: { findFirst: jest.fn() },
    workoutEntry: { findFirst: jest.fn() },
    dailyAnalytics: { findFirst: jest.fn() },
    userCognitiveSnapshot: { upsert: jest.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { fetchDbBiometricPayload } from '../db-biometrics'

describe('database biometric fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.task.findMany as jest.Mock).mockResolvedValue([{ dueDate: '2000-01-01' }])
    ;(prisma.fitnessEntry.findFirst as jest.Mock).mockResolvedValue({ steps: 8_000 })
    ;(prisma.workoutEntry.findFirst as jest.Mock).mockResolvedValue({ durationMinutes: 30 })
    ;(prisma.dailyAnalytics.findFirst as jest.Mock).mockResolvedValue({ productivityScore: 60, totalTime: 120 })
  })

  it('does not present task-derived estimates as biometric data', async () => {
    const payload = await fetchDbBiometricPayload('user-synthetic')

    expect(payload.hasGoogleFitData).toBe(false)
    expect(payload.sleep).toMatchObject({ hasData: false, totalSleepMinutes: 0, deepSleepMinutes: 0, remSleepMinutes: 0 })
    expect(payload.heartRate).toMatchObject({ hasData: false, averageBpm: 0, sampleCount: 0 })
    expect(payload).toMatchObject({ userStressScore: null, stressLevel: 'unavailable' })
    expect(prisma.task.findMany).not.toHaveBeenCalled()
    expect(prisma.userCognitiveSnapshot.upsert).not.toHaveBeenCalled()
  })
})
