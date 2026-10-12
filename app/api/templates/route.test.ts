/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    template: { create: jest.fn(), findFirst: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const payload = {
  name: 'Weekly review',
  description: 'Close the loop',
  type: 'routine',
  category: 'productivity',
  content: { tasks: [{ text: 'Review the week' }] },
  isPublic: false,
}

function request(key?: string, body = payload) {
  return new Request('http://localhost/api/templates', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('template creation idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mutationRequest.create as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.mutationRequest.update as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.template.create as jest.Mock).mockResolvedValue({ id: 'template-1', ...payload })
    ;(prisma.template.findFirst as jest.Mock).mockResolvedValue({ id: 'template-1', ...payload })
  })

  it('creates one template and records the intent key atomically', async () => {
    const response = await POST(request('template-create-1') as never)

    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
    expect((await response.json()).template.id).toBe('template-1')
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.mutationRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        scope: 'template_create',
        idempotencyKey: 'template-create-1',
        resourceType: 'template',
      }),
    }))
  })

  it('replays the owned template without creating another row', async () => {
    const first = await POST(request('template-create-1') as never)
    const fingerprint = (prisma.mutationRequest.create as jest.Mock).mock.calls[0][0].data.fingerprint
    expect(first.status).toBe(201)

    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint,
      resourceType: 'template',
      resourceId: 'template-1',
    })

    const replay = await POST(request('template-create-1') as never)
    expect(replay.status).toBe(200)
    expect(replay.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(prisma.template.create).toHaveBeenCalledTimes(1)
  })

  it('rejects reusing a key for a different template payload', async () => {
    const first = await POST(request('template-create-1') as never)
    const fingerprint = (prisma.mutationRequest.create as jest.Mock).mock.calls[0][0].data.fingerprint
    expect(first.status).toBe(201)

    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint,
      resourceType: 'template',
      resourceId: 'template-1',
    })

    const conflicting = await POST(request('template-create-1', { ...payload, name: 'Different' }) as never)
    expect(conflicting.status).toBe(409)
    expect(prisma.template.create).toHaveBeenCalledTimes(1)
  })

  it('returns a validation error before touching the database', async () => {
    const response = await POST(request('template-create-invalid', { ...payload, name: '' }) as never)
    expect(response.status).toBe(400)
    expect(prisma.template.create).not.toHaveBeenCalled()
  })
})
