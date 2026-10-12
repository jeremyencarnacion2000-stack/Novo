/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    calendarEvent: { findFirst: jest.fn(), create: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/cognitive/ambient-twin-runtime', () => ({ runAmbientTwinForUser: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/calendar-aggregator', () => ({ CalendarAggregator: { getEventsForRange: jest.fn() } }))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GET, POST } from './route'
import { CalendarAggregator } from '@/lib/calendar-aggregator'

const payload = { title: 'Focus block', description: 'Ship the release', start: '2026-09-05T13:00:00.000Z', end: '2026-09-05T14:00:00.000Z', allDay: false }

function request(key?: string) {
  return new Request('http://localhost/api/calendar/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: JSON.stringify(payload),
  })
}

describe('calendar event creation idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mutationRequest.create as jest.Mock).mockResolvedValue({ id: 'request-1' })
    ;(prisma.mutationRequest.update as jest.Mock).mockResolvedValue({ id: 'request-1' })
    ;(prisma.calendarEvent.create as jest.Mock).mockResolvedValue({ id: 'event-1', userId: 'user-1', ...payload })
    ;(CalendarAggregator.getEventsForRange as jest.Mock).mockResolvedValue([])
  })

  it('creates an event once for a durable intent', async () => {
    const response = await POST(request('calendar-intent-1') as never)
    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
  })

  it('does not repeat a retry that already created an owned event', async () => {
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint: JSON.stringify(payload),
      resourceId: 'event-1',
    })
    ;(prisma.calendarEvent.findFirst as jest.Mock).mockResolvedValue({ id: 'event-1', userId: 'user-1', ...payload })

    const response = await POST(request('calendar-intent-1') as never)
    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(prisma.calendarEvent.create).not.toHaveBeenCalled()
  })
})

describe('calendar event range validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(CalendarAggregator.getEventsForRange as jest.Mock).mockResolvedValue([])
  })

  it('rejects invalid or reversed ranges before querying calendar sources', async () => {
    const response = await GET(new Request('http://localhost/api/calendar/events?start=not-a-date&end=2026-09-05T14:00:00.000Z') as never)
    expect(response.status).toBe(400)
    expect(CalendarAggregator.getEventsForRange).not.toHaveBeenCalled()

    const reversed = await GET(new Request('http://localhost/api/calendar/events?start=2026-09-05T14:00:00.000Z&end=2026-09-05T13:00:00.000Z') as never)
    expect(reversed.status).toBe(400)
    expect(CalendarAggregator.getEventsForRange).not.toHaveBeenCalled()
  })

  it('rejects an oversized range and normalizes duplicate source filters', async () => {
    const oversized = await GET(new Request('http://localhost/api/calendar/events?start=2026-01-01T00:00:00.000Z&end=2027-01-03T00:00:00.000Z') as never)
    expect(oversized.status).toBe(400)
    expect(CalendarAggregator.getEventsForRange).not.toHaveBeenCalled()

    const response = await GET(new Request('http://localhost/api/calendar/events?start=2026-09-01T00:00:00.000Z&end=2026-09-02T00:00:00.000Z&sources=google,google,unknown,novo') as never)
    expect(response.status).toBe(200)
    expect(CalendarAggregator.getEventsForRange).toHaveBeenCalledWith(
      'user-1',
      expect.any(Date),
      expect.any(Date),
      ['google', 'novo'],
    )
  })

  it('rejects whitespace-only titles before persisting an event', async () => {
    const request = new Request('http://localhost/api/calendar/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, title: '   ' }),
    })
    const response = await POST(request as never)
    expect(response.status).toBe(400)
    expect(prisma.calendarEvent.create).not.toHaveBeenCalled()
  })
})
