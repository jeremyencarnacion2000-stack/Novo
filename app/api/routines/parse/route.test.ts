/** @jest-environment node */

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/groq', () => ({ groqAPI: { generateResponse: jest.fn() } }))
jest.mock('@/lib/openrouter', () => ({ openRouterAPI: { generateResponse: jest.fn() } }))
jest.mock('@/lib/chutes', () => ({ chutesAPI: { generateResponse: jest.fn() } }))

import { getServerSession } from 'next-auth/next'
import { groqAPI } from '@/lib/groq'
import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/routines/parse', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('routine parser request boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(groqAPI.generateResponse as jest.Mock).mockResolvedValue({
      content: JSON.stringify({ planning: null, routines: [], trackers: [], checklists: [] }),
    })
  })

  it('rejects a missing or non-string document before calling a provider', async () => {
    const response = await POST(request({ text: { value: 'not text' } }) as never)

    expect(response.status).toBe(400)
    expect(groqAPI.generateResponse).not.toHaveBeenCalled()
  })

  it('rejects oversized documents before duplicating them into provider prompts', async () => {
    const response = await POST(request({ text: 'x'.repeat(40_001) }) as never)

    expect(response.status).toBe(413)
    expect(groqAPI.generateResponse).not.toHaveBeenCalled()
  })

  it('accepts a bounded document and parses it normally', async () => {
    const response = await POST(request({ text: 'Rutina de mañana\n- Beber agua' }) as never)

    expect(response.status).toBe(200)
    expect(groqAPI.generateResponse).toHaveBeenCalledTimes(1)
  })
})
