jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init) },
}))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/analytics-server', () => ({
  getAdvancedInsights: jest.fn(),
  updateDailyAnalytics: jest.fn(),
}))
jest.mock('@/lib/inngest/client', () => ({ inngest: { send: jest.fn() } }))
jest.mock('@/lib/streaks', () => ({ calculateCurrentStreak: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    userSession: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    analyticsEvent: { create: jest.fn(), findMany: jest.fn() },
    dailyAnalytics: { findMany: jest.fn() },
    focusSession: { create: jest.fn(), findMany: jest.fn() },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { normalizeAnalyticsDays } from '@/lib/analytics-validation'
import { POST } from './route'

function analyticsRequest(body: unknown) {
  return new Request('http://localhost/api/analytics', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Analytics ownership', () => {
  beforeEach(() => jest.clearAllMocks())

  it('uses the authenticated owner instead of a client-supplied userId', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.userSession.create as jest.Mock).mockResolvedValue({ id: 'session-1' })

    const response = await POST(analyticsRequest({ action: 'startSession', userId: 'victim-2', module: 'today' }) as never)

    expect(response.status).toBe(200)
    expect(prisma.userSession.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'owner-1' }) }))
  })

  it('replays an owned analytics session for the same stable intent id', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.userSession.findUnique as jest.Mock).mockResolvedValue({ id: 'session-intent-1', userId: 'owner-1' })

    const response = await POST(analyticsRequest({ action: 'startSession', sessionId: 'session-intent-1', module: 'today' }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(body).toEqual({ sessionId: 'session-intent-1', replay: true })
    expect(prisma.userSession.create).not.toHaveBeenCalled()
  })

  it('does not replay an analytics session belonging to another account', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.userSession.findUnique as jest.Mock).mockResolvedValue({ id: 'session-intent-1', userId: 'victim-2' })

    const response = await POST(analyticsRequest({ action: 'startSession', sessionId: 'session-intent-1', module: 'today' }) as never)

    expect(response.status).toBe(409)
    expect(prisma.userSession.create).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated analytics writes even when the body supplies a userId', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const response = await POST(analyticsRequest({ action: 'trackEvent', userId: 'victim-2', eventType: 'page_view', module: 'today' }) as never)

    expect(response.status).toBe(401)
    expect(prisma.analyticsEvent.create).not.toHaveBeenCalled()
  })

  it('does not end an analytics session owned by another user', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.userSession.findUnique as jest.Mock).mockResolvedValue({
      id: 'foreign-session', userId: 'victim-2', startTime: new Date(), endTime: null, modulesUsed: '["today"]',
    })

    await POST(analyticsRequest({ action: 'endSession', sessionId: 'foreign-session' }) as never)

    expect(prisma.userSession.update).not.toHaveBeenCalled()
  })

  it('normalizes invalid and unbounded analytics windows', () => {
    expect(normalizeAnalyticsDays(undefined)).toBe(30)
    expect(normalizeAnalyticsDays('not-a-number')).toBe(30)
    expect(normalizeAnalyticsDays(0)).toBe(1)
    expect(normalizeAnalyticsDays(9999)).toBe(365)
    expect(normalizeAnalyticsDays(14.9)).toBe(14)
  })

  it('returns finite zero metrics for a new account', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: 'free' })
    ;(prisma.dailyAnalytics.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.analyticsEvent.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.userSession.findMany as jest.Mock).mockResolvedValue([])

    const response = await POST(analyticsRequest({ action: 'calculateProductivityMetrics', days: 'invalid' }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual(expect.objectContaining({
      totalDays: 30,
      productiveDays: 0,
      productivityRate: 0,
      avgDailyTime: 0,
      totalCompletions: 0,
      peakHour: 0,
    }))
    expect(Object.values(body).some((value) => typeof value === 'number' && !Number.isFinite(value))).toBe(false)
  })

  it('bounds the JSON getAnalyticsData window before querying history', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: 'free' })
    ;(prisma.dailyAnalytics.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.analyticsEvent.findMany as jest.Mock).mockResolvedValue([])

    const response = await POST(analyticsRequest({ action: 'getAnalyticsData', days: 9999 }) as never)

    expect(response.status).toBe(200)
    const query = (prisma.analyticsEvent.findMany as jest.Mock).mock.calls[0][0]
    const start = query.where.timestamp.gte as Date
    const ageDays = (Date.now() - start.getTime()) / (24 * 60 * 60 * 1000)
    expect(ageDays).toBeGreaterThanOrEqual(29)
    expect(ageDays).toBeLessThanOrEqual(31)
  })
})
