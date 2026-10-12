/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { workoutEntry: { create: jest.fn() } } }))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/fitness/workout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('fitness workout route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('does not expose database details on failure', async () => {
    ;(prisma.workoutEntry.create as jest.Mock).mockRejectedValue(new Error('secret database connection string'))
    const response = await POST(request({ name: 'Walk', durationMinutes: 20 }) as never)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to log workout' })
  })
})
