/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    aIConversation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const payload = {
  id: 'conversation-1',
  title: 'Plan semanal',
  messages: [{ id: 'message-1', role: 'user', content: 'Organiza mi semana' }],
}

function request(body = payload) {
  return new Request('http://localhost/api/ai-conversations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('AI conversation creation idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('creates a conversation once for a stable client id', async () => {
    ;(prisma.aIConversation.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.aIConversation.create as jest.Mock).mockResolvedValue({ ...payload, userId: 'user-1' })

    const response = await POST(request() as never)

    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
    expect(prisma.aIConversation.create).toHaveBeenCalledTimes(1)
    expect(prisma.aIConversation.create).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true, revision: true } }))
  })

  it('replays the owned row instead of creating a duplicate', async () => {
    ;(prisma.aIConversation.findFirst as jest.Mock).mockResolvedValue({ ...payload, userId: 'user-1' })

    const response = await POST(request() as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(await response.json()).toMatchObject({ id: payload.id, userId: 'user-1' })
    expect(prisma.aIConversation.create).not.toHaveBeenCalled()
  })
  it('keeps the stored messages available for recovery of an idempotent create', async () => {
    ;(prisma.aIConversation.findFirst as jest.Mock).mockResolvedValue({ ...payload, userId: 'user-1', revision: 7 })
    const response = await POST(request() as never)
    expect(await response.json()).toMatchObject({ messages: payload.messages, revision: 7 })
  })
})
