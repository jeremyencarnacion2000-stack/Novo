/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

function request(key?: string) {
  return new Request('http://localhost/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: JSON.stringify({ title: 'Website launch', description: '', status: 'not-started', priority: 'medium', subtasks: [] }),
  })
}

describe('project creation idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mutationRequest.create as jest.Mock).mockResolvedValue({ id: 'request-1' })
    ;(prisma.mutationRequest.update as jest.Mock).mockResolvedValue({ id: 'request-1' })
    ;(prisma.project.create as jest.Mock).mockResolvedValue({ id: 'project-1', title: 'Website launch', subtasks: [] })
  })

  it('creates a project once within its durable create intent', async () => {
    const response = await POST(request('project-intent-1') as never)

    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('replays the original owned project without another create', async () => {
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint: JSON.stringify({ title: 'Website launch', description: '', status: 'not-started', priority: 'medium', startDate: undefined, dueDate: undefined, progress: 0, tags: [], subtasks: [], notes: '' }),
      resourceId: 'project-1',
    })
    ;(prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'project-1', title: 'Website launch', subtasks: [] })

    const response = await POST(request('project-intent-1') as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(prisma.project.create).not.toHaveBeenCalled()
  })
})
