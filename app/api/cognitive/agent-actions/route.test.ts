jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init) },
}))
jest.mock('@/lib/cognitive/twin-agent', () => ({ runTwinAgent: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cognitiveTwinRecord: { findUnique: jest.fn() },
    twinAgentLog: { findMany: jest.fn() },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { runTwinAgent } from '@/lib/cognitive/twin-agent'
import { POST, GET } from './route'

describe('Twin Agent proposal surface', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns a confirmation-gated proposal payload instead of hiding Twin state', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(runTwinAgent as jest.Mock).mockResolvedValue([])
    ;(prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue({
      confidenceScore: 64,
      trustLevel: 'learning',
      identity: { adaptationPolicy: { proposals: [{ id: 'keep_confirmation_boundary', reason: 'calibrating', behavior: 'confirm first' }] } },
    })

    const response = await POST(new Request('http://localhost/api/cognitive/agent-actions') as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.executionMode).toBe('proposal_only')
    expect(payload.confirmationRequired).toBe(true)
    expect(payload.proposals).toEqual([expect.objectContaining({ id: 'keep_confirmation_boundary' })])
    expect(payload.summary.proposals).toBe(1)
  })

  it('returns owner-scoped logs and the same bounded proposals on GET', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.twinAgentLog.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue({ confidenceScore: 40, trustLevel: 'initial', identity: {} })

    const response = await GET(new Request('http://localhost/api/cognitive/agent-actions') as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.proposals).toEqual([])
    expect(prisma.twinAgentLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1' } }))
  })
})
