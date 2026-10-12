/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    routine: { create: jest.fn() },
    tracker: { create: jest.fn() },
    checklistItem: { create: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const payload = {
  routines: [{ name: 'Morning reset', days: [] }],
  trackers: [],
  checklists: [],
  planning: null,
}

function request(key?: string, body = payload) {
  return new Request('http://localhost/api/routines/import-batch', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('routine import batch idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mutationRequest.create as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.mutationRequest.update as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.routine.create as jest.Mock).mockResolvedValue({ id: 'routine-1', name: 'Morning reset' })
    ;(prisma.tracker.create as jest.Mock).mockResolvedValue({ id: 'tracker-1' })
    ;(prisma.checklistItem.create as jest.Mock).mockResolvedValue({ id: 'checklist-1' })
  })

  it('creates the batch and records one atomic import intent', async () => {
    const response = await POST(request('routine-import-1') as never)

    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
    expect((await response.json()).routines).toHaveLength(1)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.mutationRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        scope: 'routine_import_batch',
        idempotencyKey: 'routine-import-1',
        resourceType: 'routine_import_batch',
        resourceId: 'pending',
      }),
    }))
  })

  it('replays a completed import without creating duplicate children', async () => {
    const first = await POST(request('routine-import-1') as never)
    const fingerprint = (prisma.mutationRequest.create as jest.Mock).mock.calls[0][0].data.fingerprint
    expect(first.status).toBe(201)

    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint,
      resourceType: 'routine_import_batch',
      resourceId: 'completed',
    })

    const replay = await POST(request('routine-import-1') as never)
    expect(replay.status).toBe(200)
    expect(replay.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(prisma.routine.create).toHaveBeenCalledTimes(1)
  })

  it('rejects reusing an import key for a different payload', async () => {
    const first = await POST(request('routine-import-1') as never)
    const fingerprint = (prisma.mutationRequest.create as jest.Mock).mock.calls[0][0].data.fingerprint
    expect(first.status).toBe(201)

    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint,
      resourceType: 'routine_import_batch',
      resourceId: 'completed',
    })

    const conflicting = await POST(request('routine-import-1', {
      ...payload,
      routines: [{ name: 'Different routine', days: [] }],
    }) as never)
    expect(conflicting.status).toBe(409)
    expect(prisma.routine.create).toHaveBeenCalledTimes(1)
  })

  it('validates import size before touching the database', async () => {
    const tooManyRoutines = Array.from({ length: 51 }, (_, index) => ({ name: `Routine ${index}`, days: [] }))
    const response = await POST(request('routine-import-invalid', {
      ...payload,
      routines: tooManyRoutines,
    }) as never)

    expect(response.status).toBe(400)
    expect(prisma.routine.create).not.toHaveBeenCalled()
    expect(prisma.mutationRequest.create).not.toHaveBeenCalled()
  })
})
