/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init) },
}))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    deviceActivityEvent: { create: jest.fn() },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

function presenceRequest(body: unknown) {
  return new Request('http://localhost/api/device/presence', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/device/presence', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects unauthenticated requests', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const response = await POST(presenceRequest({
      startedAt: '2026-08-17T10:00:00.000Z',
      endedAt: '2026-08-17T10:05:00.000Z',
    }) as never)

    expect(response.status).toBe(401)
    expect(prisma.deviceActivityEvent.create).not.toHaveBeenCalled()
  })

  it('rejects endedAt at or before startedAt', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a' } })

    const response = await POST(presenceRequest({
      startedAt: '2026-08-17T10:05:00.000Z',
      endedAt: '2026-08-17T10:00:00.000Z',
    }) as never)

    expect(response.status).toBe(400)
    expect(prisma.deviceActivityEvent.create).not.toHaveBeenCalled()
  })

  it('rejects a malformed body', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a' } })

    const response = await POST(presenceRequest({ startedAt: 'not-a-date', endedAt: 'also-not-a-date' }) as never)

    expect(response.status).toBe(400)
    expect(prisma.deviceActivityEvent.create).not.toHaveBeenCalled()
  })

  it('persists a valid session scoped to the authenticated user, ignoring any client-supplied userId', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.deviceActivityEvent.create as jest.Mock).mockResolvedValue({ id: 'evt-1' })

    const response = await POST(presenceRequest({
      startedAt: '2026-08-17T10:00:00.000Z',
      endedAt: '2026-08-17T10:05:00.000Z',
      userId: 'victim-2',
    }) as never)

    expect(response.status).toBe(200)
    expect(prisma.deviceActivityEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'owner-1' }),
    }))
  })
})
