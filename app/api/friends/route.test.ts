jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init) },
}))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    friendship: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/friends', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('friend request idempotency', () => {
  beforeEach(() => jest.clearAllMocks())

  it('replays the same pending request instead of returning a duplicate error', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.friendship.findFirst as jest.Mock).mockResolvedValue({
      id: 'friendship-1',
      requesterId: 'owner-1',
      addresseeId: 'friend-2',
      status: 'PENDING',
    })

    const response = await POST(request({ targetUserId: 'friend-2', action: 'request' }) as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ success: true, replay: true, status: 'PENDING' })
    expect(prisma.friendship.create).not.toHaveBeenCalled()
  })

  it('does not treat a reverse-direction invitation as the same intent', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.friendship.findFirst as jest.Mock).mockResolvedValue({
      id: 'friendship-1',
      requesterId: 'friend-2',
      addresseeId: 'owner-1',
      status: 'PENDING',
    })

    const response = await POST(request({ targetUserId: 'friend-2', action: 'request' }) as never)

    expect(response.status).toBe(400)
    expect(prisma.friendship.create).not.toHaveBeenCalled()
  })

  it('rejects self invitations before touching friendship storage', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })

    const response = await POST(request({ targetUserId: 'owner-1', action: 'request' }) as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: 'You cannot send a friend request to yourself' })
    expect(prisma.friendship.findFirst).not.toHaveBeenCalled()
    expect(prisma.friendship.create).not.toHaveBeenCalled()
  })
})
