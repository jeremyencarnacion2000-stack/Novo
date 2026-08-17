/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    focusSession: { findMany: jest.fn() },
    dailyAnalytics: { findMany: jest.fn(), upsert: jest.fn() },
    userCognitiveSnapshot: { upsert: jest.fn() },
  },
}))
jest.mock('@/lib/cognitive-memory', () => ({ buildLearningProfile: jest.fn() }))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { buildLearningProfile } from '@/lib/cognitive-memory'
import { GET, POST } from './route'

describe('/api/cognitive/patterns metric boundary', () => {
  beforeEach(() => jest.clearAllMocks())

  it('does not infer a fatigue trend from productivity analytics', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a' } })
    ;(prisma.focusSession.findMany as jest.Mock).mockResolvedValue([])
    ;(buildLearningProfile as jest.Mock).mockReturnValue({ burnoutPrediction: { risk: 'none' } })

    const response = await GET()

    expect(response.status).toBe(200)
    expect(prisma.dailyAnalytics.findMany).not.toHaveBeenCalled()
    expect(buildLearningProfile).toHaveBeenCalledWith('user-a', expect.objectContaining({ fatigueHistory: [] }))
  })

  it('rejects the legacy client fatigue writer instead of persisting synthetic productivity', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a' } })

    const response = await POST(new Request('http://localhost/api/cognitive/patterns', {
      method: 'POST',
      body: JSON.stringify({ type: 'fatigue_sample', data: { fatigueScore: 95 } }),
    }))
    const body = await response.json()

    expect(response.status).toBe(410)
    expect(body.error).toBe('DeprecatedSignal')
    expect(prisma.dailyAnalytics.upsert).not.toHaveBeenCalled()
    expect(prisma.userCognitiveSnapshot.upsert).not.toHaveBeenCalled()
  })
})
