/** @jest-environment node */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(() => ({ allowed: true })),
  rateLimitResponse: jest.fn(),
}))

jest.mock('@/lib/email', () => ({
  emailService: { sendPasswordReset: jest.fn().mockResolvedValue({ id: 'email-1' }) },
}))

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/email'
import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/auth/password/forgot', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('password forgot route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback({ verificationToken: { deleteMany: jest.fn(), create: jest.fn() } }))
  })

  it('uses a generic response for unknown accounts', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    const response = await POST(request({ email: 'unknown@example.com' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ message: 'If an account exists for that email, a reset link is on its way.' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(emailService.sendPasswordReset).not.toHaveBeenCalled()
  })

  it('stores only a token hash and queues a reset email for password users', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1', password: 'hash' })
    const response = await POST(request({ email: 'Angel@Example.com' }))
    expect(response.status).toBe(200)
    expect((prisma.$transaction as jest.Mock).mock.calls[0][0]).toBeInstanceOf(Function)
    await Promise.resolve()
    expect(emailService.sendPasswordReset).toHaveBeenCalledWith('angel@example.com', expect.stringContaining('/auth/reset-password?token='))
    const emailUrl = (emailService.sendPasswordReset as jest.Mock).mock.calls[0][1] as string
    expect(emailUrl).not.toContain('oauth')
  })
})
