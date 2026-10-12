/** @jest-environment node */

jest.mock('@/lib/ai/activity-retention', () => ({ retainAiActivity: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    companionActivityDailySummary: { deleteMany: jest.fn() },
    novoSignalLedger: { deleteMany: jest.fn() },
  },
}))

import { retainAiActivity } from '@/lib/ai/activity-retention'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'
import { GET } from './route'

describe('GET /api/cron/activity-retention', () => {
  const originalSecret = process.env.CRON_SECRET

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    ;(retainAiActivity as jest.Mock).mockResolvedValue({ deleted: 2 })
    ;(prisma.companionActivityDailySummary.deleteMany as jest.Mock).mockResolvedValue({ count: 3 })
    ;(prisma.novoSignalLedger.deleteMany as jest.Mock).mockResolvedValue({ count: 4 })
  })

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalSecret
  })

  it('purges 30-day Companion summaries and ledger signals independently of device sync', async () => {
    const response = await GET(new NextRequest('http://localhost/api/cron/activity-retention', {
      headers: { authorization: 'Bearer cron-secret' },
    }))
    const body = await response.json()
    const summaryQuery = (prisma.companionActivityDailySummary.deleteMany as jest.Mock).mock.calls[0][0]
    const signalQuery = (prisma.novoSignalLedger.deleteMany as jest.Mock).mock.calls[0][0]

    expect(response.status).toBe(200)
    expect(summaryQuery.where.expiresAt.lte).toBeInstanceOf(Date)
    expect(signalQuery.where).toEqual(expect.objectContaining({
      source: 'device',
      signalType: { in: ['active_time_daily', 'app_usage_daily'] },
      sourceRef: { startsWith: 'daily:' },
      observedAt: { lte: expect.any(Date) },
    }))
    expect(body.companion).toEqual({ summariesDeleted: 3, signalsDeleted: 4 })
  })

  it('rejects untrusted callers without running any retention work', async () => {
    const response = await GET(new NextRequest('http://localhost/api/cron/activity-retention'))

    expect(response.status).toBe(401)
    expect(prisma.companionActivityDailySummary.deleteMany).not.toHaveBeenCalled()
    expect(retainAiActivity).not.toHaveBeenCalled()
  })
})
