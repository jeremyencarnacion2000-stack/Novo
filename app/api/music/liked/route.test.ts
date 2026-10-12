/** @jest-environment node */

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    likedTrack: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
  },
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/music/liked', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('music liked-track input boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { email: 'owner@example.com' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(prisma.likedTrack.upsert as jest.Mock).mockResolvedValue({ id: 'like-1' })
  })

  it('rejects an add without the metadata required by the database', async () => {
    const response = await POST(request({ trackId: 'track-1', action: 'add' }) as never)

    expect(response.status).toBe(400)
    expect(prisma.likedTrack.upsert).not.toHaveBeenCalled()
  })

  it('uses the unique user/track key for repeat-safe likes', async () => {
    const response = await POST(request({
      trackId: 'track-1', action: 'add', title: 'Track', artist: 'Artist', duration: 180000,
    }) as never)

    expect(response.status).toBe(200)
    expect(prisma.likedTrack.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_trackId: { userId: 'user-1', trackId: 'track-1' } },
    }))
  })
})
