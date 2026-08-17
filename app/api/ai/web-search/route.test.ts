/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/rate-limit', () => ({ rateLimit: jest.fn(() => ({ allowed: true })), rateLimitResponse: jest.fn() }))

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { POST } from './route'

describe('POST /api/ai/web-search safe provider boundary', () => {
  const priorKey = process.env.SERPAPI_API_KEY

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.SERPAPI_API_KEY
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a' } })
  })

  afterAll(() => {
    if (priorKey) process.env.SERPAPI_API_KEY = priorKey
  })

  it('does not expose provider configuration details when search is unavailable', async () => {
    const response = await POST(new NextRequest('http://localhost/api/ai/web-search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'private project query' }),
    }))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({ error: 'SearchUnavailable', message: 'La búsqueda no está disponible en este momento.' })
    expect(JSON.stringify(body)).not.toContain('SERPAPI_API_KEY')
  })
})
