/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { POST } from './route'

const session = { user: { id: 'user-a' } }
const mutationFindUnique = jest.fn()
const mutationCreate = jest.fn()
const mutationUpdate = jest.fn()
const focusCreate = jest.fn()
const focusFindFirst = jest.fn()
const tx = {
  mutationRequest: { create: (...args: unknown[]) => mutationCreate(...args), update: (...args: unknown[]) => mutationUpdate(...args) },
  focusSession: { create: (...args: unknown[]) => focusCreate(...args) },
}

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/twin-signal', () => ({ emitTwinSignal: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    mutationRequest: {
      findUnique: (...args: unknown[]) => mutationFindUnique(...args),
      create: (...args: unknown[]) => mutationCreate(...args),
      update: (...args: unknown[]) => mutationUpdate(...args),
    },
    focusSession: {
      create: (...args: unknown[]) => focusCreate(...args),
      findFirst: (...args: unknown[]) => focusFindFirst(...args),
    },
    $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
  },
}))

const auth = getServerSession as jest.MockedFunction<typeof getServerSession>

function request(body: Record<string, unknown>, key = 'focus-intent-1') {
  return new NextRequest('http://localhost/api/focus-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(body),
  })
}

describe('focus session idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    auth.mockResolvedValue(session as never)
    mutationFindUnique.mockResolvedValue(null)
    mutationCreate.mockResolvedValue({ id: 'mutation-1' })
    mutationUpdate.mockResolvedValue({})
    focusCreate.mockResolvedValue({ id: 'focus-1', userId: 'user-a', duration: 25 })
    focusFindFirst.mockResolvedValue({ id: 'focus-1', userId: 'user-a', duration: 25 })
  })

  it('creates once and returns the stored session on a repeated intent', async () => {
    const body = { event: 'finished', duration: 25, quality: 4, sessionType: 'work' }
    const first = await POST(request(body))
    expect(first.status).toBe(201)

    mutationFindUnique.mockResolvedValue({
      fingerprint: JSON.stringify({ event: 'finished', duration: 25, quality: 4, taskTitle: null, sessionType: 'work', taskId: null, interrupted: false }),
      resourceId: 'focus-1',
    })
    const second = await POST(request(body))
    expect(second.status).toBe(200)
    expect(second.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(focusCreate).toHaveBeenCalledTimes(1)
  })

  it('rejects reusing a key with a different payload', async () => {
    mutationFindUnique.mockResolvedValue({ fingerprint: 'different', resourceId: 'focus-1' })
    const response = await POST(request({ event: 'finished', duration: 50 }))
    expect(response.status).toBe(409)
    expect(focusCreate).not.toHaveBeenCalled()
  })
})
