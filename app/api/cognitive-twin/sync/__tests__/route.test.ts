jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init) },
}))
jest.mock('@/lib/prisma', () => ({
  prisma: (() => {
    const prismaMock: any = {
    cognitiveTwinRecord: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    twinEvolutionLog: { deleteMany: jest.fn() },
    twinSnapshot: { deleteMany: jest.fn() },
    twinAgentLog: { deleteMany: jest.fn() },
    }
    prismaMock.$transaction = jest.fn(async (callback: (tx: any) => unknown) => callback(prismaMock))
    return prismaMock
  })(),
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GET, POST } from '../route'

describe('Cognitive Twin sync validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('hydrates only the current Twin profile on the lightweight GET path', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue({
      id: 'twin-1',
      userId: 'user-1',
      confidenceScore: 0.8,
      trustLevel: 'established',
      isInitialized: true,
      onboardingCompletedAt: new Date('2026-09-16T00:00:00.000Z'),
      longTermGoal: 'Ship Novo',
      identity: {},
      energyCurve: {},
      metrics: {},
      bottlenecks: {},
      workspaceLayout: {},
      totalSignals: 12,
      updatedAt: new Date('2026-09-16T00:00:00.000Z'),
    })

    const response = await GET(new Request('http://localhost/api/cognitive-twin/sync') as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.twin).toEqual(expect.objectContaining({ id: 'twin-1', totalSignals: 12 }))
    expect(payload.twin.evolutionLog).toBeUndefined()
    expect(payload.twin.snapshots).toBeUndefined()
    expect(prisma.cognitiveTwinRecord.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: expect.objectContaining({
        id: true,
        updatedAt: true,
        totalSignals: true,
      }),
    })
  })

  it('rejects unknown top-level fields before touching Prisma', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const request = new Request('http://localhost/api/cognitive-twin/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identity: {}, unsupportedMutation: true }),
    })

    const response = await POST(request as never)

    expect(response.status).toBe(400)
    expect(prisma.cognitiveTwinRecord.findUnique).not.toHaveBeenCalled()
    expect(prisma.cognitiveTwinRecord.upsert).not.toHaveBeenCalled()
  })

  it('backfills onboarding completion for an initialized legacy Twin', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.cognitiveTwinRecord.upsert as jest.Mock).mockResolvedValue({
        id: 'twin-1',
        userId: 'user-1',
        isInitialized: true,
        onboardingCompletedAt: null,
      })
    ;(prisma.cognitiveTwinRecord.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    const request = new Request('http://localhost/api/cognitive-twin/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isInitialized: true }),
    })

    const response = await POST(request as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.twin.onboardingCompletedAt).not.toBeNull()
    expect(prisma.cognitiveTwinRecord.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', onboardingCompletedAt: null },
    }))
    expect(prisma.cognitiveTwinRecord.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1' },
      create: expect.objectContaining({ userId: 'user-1', isInitialized: true }),
      update: expect.objectContaining({ isInitialized: true }),
    }))
  })

  it('resets derived learning on the server while preserving raw signals', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue({ id: 'twin-1' })
    ;(prisma.twinEvolutionLog.deleteMany as jest.Mock).mockResolvedValue({ count: 3 })
    ;(prisma.twinSnapshot.deleteMany as jest.Mock).mockResolvedValue({ count: 2 })
    ;(prisma.twinAgentLog.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.cognitiveTwinRecord.update as jest.Mock).mockResolvedValue({
      id: 'twin-1',
      userId: 'user-1',
      confidenceScore: 0,
      trustLevel: 'initial',
      isInitialized: false,
      onboardingCompletedAt: null,
      longTermGoal: '',
      identity: {},
      energyCurve: {},
      metrics: {},
      bottlenecks: {},
      workspaceLayout: {},
      totalSignals: 0,
    })
    const request = new Request('http://localhost/api/cognitive-twin/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reset: true }),
    })

    const response = await POST(request as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.twin).toEqual(expect.objectContaining({ confidenceScore: 0, isInitialized: false, totalSignals: 0 }))
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.twinEvolutionLog.deleteMany).toHaveBeenCalledWith({ where: { twinId: 'twin-1', userId: 'user-1' } })
    expect(prisma.twinSnapshot.deleteMany).toHaveBeenCalledWith({ where: { twinId: 'twin-1', userId: 'user-1' } })
    expect(prisma.twinAgentLog.deleteMany).toHaveBeenCalledWith({ where: { twinId: 'twin-1', userId: 'user-1' } })
  })

  it('rejects mixing a reset with profile updates', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const request = new Request('http://localhost/api/cognitive-twin/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reset: true, metrics: {} }),
    })

    const response = await POST(request as never)

    expect(response.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
