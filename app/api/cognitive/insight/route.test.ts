/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    insight: { create: jest.fn(), findMany: jest.fn() },
    userCognitiveSnapshot: { upsert: jest.fn() },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

describe('POST /api/cognitive/insight metric boundary', () => {
  beforeEach(() => jest.clearAllMocks())

  it('does not persist a legacy fatigue claim without a sourced check-in', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a' } })

    const response = await POST(new Request('http://localhost/api/cognitive/insight', {
      method: 'POST',
      body: JSON.stringify({ type: 'fatigue', content: 'Synthetic warning' }),
    }))

    expect(response.status).toBe(400)
    expect(prisma.insight.create).not.toHaveBeenCalled()
    expect(prisma.userCognitiveSnapshot.upsert).not.toHaveBeenCalled()
  })
})
