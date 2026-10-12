/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/cognitive/events', () => ({ trackNovoLoopEvent: jest.fn() }))
jest.mock('@/lib/cognitive/ambient-twin-runtime', () => ({ runAmbientTwinForUser: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/ai/activity', () => ({
  appendActivityEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
  createActivityRun: jest.fn().mockResolvedValue({ id: 'run-1' }),
  finishActivityRun: jest.fn().mockResolvedValue({ id: 'run-1' }),
}))
jest.mock('@/lib/cognitive/action-state-machine', () => ({
  canTransitionRecommendation: jest.fn((status: string, response: string) => status === 'proposed' && response === 'accepted'),
  isTerminalRecommendationState: jest.fn((status: string) => ['dismissed', 'completed', 'failed', 'abandoned'].includes(status)),
}))
jest.mock('@/lib/provider-sync-lock', () => ({
  withProviderSyncLock: jest.fn(async (db: unknown, _key: string, work: (tx: unknown) => Promise<unknown>) => work(db)),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    recommendedAction: { findFirst: jest.fn(), update: jest.fn() },
    outcomeEvent: { findUnique: jest.fn(), create: jest.fn() },
    task: { create: jest.fn(), updateMany: jest.fn() },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { withProviderSyncLock } from '@/lib/provider-sync-lock'
import { POST } from './route'

const actionId = 'ck1234567890123456789012345'
const baseAction = {
  id: actionId,
  userId: 'user-1',
  planId: 'plan-1',
  taskId: null,
  title: 'Prepare the release notes',
  status: 'proposed',
  plan: { id: 'plan-1' },
}

function request(idempotencyKey: string) {
  return new Request('http://localhost/api/cognitive/loop/response', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actionId, response: 'accepted', idempotencyKey }),
  })
}

describe('POST /api/cognitive/loop/response', () => {
  let actionState: typeof baseAction
  const outcomes = new Map<string, any>()

  beforeEach(() => {
    jest.clearAllMocks()
    actionState = { ...baseAction }
    outcomes.clear()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.recommendedAction.findFirst as jest.Mock).mockImplementation(async () => ({ ...actionState }))
    ;(prisma.recommendedAction.update as jest.Mock).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      actionState = { ...actionState, ...data } as typeof baseAction
      return { ...actionState }
    })
    ;(prisma.outcomeEvent.findUnique as jest.Mock).mockImplementation(async ({ where }: { where: { idempotencyKey: string } }) => outcomes.get(where.idempotencyKey) ?? null)
    ;(prisma.outcomeEvent.create as jest.Mock).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      const outcome = { id: `outcome-${outcomes.size + 1}`, ...data }
      outcomes.set(data.idempotencyKey as string, outcome)
      return outcome
    })
    ;(prisma.task.create as jest.Mock).mockResolvedValue({ id: 'task-1' })
  })

  it('serializes a recommendation transition and never creates a second task after acceptance', async () => {
    const first = await POST(request('00000000-0000-4000-8000-000000000001') as never)
    expect(first.status).toBe(200)
    expect(prisma.task.create).toHaveBeenCalledTimes(1)
    expect(actionState.taskId).toBe('task-1')

    const second = await POST(request('00000000-0000-4000-8000-000000000002') as never)
    expect(second.status).toBe(409)
    expect(prisma.task.create).toHaveBeenCalledTimes(1)
    expect(withProviderSyncLock).toHaveBeenCalledWith(prisma, `recommendation:user-1:${actionId}`, expect.any(Function))
  })
})
