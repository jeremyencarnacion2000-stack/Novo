/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(() => ({ allowed: true })),
  rateLimitResponse: jest.fn(),
}))
jest.mock('@/lib/grok', () => ({
  GrokAPIClient: { getInstance: jest.fn() },
}))

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { POST } from './route'

describe('POST /api/grok/chat request boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('rejects malformed JSON without invoking the provider', async () => {
    const response = await POST(new NextRequest('http://localhost/api/grok/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not-json',
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid chat request' })
  })

  it('rejects an oversized request before parsing', async () => {
    const response = await POST(new NextRequest('http://localhost/api/grok/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '2000001' },
      body: JSON.stringify({ message: 'hello' }),
    }))

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({ error: 'Chat payload is too large' })
  })
})
