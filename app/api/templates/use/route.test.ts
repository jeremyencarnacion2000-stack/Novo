/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/templates', () => ({
  defaultTemplates: [{
    id: 'morning-routine',
    type: 'routine',
    name: 'Morning reset',
    description: 'Start clear',
    content: { tasks: [{ text: 'Water', duration: 5 }] },
  }],
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    mutationRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    routine: { create: jest.fn() },
    project: { create: jest.fn() },
    tracker: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

function request(key?: string) {
  return new Request('http://localhost/api/templates/use', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: JSON.stringify({ templateId: 'morning-routine' }),
  })
}

describe('template instantiation idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mutationRequest.create as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.mutationRequest.update as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.routine.create as jest.Mock).mockResolvedValue({ id: 'routine-1' })
  })

  it('creates one routine and records a durable request key atomically', async () => {
    const response = await POST(request('template-intent-1') as never)

    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
    expect(await response.json()).toEqual({ success: true, type: 'routine', id: 'routine-1' })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.mutationRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        scope: 'template_use',
        idempotencyKey: 'template-intent-1',
        fingerprint: 'template:morning-routine',
      }),
    }))
  })

  it('replays the original resource without creating another routine', async () => {
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint: 'template:morning-routine',
      resourceType: 'routine',
      resourceId: 'routine-1',
    })

    const response = await POST(request('template-intent-1') as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(await response.json()).toEqual({ success: true, type: 'routine', id: 'routine-1' })
    expect(prisma.routine.create).not.toHaveBeenCalled()
  })

  it('rejects a key reused for another template intent', async () => {
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint: 'template:another-template',
      resourceType: 'routine',
      resourceId: 'routine-1',
    })

    const response = await POST(request('template-intent-1') as never)

    expect(response.status).toBe(409)
    expect(prisma.routine.create).not.toHaveBeenCalled()
  })
})
