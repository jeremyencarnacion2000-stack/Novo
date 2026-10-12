/** @jest-environment node */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(() => ({ allowed: true })),
  rateLimitResponse: jest.fn(),
}))

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}))

import { prisma } from '@/lib/prisma'
import { POST } from './route'

function request() {
  return new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Angel',
      email: 'angel@example.com',
      password: 'a-secure-password',
    }),
  })
}

describe('signup route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
  })

  it('returns conflict when the database unique index wins a signup race', async () => {
    ;(prisma.user.create as jest.Mock).mockRejectedValue({ code: 'P2002' })

    const response = await POST(request() as never)

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Este email ya está registrado' })
  })
})
