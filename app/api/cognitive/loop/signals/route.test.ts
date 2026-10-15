/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { novoSignalSourcePreference: { upsert: jest.fn() } } }))
jest.mock('@/lib/cognitive/ambient-twin-runtime', () => ({ runAmbientTwinForUser: jest.fn() }))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime'
import { POST } from './route'

describe('POST /api/cognitive/loop/signals source preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(runAmbientTwinForUser as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.novoSignalSourcePreference.upsert as jest.Mock).mockResolvedValue({ source: 'github', excludedAt: new Date('2026-10-08T00:00:00Z') })
  })

  it('lets the signed-in owner exclude the GitHub source using the same source-control contract', async () => {
    const response = await POST(new Request('http://localhost/api/cognitive/loop/signals', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'exclude_source', source: 'github', reason: 'pause sharing' }),
    }) as never)

    expect(response.status).toBe(200)
    expect(prisma.novoSignalSourcePreference.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_source: { userId: 'owner-1', source: 'github' } },
      create: expect.objectContaining({ userId: 'owner-1', source: 'github' }),
    }))
  })

  it('lets the signed-in owner exclude Codex session summaries from Twin context', async () => {
    const response = await POST(new Request('http://localhost/api/cognitive/loop/signals', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'exclude_source', source: 'codex', reason: 'pause Codex context sharing' }),
    }) as never)

    expect(response.status).toBe(200)
    expect(prisma.novoSignalSourcePreference.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_source: { userId: 'owner-1', source: 'codex' } },
      create: expect.objectContaining({ userId: 'owner-1', source: 'codex' }),
    }))
  })
})
