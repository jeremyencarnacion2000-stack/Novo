/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    gratitude: { findFirst: jest.fn(), create: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const payload = { content: 'A calm morning', date: '2026-09-12T00:00:00.000Z' }

function request(body: Record<string, unknown>, key?: string) {
  return new Request('http://localhost/api/gratitudes', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: JSON.stringify(body),
  })
}

describe('gratitudes route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
  })

  it('creates a gratitude and records its intent key', async () => {
    const gratitude = { id: 'gratitude-1', userId: 'user-1', ...payload }
    const tx = { gratitude: { create: jest.fn().mockResolvedValue(gratitude) }, mutationRequest: { create: jest.fn() } }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx))

    const response = await POST(request(payload, 'gratitude-intent-1') as never)

    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
    expect((await response.json()).id).toBe(gratitude.id)
    expect(tx.mutationRequest.create).toHaveBeenCalledTimes(1)
  })

  it('replays the original owned gratitude', async () => {
    const gratitude = { id: 'gratitude-1', userId: 'user-1', ...payload }
    const fingerprint = JSON.stringify(payload)
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({ fingerprint, resourceId: gratitude.id })
    ;(prisma.gratitude.findFirst as jest.Mock).mockResolvedValue(gratitude)

    const response = await POST(request(payload, 'gratitude-intent-1') as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect((await response.json()).id).toBe(gratitude.id)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
