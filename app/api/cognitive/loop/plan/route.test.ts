/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/cognitive/canonical-planner', () => ({
  planUserContext: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { planUserContext } from '@/lib/cognitive/canonical-planner'
import { POST } from './route'

describe('POST /api/cognitive/loop/plan request boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(planUserContext as jest.Mock).mockResolvedValue({ plan: { id: 'plan-1' }, runId: 'run-1' })
  })

  it('rejects malformed JSON without invoking the planner', async () => {
    const response = await POST(new NextRequest('http://localhost/api/cognitive/loop/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not-json',
    }))

    expect(response.status).toBe(400)
    expect(planUserContext).not.toHaveBeenCalled()
  })

  it('rejects oversized payloads before parsing', async () => {
    const response = await POST(new NextRequest('http://localhost/api/cognitive/loop/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '32001' },
      body: JSON.stringify({ timezone: 'America/La_Paz' }),
    }))

    expect(response.status).toBe(413)
    expect(planUserContext).not.toHaveBeenCalled()
  })
})
