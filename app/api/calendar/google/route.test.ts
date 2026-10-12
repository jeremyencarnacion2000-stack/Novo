/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/google', () => ({
  calendarService: {
    listEventsForUser: jest.fn(),
    createEventForUser: jest.fn(),
  },
}))
jest.mock('@/lib/server-idempotency', () => ({
  readIdempotencyKey: jest.fn(() => ({ key: undefined, invalid: false })),
}))

import { getServerSession } from 'next-auth'
import { calendarService } from '@/lib/google'
import { GET, POST } from './route'

function request() {
  return new Request('http://localhost/api/calendar/google', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      summary: 'Focus block',
      description: 'Ship the release',
      startTime: '2026-09-17T13:00:00.000Z',
      endTime: '2026-09-17T14:00:00.000Z',
    }),
  })
}

describe('Google Calendar route auth boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects an incomplete session before calling the provider', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: {} })

    const response = await POST(request())

    expect(response.status).toBe(401)
    expect(calendarService.createEventForUser).not.toHaveBeenCalled()
  })

  it('passes the authenticated account id to the provider', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(calendarService.createEventForUser as jest.Mock).mockResolvedValue({ id: 'google-event-1' })

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(calendarService.createEventForUser).toHaveBeenCalledWith(
      'user-1',
      'Focus block',
      'Ship the release',
      '2026-09-17T13:00:00.000Z',
      '2026-09-17T14:00:00.000Z',
      undefined,
    )
  })

  it('clamps an oversized read page before calling Google', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(calendarService.listEventsForUser as jest.Mock).mockResolvedValue([])

    const response = await GET(new Request('http://localhost/api/calendar/google?maxResults=999999'))

    expect(response.status).toBe(200)
    expect(calendarService.listEventsForUser).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      250,
    )
  })
})
