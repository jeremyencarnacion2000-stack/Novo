/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    tracker: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const payload = { name: 'Read', type: 'habit', unit: 'days', goal: 7, entries: [] }

function request(key?: string) {
  return new Request('http://localhost/api/trackers', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: JSON.stringify(payload),
  })
}

describe('tracker creation idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mutationRequest.create as jest.Mock).mockResolvedValue({ id: 'request-1' })
    ;(prisma.mutationRequest.update as jest.Mock).mockResolvedValue({ id: 'request-1' })
    ;(prisma.tracker.create as jest.Mock).mockResolvedValue({ id: 'tracker-1', ...payload })
  })

  it('creates one tracker under a durable key', async () => {
    const response = await POST(request('tracker-intent-1') as never)
    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
  })

  it('replays the owned tracker instead of duplicating it', async () => {
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({ fingerprint: JSON.stringify(payload), resourceId: 'tracker-1' })
    ;(prisma.tracker.findFirst as jest.Mock).mockResolvedValue({ id: 'tracker-1', ...payload })
    const response = await POST(request('tracker-intent-1') as never)
    expect(response.status).toBe(200)
    expect(prisma.tracker.create).not.toHaveBeenCalled()
  })
})
