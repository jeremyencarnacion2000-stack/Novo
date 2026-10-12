/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    musicArtist: { upsert: jest.fn(), deleteMany: jest.fn() },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/music/follow', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('music follow input boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { email: 'owner@example.com' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(prisma.musicArtist.upsert as jest.Mock).mockResolvedValue({ id: 'follow-1' })
  })

  it('rejects an unknown action instead of treating it as unfollow', async () => {
    const response = await POST(request({ artistId: 'artist-1', action: 'typo' }) as never)

    expect(response.status).toBe(400)
    expect(prisma.musicArtist.deleteMany).not.toHaveBeenCalled()
  })

  it('keeps follow idempotent through the unique user/artist key', async () => {
    const response = await POST(request({ artistId: 'artist-1', action: 'follow', artistName: 'Novo Artist' }) as never)

    expect(response.status).toBe(200)
    expect(prisma.musicArtist.upsert).toHaveBeenCalledTimes(1)
  })
})
