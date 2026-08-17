/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/gemini', () => ({ geminiAPI: { generateResponse: jest.fn() } }))
jest.mock('@/lib/ai-functions', () => ({ AI_FUNCTION_DECLARATIONS: [], executeFunctionCall: jest.fn() }))

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { geminiAPI } from '@/lib/gemini'
import { executeFunctionCall } from '@/lib/ai-functions'
import { POST } from './route'

describe('POST /api/ai/command safe failures', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns a safe error without an internal stack for malformed JSON', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a' } })
    const response = await POST(new NextRequest('http://localhost/api/ai/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ command parser detail',
    }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'InternalError', message: 'No se pudo completar la solicitud de IA.' })
    expect(JSON.stringify(body)).not.toContain('command parser detail')
    expect(body.details).toBeUndefined()
  })

  it('does not execute provider-selected functions without a confirmation surface', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a' } })
    ;(geminiAPI.generateResponse as jest.Mock).mockResolvedValue({
      content: 'I will create it',
      functionCalls: [{ name: 'create_task', args: { title: 'Private task' } }],
    })

    const response = await POST(new NextRequest('http://localhost/api/ai/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Crea una tarea privada' }),
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.requiresConfirmation).toBe(true)
    expect(executeFunctionCall).not.toHaveBeenCalled()
    expect(JSON.stringify(body)).not.toContain('Private task')
  })
})
