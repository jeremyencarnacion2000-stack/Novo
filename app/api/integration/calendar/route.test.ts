/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    calendarEvent: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}))
jest.mock('@/lib/google-account', () => ({ findGoogleAccountForScopes: jest.fn() }))
jest.mock('@/lib/google', () => ({
  calendarService: { listEventsForUser: jest.fn() },
}))
jest.mock('@/lib/provider-sync-lock', () => ({
  withProviderSyncLock: jest.fn(),
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { findGoogleAccountForScopes } from '@/lib/google-account'
import { calendarService } from '@/lib/google'
import { withProviderSyncLock } from '@/lib/provider-sync-lock'
import { POST } from './route'

const googleEvent = {
  id: 'google-event-1',
  summary: 'Focus block',
  description: 'Ship the release',
  start: { dateTime: '2026-09-05T13:00:00.000Z' },
  end: { dateTime: '2026-09-05T14:00:00.000Z' },
}

function request(action = 'sync_from_google') {
  return new Request('http://localhost/api/integration/calendar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  })
}

describe('Google Calendar reconciliation lock', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'google-1' })
    ;(calendarService.listEventsForUser as jest.Mock).mockResolvedValue([googleEvent])
    ;(prisma.calendarEvent.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.calendarEvent.create as jest.Mock).mockResolvedValue({ id: 'event-1' })
    ;(withProviderSyncLock as jest.Mock).mockImplementation(async (_db, key, work) => work(prisma, key))
  })

  it('reconciles the write window under a per-user lock', async () => {
    const response = await POST(request() as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, created: 1, updated: 0 })
    expect(withProviderSyncLock).toHaveBeenCalledWith(
      prisma,
      'novo:calendar-sync:user-1',
      expect.any(Function),
    )
    expect(prisma.calendarEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-1', googleEventId: 'google-event-1' }),
    }))
  })

  it('rejects a non-sync action before contacting Google', async () => {
    const response = await POST(request('delete_all') as never)

    expect(response.status).toBe(400)
    expect(calendarService.listEventsForUser).not.toHaveBeenCalled()
    expect(withProviderSyncLock).not.toHaveBeenCalled()
  })
})
