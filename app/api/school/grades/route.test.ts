/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    course: { findFirst: jest.fn() },
    grade: { create: jest.fn(), findFirst: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { createMutationFingerprint } from '@/lib/server-idempotency'
import { POST } from './route'

const payload = {
  courseId: 'course-1', name: 'Midterm', score: 92, maxScore: 100,
  weight: 30, category: 'Exam', date: '2026-09-15',
}

function request(key?: string) {
  return new Request('http://localhost/api/school/grades', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: JSON.stringify(payload),
  })
}

describe('POST /api/school/grades idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { email: 'angel@example.com' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(prisma.course.findFirst as jest.Mock).mockResolvedValue({ id: 'course-1', userId: 'user-1' })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mutationRequest.create as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.mutationRequest.update as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.grade.create as jest.Mock).mockResolvedValue({ id: 'grade-1', ...payload })
  })

  it('creates one grade for a client intent', async () => {
    const response = await POST(request('grade-intent-1') as never)

    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
    expect(prisma.grade.create).toHaveBeenCalledTimes(1)
  })

  it('replays the owned grade when the response is retried', async () => {
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint: createMutationFingerprint(payload),
      resourceId: 'grade-1',
    })
    ;(prisma.grade.findFirst as jest.Mock).mockResolvedValue({ id: 'grade-1', ...payload })

    const response = await POST(request('grade-intent-1') as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(prisma.grade.create).not.toHaveBeenCalled()
  })
})
