/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/analytics-server', () => ({ trackServerCompletion: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    tracker: { findFirst: jest.fn() },
    trackerEntry: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { trackServerCompletion } from '@/lib/analytics-server'
import { POST } from './route'

const params = { params: Promise.resolve({ id: 'tracker-1' }) }
const payload = { date: '2026-09-12', value: 1 }
const tracker = { id: 'tracker-1', userId: 'user-1', name: 'Deep work' }
const entry = { id: 'entry-1', trackerId: 'tracker-1', ...payload }

function request(key?: string, body = payload) {
  return new Request('http://localhost/api/trackers/tracker-1/entries', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('tracker entry idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.tracker.findFirst as jest.Mock).mockResolvedValue(tracker)
    ;(prisma.trackerEntry.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.trackerEntry.create as jest.Mock).mockResolvedValue(entry)
    ;(prisma.trackerEntry.update as jest.Mock).mockResolvedValue(entry)
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mutationRequest.create as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.mutationRequest.update as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
  })

  it('creates one entry and records the request key', async () => {
    const response = await POST(request('entry-intent-1') as never, params)

    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
    expect(prisma.trackerEntry.create).toHaveBeenCalledTimes(1)
    expect(prisma.mutationRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        scope: 'tracker_entry',
        idempotencyKey: 'entry-intent-1',
        resourceType: 'tracker_entry',
        resourceId: 'pending',
      }),
    }))
    expect(trackServerCompletion).toHaveBeenCalledTimes(1)
  })

  it('replays the owned entry without creating or tracking it again', async () => {
    const first = await POST(request('entry-intent-1') as never, params)
    const fingerprint = (prisma.mutationRequest.create as jest.Mock).mock.calls[0][0].data.fingerprint
    expect(first.status).toBe(201)

    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint,
      resourceType: 'tracker_entry',
      resourceId: 'entry-1',
    })
    ;(prisma.trackerEntry.findFirst as jest.Mock).mockResolvedValue(entry)

    const replay = await POST(request('entry-intent-1') as never, params)
    expect(replay.status).toBe(200)
    expect(replay.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(prisma.trackerEntry.create).toHaveBeenCalledTimes(1)
    expect(trackServerCompletion).toHaveBeenCalledTimes(1)
  })

  it('updates an existing date entry instead of creating another row', async () => {
    ;(prisma.trackerEntry.findFirst as jest.Mock).mockResolvedValue({ ...entry, value: 0 })

    const response = await POST(request('entry-update-1', { ...payload, value: 2 }) as never, params)
    expect(response.status).toBe(201)
    expect(prisma.trackerEntry.update).toHaveBeenCalledWith({
      where: { id: 'entry-1' },
      data: { value: 2 },
    })
    expect(prisma.trackerEntry.create).not.toHaveBeenCalled()
    expect(trackServerCompletion).not.toHaveBeenCalled()
  })

  it('rejects a reused key with a different value', async () => {
    const first = await POST(request('entry-intent-1') as never, params)
    const fingerprint = (prisma.mutationRequest.create as jest.Mock).mock.calls[0][0].data.fingerprint
    expect(first.status).toBe(201)

    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint,
      resourceType: 'tracker_entry',
      resourceId: 'entry-1',
    })

    const conflicting = await POST(request('entry-intent-1', { ...payload, value: 2 }) as never, params)
    expect(conflicting.status).toBe(409)
    expect(prisma.trackerEntry.create).toHaveBeenCalledTimes(1)
  })
})
