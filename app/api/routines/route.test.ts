/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    routine: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const payload = { name: 'Morning reset', description: '', timeOfDay: 'morning', duration: 20, scheduledTime: '07:30', daysOfWeek: '["monday","friday"]', isActive: true, tasks: [], days: [] }

function request(key?: string) {
  return new Request('http://localhost/api/routines', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: JSON.stringify(payload),
  })
}

describe('routine creation idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mutationRequest.create as jest.Mock).mockResolvedValue({ id: 'request-1' })
    ;(prisma.mutationRequest.update as jest.Mock).mockResolvedValue({ id: 'request-1' })
    ;(prisma.routine.create as jest.Mock).mockResolvedValue({ id: 'routine-1', ...payload })
  })

  it('creates one routine under a durable key', async () => {
    const response = await POST(request('routine-intent-1') as never)
    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('replays the owned routine rather than creating another', async () => {
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint: JSON.stringify({ name: 'Morning reset', description: '', timeOfDay: 'morning', duration: 20, scheduledTime: '07:30', daysOfWeek: '["monday","friday"]', tasks: [], objective: undefined, frequency: undefined, level: undefined, tempo: undefined, method: undefined, isActive: true, days: [] }),
      resourceId: 'routine-1',
    })
    ;(prisma.routine.findFirst as jest.Mock).mockResolvedValue({ id: 'routine-1', ...payload })
    const response = await POST(request('routine-intent-1') as never)
    expect(response.status).toBe(200)
    expect(prisma.routine.create).not.toHaveBeenCalled()
  })
})
