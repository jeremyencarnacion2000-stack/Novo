/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/ai/day-plan-generator', () => ({
  generateAndExecuteDayPlan: jest.fn(),
}))
jest.mock('@/lib/cognitive/events', () => ({
  trackNovoLoopEvent: jest.fn(),
}))

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { generateAndExecuteDayPlan } from '@/lib/ai/day-plan-generator'
import { POST } from './route'

describe('POST /api/onboarding/day-plan request boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(generateAndExecuteDayPlan as jest.Mock).mockResolvedValue({ tasks: [], event: null, reasoning: [] })
  })

  it('rejects malformed JSON before invoking the generator', async () => {
    const response = await POST(new NextRequest('http://localhost/api/onboarding/day-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not-json',
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid day plan request' })
    expect(generateAndExecuteDayPlan).not.toHaveBeenCalled()
  })

  it('rejects an oversized payload before parsing it', async () => {
    const response = await POST(new NextRequest('http://localhost/api/onboarding/day-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '32001' },
      body: JSON.stringify({ twin: {} }),
    }))

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({ error: 'Day plan payload is too large' })
    expect(generateAndExecuteDayPlan).not.toHaveBeenCalled()
  })

  it('rejects unsupported triggers rather than generating an untracked plan', async () => {
    const response = await POST(new NextRequest('http://localhost/api/onboarding/day-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ trigger: 'replay' }),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid day plan request' })
    expect(generateAndExecuteDayPlan).not.toHaveBeenCalled()
  })
})
