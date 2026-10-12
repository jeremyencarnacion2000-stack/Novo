/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/groq', () => ({ groqAPI: { generateResponse: jest.fn() } }))
jest.mock('@/lib/openrouter', () => ({ openRouterAPI: { generateResponse: jest.fn() } }))

import { getServerSession } from 'next-auth'
import { groqAPI } from '@/lib/groq'
import { openRouterAPI } from '@/lib/openrouter'
import { POST } from './route'

describe('POST /api/onboarding/analyze', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects malformed transcripts before any provider call', async () => {
    const response = await POST(new Request('http://localhost/api/onboarding/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid onboarding transcript' })
    expect(groqAPI.generateResponse).not.toHaveBeenCalled()
    expect(openRouterAPI.generateResponse).not.toHaveBeenCalled()
  })

  it('uses local inference for anonymous previews instead of proxying to AI providers', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const response = await POST(new Request('http://localhost/api/onboarding/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        language: 'en',
        messages: [
          { role: 'assistant', content: 'What is your main goal for the next 12 months?' },
          { role: 'user', content: 'Launch my product' },
        ],
      }),
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.longTermGoal).toBe('Launch my product')
    expect(groqAPI.generateResponse).not.toHaveBeenCalled()
    expect(openRouterAPI.generateResponse).not.toHaveBeenCalled()
  })
})
