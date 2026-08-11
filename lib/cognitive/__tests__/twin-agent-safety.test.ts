/** @jest-environment node */

const findUnique = jest.fn()
const groupBy = jest.fn()
const findMany = jest.fn()
const create = jest.fn()
const update = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    cognitiveTwinRecord: { findUnique },
    behavioralSignal: { groupBy },
    twinAgentLog: { findMany },
    task: { create, update },
    routine: { create },
  },
}))

describe('legacy Twin agent safety boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    findUnique.mockResolvedValue({
      id: 'twin-1', confidenceScore: 80, trustLevel: 'adapted',
      identity: {}, energyCurve: {}, metrics: { burnoutIndex: 95, currentCognitiveLoad: 95 }, bottlenecks: {},
    })
    groupBy.mockResolvedValue([{ signal: 'routine_skipped', _count: { signal: 5 } }])
    findMany.mockResolvedValue([])
  })

  it('does not perform automatic mutations from heuristic Twin metrics', async () => {
    const { runTwinAgent } = await import('../twin-agent')

    await expect(runTwinAgent('user-1')).resolves.toEqual([])

    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
})
