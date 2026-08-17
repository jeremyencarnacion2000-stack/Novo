jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init) },
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { aiActivityRun: { findFirst: jest.fn() } },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

describe('Twin inference status ownership', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects unauthenticated status reads', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(401)
    expect(prisma.aiActivityRun.findFirst).not.toHaveBeenCalled()
  })

  it('queries only the authenticated user Twin inference surface', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const updatedAt = new Date('2026-08-08T10:00:00.000Z')
    ;(prisma.aiActivityRun.findFirst as jest.Mock).mockResolvedValue({ id: 'run-1', phase: 'adapting', sequence: 6, status: 'running', updatedAt })

    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.run).toEqual(expect.objectContaining({ id: 'run-1', phase: 'adapting' }))
    expect(prisma.aiActivityRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'user-1', surface: 'twin_inference' }),
      orderBy: { updatedAt: 'desc' },
    }))
  })
})
