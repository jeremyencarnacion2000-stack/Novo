/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(() => ({ allowed: true })),
  rateLimitResponse: jest.fn(),
}))
jest.mock('@google-cloud/vision', () => ({
  ImageAnnotatorClient: jest.fn(),
}))

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { POST } from './route'

describe('POST /api/ai/analyze-image request boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('rejects malformed JSON before constructing the Vision client', async () => {
    const response = await POST(new NextRequest('http://localhost/api/ai/analyze-image', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not-json',
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid image request' })
  })

  it('rejects oversized and ambiguous image sources', async () => {
    const response = await POST(new NextRequest('http://localhost/api/ai/analyze-image', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageUrl: 'https://example.com/image.png', imageBase64: 'x' }),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid image request' })
  })

  it('rejects a body larger than the image budget before parsing', async () => {
    const response = await POST(new NextRequest('http://localhost/api/ai/analyze-image', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '8000001' },
      body: JSON.stringify({ imageBase64: 'x' }),
    }))

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({ error: 'Image payload is too large' })
  })
})
