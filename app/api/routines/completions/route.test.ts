/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/twin-signal', () => ({ emitTwinSignal: jest.fn() }))
jest.mock('@/lib/analytics-server', () => ({ trackServerCompletion: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    routine: { findFirst: jest.fn(), findMany: jest.fn() },
    routineCompletion: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { emitTwinSignal } from '@/lib/twin-signal'
import { trackServerCompletion } from '@/lib/analytics-server'
import { prisma } from '@/lib/prisma'
import { GET, POST } from './route'

const userId = 'user-1'
const routine = { id: 'routine-1', userId, name: 'Morning reset' }
const completion = { id: 'completion-1', routineId: routine.id, tasksTotal: 4, tasksCompleted: 3 }
const body = { routineId: routine.id, tasksTotal: 4, tasksCompleted: 3 }

function request(key = 'routine-completion-intent-1') {
  return new Request('http://localhost/api/routines/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(body),
  })
}

describe('routine completion idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: userId } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: userId })
    ;(prisma.routine.findFirst as jest.Mock).mockResolvedValue(routine)
    ;(prisma.routine.findMany as jest.Mock).mockResolvedValue([routine])
    ;(prisma.routineCompletion.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mutationRequest.create as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.mutationRequest.update as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.routineCompletion.create as jest.Mock).mockResolvedValue(completion)
    ;(prisma.routineCompletion.findFirst as jest.Mock).mockResolvedValue(completion)
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
  })

  it('creates one completion and emits one Twin signal', async () => {
    const response = await POST(request() as never)
    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
    expect(prisma.routineCompletion.create).toHaveBeenCalledTimes(1)
    expect(emitTwinSignal).toHaveBeenCalledTimes(1)
    expect(trackServerCompletion).toHaveBeenCalledTimes(1)
  })

  it('replays the owned completion without creating or signaling again', async () => {
    const day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()]
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint: JSON.stringify({ routineId: routine.id, tasksTotal: 4, tasksCompleted: 3, scheduledDay: day }),
      resourceId: completion.id,
    })
    const response = await POST(request() as never)
    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(prisma.routineCompletion.create).not.toHaveBeenCalled()
    expect(emitTwinSignal).not.toHaveBeenCalled()
    expect(trackServerCompletion).not.toHaveBeenCalled()
  })

  it('rejects reusing a key with a different payload', async () => {
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({ fingerprint: 'different', resourceId: completion.id })
    const response = await POST(request() as never)
    expect(response.status).toBe(409)
    expect(prisma.routineCompletion.create).not.toHaveBeenCalled()
  })

  it('does not read another user routine and clamps the history window', async () => {
    const response = await GET(new Request('http://localhost/api/routines/completions?routineId=other-user-routine&days=999999') as never)

    expect(response.status).toBe(404)
    expect(prisma.routineCompletion.findMany).not.toHaveBeenCalled()

    const ownResponse = await GET(new Request('http://localhost/api/routines/completions?days=999999') as never)
    expect(ownResponse.status).toBe(200)
    const query = (prisma.routineCompletion.findMany as jest.Mock).mock.calls[0]?.[0]
    expect(query.where.routineId).toEqual({ in: [routine.id] })
    expect(query.where.completedAt.gte).toBeInstanceOf(Date)
    expect(query.where.completedAt.gte.getTime()).toBeGreaterThan(Date.now() - 366 * 86_400_000)
  })
})
