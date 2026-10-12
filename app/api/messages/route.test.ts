/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    directMessage: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const senderId = 'user-1'
const recipientId = 'user-2'
const message = { id: 'message-1', senderId, receiverId: recipientId, content: 'Hello' }
const body = { receiverId: recipientId, content: 'Hello' }

function request(key = 'message-intent-1') {
  return new Request('http://localhost/api/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(body),
  })
}

describe('direct message idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: senderId } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: recipientId })
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mutationRequest.create as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.mutationRequest.update as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.directMessage.create as jest.Mock).mockResolvedValue(message)
    ;(prisma.directMessage.findFirst as jest.Mock).mockResolvedValue(message)
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
  })

  it('creates a message and marks a fresh intent', async () => {
    const response = await POST(request() as never)
    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
    expect(prisma.directMessage.create).toHaveBeenCalledTimes(1)
  })

  it('replays an owned message without creating another row', async () => {
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint: JSON.stringify(body),
      resourceId: message.id,
    })
    const response = await POST(request() as never)
    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(prisma.directMessage.create).not.toHaveBeenCalled()
  })

  it('rejects a reused key with a different payload', async () => {
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({ fingerprint: 'different', resourceId: message.id })
    const response = await POST(request() as never)
    expect(response.status).toBe(409)
    expect(prisma.directMessage.create).not.toHaveBeenCalled()
  })
})
