/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('date-fns', () => ({ isSameDay: jest.fn(() => false), parseISO: jest.fn() }))
jest.mock('@/lib/twin-signal', () => ({ emitTwinSignal: jest.fn() }))
jest.mock('@/lib/task-calendar-sync', () => ({ syncTaskToCalendars: jest.fn() }))
jest.mock('@/lib/task-checklist-sync', () => ({ syncTaskChecklist: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    task: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    checklistItem: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

function request(key?: string) {
  return new Request('http://localhost/api/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: JSON.stringify({ title: 'Plan launch', status: 'todo', priority: 'high', tags: [] }),
  })
}

describe('task creation idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mutationRequest.create as jest.Mock).mockResolvedValue({ id: 'request-1' })
    ;(prisma.mutationRequest.update as jest.Mock).mockResolvedValue({ id: 'request-1' })
    ;(prisma.task.create as jest.Mock).mockResolvedValue({ id: 'task-1', title: 'Plan launch', userId: 'user-1' })
  })

  it('atomically records a create intent and task', async () => {
    const response = await POST(request('task-intent-1') as never)

    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.task.create).toHaveBeenCalledTimes(1)
  })

  it('returns the owned task for the same request key', async () => {
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint: JSON.stringify({ title: 'Plan launch', status: 'todo', priority: 'high', dueDate: null, projectId: null, tags: [] }),
      resourceId: 'task-1',
    })
    ;(prisma.task.findFirst as jest.Mock).mockResolvedValue({ id: 'task-1', title: 'Plan launch', userId: 'user-1' })

    const response = await POST(request('task-intent-1') as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(prisma.task.create).not.toHaveBeenCalled()
  })
})
