jest.mock('@/lib/prisma', () => ({
  prisma: {
    cognitiveTwinRecord: { findUnique: jest.fn() },
    goal: { findMany: jest.fn() },
    project: { findMany: jest.fn() },
    task: { findMany: jest.fn() },
    novoSignalLedger: { findMany: jest.fn() },
    novoSignalSourcePreference: { findMany: jest.fn() },
    recommendedAction: { findMany: jest.fn() },
    outcomeEvent: { findMany: jest.fn() },
    twinEvolutionLog: { findMany: jest.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { buildCognitiveGraphSnapshot } from '../projection'

describe('cognitive graph adaptation projection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('exposes each persisted adaptation as an evidence-backed learning node', async () => {
    ;(prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue({
      id: 'twin-1', confidenceScore: 82, trustLevel: 'adapted',
      identity: { adaptationPolicy: { proposals: [{ id: 'reduce_context_switching', reason: 'switching friction observed', behavior: 'one next step' }] } },
      bottlenecks: {}, updatedAt: new Date('2026-08-08T10:00:00.000Z'),
    })
    for (const model of [prisma.goal, prisma.project, prisma.task, prisma.novoSignalLedger, prisma.novoSignalSourcePreference, prisma.recommendedAction, prisma.outcomeEvent]) {
      ;(model.findMany as jest.Mock).mockResolvedValue([])
    }
    ;(prisma.twinEvolutionLog.findMany as jest.Mock).mockResolvedValue([{
      id: 'evolution-1', changeType: 'adaptation_policy_updated', description: 'Adaptation policy updated', createdAt: new Date('2026-08-08T10:01:00.000Z'),
    }])

    const snapshot = await buildCognitiveGraphSnapshot({ userId: 'user-1', lens: 'memory' })
    const policy = snapshot.nodes.find((node) => node.id === 'adaptation:reduce_context_switching')

    expect(policy).toEqual(expect.objectContaining({ kind: 'strategy', cluster: 'adaptation', isInferred: true, isNew: true }))
    expect(policy?.evidenceIds).toEqual(['evidence:twin-evolution:evolution-1'])
    expect(snapshot.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'twin:twin-1', target: 'adaptation:reduce_context_switching', kind: 'learned_from' }),
    ]))
  })

  it('keeps a 42/100 Twin confidence qualitative label low', async () => {
    ;(prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue({
      id: 'twin-1', confidenceScore: 42, trustLevel: 'initial', identity: {}, bottlenecks: {}, updatedAt: new Date('2026-08-08T10:00:00.000Z'),
    })
    for (const model of [prisma.goal, prisma.project, prisma.task, prisma.novoSignalLedger, prisma.novoSignalSourcePreference, prisma.recommendedAction, prisma.outcomeEvent, prisma.twinEvolutionLog]) {
      ;(model.findMany as jest.Mock).mockResolvedValue([])
    }

    const snapshot = await buildCognitiveGraphSnapshot({ userId: 'user-1', lens: 'now' })

    expect(snapshot.nodes.find((node) => node.kind === 'twin')?.confidence).toBe('low')
  })
})
