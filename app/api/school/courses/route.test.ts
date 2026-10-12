/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    course: { create: jest.fn(), findFirst: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { createMutationFingerprint } from '@/lib/server-idempotency'
import { POST } from './route'

const payload = {
  name: 'Cognitive Science',
  code: 'COG101',
  credits: 3,
  semester: 'Fall',
  year: 2026,
  professor: 'Dr. Novo',
  color: '#3b82f6',
  educationType: 'university',
}

function request(key?: string) {
  return new Request('http://localhost/api/school/courses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: JSON.stringify(payload),
  })
}

describe('POST /api/school/courses idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { email: 'angel@example.com' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mutationRequest.create as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.mutationRequest.update as jest.Mock).mockResolvedValue({ id: 'mutation-1' })
    ;(prisma.course.create as jest.Mock).mockResolvedValue({ id: 'course-1', ...payload, grades: [] })
  })

  it('creates one course for a client intent', async () => {
    const response = await POST(request('course-intent-1') as never)

    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('false')
    expect(prisma.course.create).toHaveBeenCalledTimes(1)
  })

  it('replays the owned course when the response is retried', async () => {
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({
      fingerprint: createMutationFingerprint({
        userId: 'user-1', name: payload.name, code: payload.code, credits: payload.credits,
        semester: payload.semester, year: payload.year, professor: payload.professor,
        color: payload.color, educationType: payload.educationType,
      }),
      resourceId: 'course-1',
    })
    ;(prisma.course.findFirst as jest.Mock).mockResolvedValue({ id: 'course-1', ...payload, grades: [] })

    const response = await POST(request('course-intent-1') as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(prisma.course.create).not.toHaveBeenCalled()
  })
})
