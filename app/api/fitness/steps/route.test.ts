/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    fitnessEntry: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const date = '2026-09-12T12:00:00.000Z'

function request(body: Record<string, unknown>, idempotencyKey?: string) {
  return new Request('http://localhost/api/fitness/steps', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('fitness steps route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
  })

  it('upserts one owned day and records the request key', async () => {
    const entry = { id: 'steps-1', userId: 'user-1', steps: 8000, date: new Date('2026-09-12T00:00:00.000Z') }
    const tx = {
      fitnessEntry: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(entry), update: jest.fn() },
      mutationRequest: { create: jest.fn() },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx))

    const response = await POST(request({ steps: 8000, date }, 'steps-intent-1') as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
    expect((await response.json()).data.id).toBe(entry.id)
    expect(tx.mutationRequest.create).toHaveBeenCalledTimes(1)
  })

  it('replays the original owned entry without another write', async () => {
    const key = 'steps-intent-1'
    const normalizedDate = new Date(date)
    normalizedDate.setHours(0, 0, 0, 0)
    const fingerprint = JSON.stringify({ steps: 8000, date: normalizedDate.toISOString() })
    const entry = { id: 'steps-1', userId: 'user-1', steps: 8000, date: normalizedDate }
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({ fingerprint, resourceId: entry.id })
    ;(prisma.fitnessEntry.findFirst as jest.Mock).mockResolvedValue(entry)

    const response = await POST(request({ steps: 8000, date }, key) as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect((await response.json()).data.id).toBe(entry.id)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects negative or non-finite values', async () => {
    const response = await POST(request({ steps: -1 }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid steps value' })
  })
})
