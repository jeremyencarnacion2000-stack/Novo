/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/ai/executor', () => ({ executeAIAction: jest.fn(), pickDisplayableFields: jest.fn(() => ({})) }))

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
})
