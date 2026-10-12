/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    quickNote: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    project: { findFirst: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const payload = { content: 'Call the client tomorrow', type: 'reminder', tags: ['work'], color: 'bg-blue-500' }

function request(key?: string) {
  return new Request('http://localhost/api/notes', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: JSON.stringify(payload),
  })
}

describe('note creation contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mutationRequest.create as jest.Mock).mockResolvedValue({ id: 'request-1' })
    ;(prisma.mutationRequest.update as jest.Mock).mockResolvedValue({ id: 'request-1' })
    ;(prisma.quickNote.create as jest.Mock).mockResolvedValue({ id: 'note-1', userId: 'user-1', ...payload })
  })

  it('preserves the capture type and creates it under a durable key', async () => {
    const response = await POST(request('note-intent-1'))
    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
    expect(prisma.quickNote.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'reminder' }),
    }))
  })

  it('returns the same owned note for a retried capture', async () => {
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint: JSON.stringify({ content: 'Call the client tomorrow', type: 'reminder', tags: ['work'], color: 'bg-blue-500', projectId: null, dueDate: null }),
      resourceId: 'note-1',
    })
    ;(prisma.quickNote.findFirst as jest.Mock).mockResolvedValue({ id: 'note-1', userId: 'user-1', ...payload })

    const response = await POST(request('note-intent-1'))
    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(prisma.quickNote.create).not.toHaveBeenCalled()
  })

  it('rejects attribution to another user’s project', async () => {
    ;(prisma.project.findFirst as jest.Mock).mockResolvedValue(null)
    const response = await POST(new Request('http://localhost/api/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, projectId: 'project-from-another-user' }),
    }))
    expect(response.status).toBe(404)
    expect(prisma.quickNote.create).not.toHaveBeenCalled()
  })
})
