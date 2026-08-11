import { applyGraphLens } from '../lenses'
import { assignStablePositions, hashToUnitPair } from '../layout'
import { classifyLedgerReliability } from '../evidence'
import type { CognitiveGraphEdge, CognitiveGraphNode } from '../types'

const node = (id: string, kind: CognitiveGraphNode['kind']): CognitiveGraphNode => ({
  id, kind, label: id, relevance: 0.5, confidence: 'high', evidenceIds: [], actionIds: [],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  isInferred: false, isCorrectable: true, isExcluded: false, isStale: false,
})

const edge = (source: string, target: string): CognitiveGraphEdge => ({
  id: `${source}->${target}`, source, target, kind: 'supports', weight: 0.5,
  confidence: 'high', evidenceIds: [], isInferred: false, isActive: true,
})

describe('cognitive graph contract', () => {
  it('keeps stable positions for the same ids', () => {
    expect(hashToUnitPair('goal:one')).toEqual(hashToUnitPair('goal:one'))
    expect(assignStablePositions([node('goal:one', 'objective')])).toEqual(assignStablePositions([node('goal:one', 'objective')]))
  })

  it('filters goals and preserves their connected context', () => {
    const result = applyGraphLens({
      nodes: [node('twin:1', 'twin'), node('goal:1', 'objective'), node('task:1', 'action'), node('memory:1', 'memory')],
      edges: [edge('twin:1', 'goal:1'), edge('goal:1', 'task:1'), edge('twin:1', 'memory:1')],
      lens: 'goals', focusNodeId: undefined, depth: 2,
    })
    expect(result.nodes.map((item) => item.id)).toEqual(expect.arrayContaining(['goal:1', 'task:1']))
    expect(result.nodes.map((item) => item.id)).not.toContain('memory:1')
    expect(result.edges.every((item) => result.nodes.some((nodeItem) => nodeItem.id === item.source) && result.nodes.some((nodeItem) => nodeItem.id === item.target))).toBe(true)
  })

  it('classifies user-reported signals as the most reliable evidence', () => {
    expect(classifyLedgerReliability('user_reported')).toEqual({ classification: 'user_reported', reliability: 'high' })
    expect(classifyLedgerReliability('inference')).toEqual({ classification: 'model_inference', reliability: 'low' })
  })
})
