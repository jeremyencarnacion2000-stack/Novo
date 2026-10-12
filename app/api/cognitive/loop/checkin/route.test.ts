/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/cognitive/events', () => ({ trackNovoLoopEvent: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cognitiveStateSnapshot: { create: jest.fn(), findFirst: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { trackNovoLoopEvent } from '@/lib/cognitive/events'
import { createMutationFingerprint } from '@/lib/server-idempotency'
import { POST } from './route'

const payload = {
  energy: 4,
  focus: 3,
  availableMinutes: 45,
  workload: 2,
  currentContext: 'Ship the release',
  timezone: 'America/La_Paz',
}

function request(body: unknown = payload, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/cognitive/loop/checkin', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('POST /api/cognitive/loop/checkin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mutationRequest.create as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.mutationRequest.update as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.cognitiveStateSnapshot.create as jest.Mock).mockResolvedValue({ id: 'snapshot-1', userId: 'user-1', ...payload, completeness: 1 })
  })

  it('rejects malformed JSON without turning it into a server error', async () => {
    const response = await POST(new Request('http://localhost/api/cognitive/loop/checkin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    }) as never)

    expect(response.status).toBe(400)
    expect(prisma.cognitiveStateSnapshot.create).not.toHaveBeenCalled()
  })

  it('creates one snapshot and returns a replay for the same intent', async () => {
    const first = await POST(request(payload, { 'Idempotency-Key': 'checkin-intent-1' }) as never)
    expect(first.status).toBe(200)
    expect(first.headers.get('X-Idempotent-Replay')).toBe('false')
    expect(prisma.cognitiveStateSnapshot.create).toHaveBeenCalledTimes(1)
    expect(trackNovoLoopEvent).toHaveBeenCalledTimes(1)

    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint: createMutationFingerprint(payload),
      resourceId: 'snapshot-1',
    })
    ;(prisma.cognitiveStateSnapshot.findFirst as jest.Mock).mockResolvedValue({ id: 'snapshot-1', userId: 'user-1', ...payload, completeness: 1 })

    const retry = await POST(request(payload, { 'Idempotency-Key': 'checkin-intent-1' }) as never)
    expect(retry.status).toBe(200)
    expect(retry.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(prisma.cognitiveStateSnapshot.create).toHaveBeenCalledTimes(1)
    expect(trackNovoLoopEvent).toHaveBeenCalledTimes(1)
  })

  it('rejects a key reused with different check-in data', async () => {
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint: createMutationFingerprint(payload),
      resourceId: 'snapshot-1',
    })

    const response = await POST(request({ ...payload, focus: 5 }, { 'Idempotency-Key': 'checkin-intent-1' }) as never)
    expect(response.status).toBe(409)
    expect(prisma.cognitiveStateSnapshot.create).not.toHaveBeenCalled()
  })

  it('rejects oversized payloads before parsing', async () => {
    const response = await POST(request(payload, { 'content-length': '32001' }) as never)
    expect(response.status).toBe(413)
    expect(prisma.cognitiveStateSnapshot.create).not.toHaveBeenCalled()
  })
})
