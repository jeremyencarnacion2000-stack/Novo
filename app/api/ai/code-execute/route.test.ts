/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(() => ({ allowed: true })),
  rateLimitResponse: jest.fn(),
}))

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { POST } from './route'

describe('POST /api/ai/code-execute request boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('rejects malformed JSON before calling the execution provider', async () => {
    const response = await POST(new NextRequest('http://localhost/api/ai/code-execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not-json',
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid code execution request' })
  })

  it('rejects oversized requests before parsing the body', async () => {
    const response = await POST(new NextRequest('http://localhost/api/ai/code-execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '256001' },
      body: JSON.stringify({ language: 'javascript', code: 'console.log(1)' }),
    }))

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({ error: 'Code execution payload is too large' })
  })

  it('rejects unknown fields instead of forwarding them to Piston', async () => {
    const response = await POST(new NextRequest('http://localhost/api/ai/code-execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ language: 'javascript', code: 'console.log(1)', version: '*' }),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid code execution request' })
  })
})
