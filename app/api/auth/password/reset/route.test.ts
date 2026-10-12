/** @jest-environment node */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}))

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('new-hash') }))

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/auth/password/reset', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('password reset route', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects malformed or expired links without touching the user', async () => {
    const response = await POST(request({ token: 'bad', password: 'a-secure-password' }))
    expect(response.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('updates the password, closes sessions, and consumes the token once', async () => {
    const user = { id: 'user-1' }
    const tx = {
      user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn() },
      session: { deleteMany: jest.fn() },
      verificationToken: {
        findUnique: jest.fn().mockResolvedValue({
          identifier: 'password-reset:angel@example.com',
          token: 'hashed-token',
          expires: new Date(Date.now() + 60_000),
        }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx))
    const response = await POST(request({ token: 'a'.repeat(64), password: 'a-secure-password' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { password: 'new-hash' } })
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    expect(tx.verificationToken.deleteMany).toHaveBeenCalledWith({ where: { token: expect.stringMatching(/^[a-f0-9]{64}$/) } })
  })

  it('treats a concurrent replay that loses token consumption as an invalid link', async () => {
    const tx = {
      verificationToken: {
        findUnique: jest.fn().mockResolvedValue({
          identifier: 'password-reset:angel@example.com',
          token: 'hashed-token',
          expires: new Date(Date.now() + 60_000),
        }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      user: { findUnique: jest.fn(), update: jest.fn() },
      session: { deleteMany: jest.fn() },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx))
    const response = await POST(request({ token: 'b'.repeat(64), password: 'a-secure-password' }))
    expect(response.status).toBe(400)
    expect(tx.user.update).not.toHaveBeenCalled()
  })
})
