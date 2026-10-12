/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    chatSession: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}))
jest.mock('@/lib/provider-sync-lock', () => ({
  withProviderSyncLock: jest.fn(async (db: unknown, _key: string, work: (transactionDb: unknown) => Promise<unknown>) => work(db)),
}))

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const chatSession = (prisma as any).chatSession

describe('POST /api/ai/chat-session', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('requires an authenticated user', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const response = await POST(new NextRequest('http://localhost/api/ai/chat-session', {
      method: 'POST',
      body: JSON.stringify({ messages: [] }),
    }))

    expect(response.status).toBe(401)
    expect(chatSession.create).not.toHaveBeenCalled()
  })

  it('rejects malformed or oversized histories before touching the database', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a' } })

    const malformed = await POST(new NextRequest('http://localhost/api/ai/chat-session', {
      method: 'POST',
      body: JSON.stringify({ messages: 'not-an-array' }),
    }))
    expect(malformed.status).toBe(400)

    const oversized = await POST(new NextRequest('http://localhost/api/ai/chat-session', {
      method: 'POST',
      body: JSON.stringify({ messages: ['x'.repeat(1_000_001)] }),
    }))
    expect(oversized.status).toBe(413)
    expect(chatSession.findFirst).not.toHaveBeenCalled()
  })

  it('serializes the single floating session and updates it on retry', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a' } })
    const created = { id: 'session-a', userId: 'user-a', title: 'Floating Chat', messages: '[]' }
    const updated = { ...created, messages: '[{"role":"user","content":"hello"}]' }
    chatSession.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(created)
    chatSession.create.mockResolvedValue(created)
    chatSession.update.mockResolvedValue(updated)

    const first = await POST(new NextRequest('http://localhost/api/ai/chat-session', {
      method: 'POST',
      body: JSON.stringify({ messages: [] }),
    }))
    const second = await POST(new NextRequest('http://localhost/api/ai/chat-session', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    }))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(chatSession.create).toHaveBeenCalledTimes(1)
    expect(chatSession.update).toHaveBeenCalledTimes(1)
  })
})
