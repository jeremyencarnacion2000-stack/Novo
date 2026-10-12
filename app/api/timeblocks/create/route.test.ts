/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findFirst: jest.fn() },
    routine: { findFirst: jest.fn() },
    mutationRequest: { findUnique: jest.fn(), create: jest.fn() },
    timeBlock: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    account: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const basePayload = {
  title: 'Deep work',
  type: 'focus',
  startTime: '2026-09-12T10:00:00.000Z',
  endTime: '2026-09-12T11:00:00.000Z',
}

function request(payload: Record<string, unknown>, idempotencyKey?: string) {
  return new Request('http://localhost/api/timeblocks/create', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(payload),
  })
}

describe('time block create route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.project.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.routine.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.account.findFirst as jest.Mock).mockResolvedValue(null)
  })

  it('creates a local block when Google Calendar is not connected', async () => {
    const created = { id: 'tb-1', ...basePayload, startTime: new Date(basePayload.startTime), endTime: new Date(basePayload.endTime), energyRequired: 'medium', googleEventId: null }
    const tx = {
      timeBlock: { create: jest.fn().mockResolvedValue(created) },
      mutationRequest: { create: jest.fn() },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx))

    const response = await POST(request(basePayload) as never)

    expect(response.status).toBe(201)
    expect((await response.json()).id).toBe('tb-1')
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('replays the owned block for the same idempotency key', async () => {
    const key = 'timeblock-intent-1'
    const fingerprint = JSON.stringify({ ...basePayload, projectId: null, routineId: null, energyRequired: 'medium' })
    const existing = { id: 'tb-1', title: basePayload.title, type: basePayload.type, startTime: new Date(basePayload.startTime), endTime: new Date(basePayload.endTime), energyRequired: 'medium', googleEventId: null }
    ;(prisma.mutationRequest.findUnique as jest.Mock).mockResolvedValue({ fingerprint, resourceId: existing.id })
    ;(prisma.timeBlock.findFirst as jest.Mock).mockResolvedValue(existing)

    const response = await POST(request(basePayload, key) as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(await response.json()).toMatchObject({ id: existing.id })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects a block whose end is not after its start', async () => {
    const response = await POST(request({ ...basePayload, endTime: basePayload.startTime }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid time block details' })
  })
})
