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
    userSession: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    analyticsEvent: { create: jest.fn(), findMany: jest.fn() },
    dailyAnalytics: { findMany: jest.fn() },
    focusSession: { create: jest.fn(), findMany: jest.fn() },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
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
})
