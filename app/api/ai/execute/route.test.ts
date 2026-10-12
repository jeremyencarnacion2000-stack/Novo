/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/ai/executor', () => ({
  executeAIAction: jest.fn(),
  pickDisplayableFields: jest.fn(() => ({})),
  toSafeActionErrorCode: (error: unknown) => error === 'Free plan monthly AI action limit reached' ? error : 'ACTION_FAILED',
}))

import { getServerSession } from 'next-auth'
import { executeAIAction } from '@/lib/ai/executor'
import { POST } from './route'

describe('POST /api/ai/execute safety boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  })

  it.each(['UPDATE_COGNITIVE_STATE', 'COGNITIVE_PIPELINE'])('requires Novo Loop confirmation for %s', async (type) => {
    const response = await POST(new Request('http://localhost/api/ai/execute', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: { type, payload: {} } }),
    }) as any)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'ConfirmationRequired' })
    expect(executeAIAction).not.toHaveBeenCalled()
  })

  it('rejects malformed idempotency keys before executing an action', async () => {
    const response = await POST(new Request('http://localhost/api/ai/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'x'.repeat(129) },
      body: JSON.stringify({ action: { type: 'CREATE_TASK', payload: { title: 'One' } } }),
    }) as any)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'InvalidIdempotencyKey' })
    expect(executeAIAction).not.toHaveBeenCalled()
  })

  it('forwards a valid idempotency key to the executor', async () => {
    ;(executeAIAction as jest.Mock).mockResolvedValue({ success: true, message: 'ok', data: {} })
    const response = await POST(new Request('http://localhost/api/ai/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'ai-intent-1' },
      body: JSON.stringify({ action: { type: 'CREATE_TASK', payload: { title: 'One' } } }),
    }) as any)

    expect(response.status).toBe(200)
    expect(executeAIAction).toHaveBeenCalledWith(
      { type: 'CREATE_TASK', payload: { title: 'One' } },
      'user-1',
      undefined,
      'ai-intent-1',
    )
  })

  it('does not expose executor or provider diagnostics in the response code', async () => {
    ;(executeAIAction as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Prisma connection string and provider token must not be returned',
      message: 'No se pudo completar la acción.',
    })

    const response = await POST(new Request('http://localhost/api/ai/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: { type: 'SEND_EMAIL', payload: {} } }),
    }) as any)
    const body = await response.json()

    expect(body.code).toBe('ACTION_FAILED')
    expect(JSON.stringify(body)).not.toContain('Prisma connection string')
    expect(JSON.stringify(body)).not.toContain('provider token')
  })

  it('keeps the stable free-plan code used by the paywall', async () => {
    ;(executeAIAction as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Free plan monthly AI action limit reached',
      message: 'Límite alcanzado.',
    })

    const response = await POST(new Request('http://localhost/api/ai/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: { type: 'CREATE_TASK', payload: { title: 'One' } } }),
    }) as any)

    await expect(response.json()).resolves.toMatchObject({ code: 'Free plan monthly AI action limit reached' })
  })
})
