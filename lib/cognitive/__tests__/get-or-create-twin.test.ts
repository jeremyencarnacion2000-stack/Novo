jest.mock('@/lib/prisma', () => ({
  prisma: {
    cognitiveTwinRecord: { upsert: jest.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { getOrCreateTwin } from '../get-or-create-twin'

describe('getOrCreateTwin', () => {
  it('uses the unique user key as an atomic initialization boundary', async () => {
    const upsert = (prisma.cognitiveTwinRecord.upsert as jest.Mock)
    const record = { id: 'twin-1', userId: 'user-1' }
    upsert.mockResolvedValueOnce(record)

    await expect(getOrCreateTwin('user-1')).resolves.toBe(record)
    expect(upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      update: {},
      create: {
        userId: 'user-1',
        confidenceScore: 0,
        trustLevel: 'initial',
        isInitialized: false,
        totalSignals: 0,
      },
    })
  })
})
