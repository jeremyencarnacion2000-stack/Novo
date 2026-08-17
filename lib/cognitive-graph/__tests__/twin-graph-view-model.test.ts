import { buildTwinGraphViewModel } from '../twin-graph-view-model'
import type { CognitiveGraphSnapshot } from '../types'

const snapshot = (): CognitiveGraphSnapshot => ({
  id: 'snapshot:qa',
  generatedAt: '2026-08-15T10:00:00.000Z',
  policyVersion: 'cognitive-policy-v2',
  lens: 'now',
  nodes: [
    node('twin:qa', 'twin', 'Tu Gemelo', 1),
    node('goal:launch', 'objective', 'Lanzar Novo', .94, { evidenceIds: ['e:goal'] }),
    node('pattern:switching', 'pattern', 'Cambio de contexto', .92, { isInferred: true, evidenceIds: ['e:switch-1', 'e:switch-2'], status: 'emerging' }),
    node('signal:deadline', 'signal', 'Fecha límite de demo', .86, { evidenceIds: ['e:deadline'] }),
    node('outcome:session', 'outcome', 'Sesión interrumpida', .72, { evidenceIds: ['e:session'] }),
    node('action:finish', 'action', 'Terminar demo', .82),
    node('memory:old', 'memory', 'Preferencia archivada', .21),
    node('signal:excluded', 'signal', 'Señal excluida', .99, { isExcluded: true }),
  ],
  edges: [
    edge('goal:launch', 'pattern:switching', 'supports'),
    edge('outcome:session', 'pattern:switching', 'learned_from'),
    edge('pattern:switching', 'action:finish', 'recommended_for'),
    edge('signal:deadline', 'goal:launch', 'supports'),
  ],
  evidence: [],
  changes: { addedNodeIds: [], changedNodeIds: ['pattern:switching'], removedNodeIds: [] },
  recommendation: {
    id: 'recommendation:finish',
    title: 'Termina el flujo de la demo',
    nextStep: 'Reserva 35 minutos para cerrar la ruta crítica.',
    rationale: 'Evita otro cambio de contexto antes de la demo.',
    actionLabel: 'Comenzar',
    confidence: 'high',
    facts: ['La demo está cerca'],
    inferences: ['Cambiar de tarea puede retrasarla'],
    evidenceIds: ['e:switch-1'],
  },
})

function node(
  id: string,
  kind: CognitiveGraphSnapshot['nodes'][number]['kind'],
  label: string,
  relevance: number,
  overrides: Partial<CognitiveGraphSnapshot['nodes'][number]> = {},
) {
  return {
    id,
    kind,
    label,
    relevance,
    confidence: 'high' as const,
    evidenceIds: [],
    actionIds: [],
    createdAt: '2026-08-15T10:00:00.000Z',
    updatedAt: '2026-08-15T10:00:00.000Z',
    isInferred: false,
    isCorrectable: true,
    isExcluded: false,
    isStale: false,
    ...overrides,
  }
}

function edge(source: string, target: string, kind: CognitiveGraphSnapshot['edges'][number]['kind']) {
  return { id: `${source}:${target}:${kind}`, source, target, kind, weight: .8, confidence: 'high' as const, evidenceIds: [], isInferred: false, isActive: true }
}

describe('buildTwinGraphViewModel', () => {
  it('derives a bounded current field from canonical graph data without persisting another model', () => {
    const view = buildTwinGraphViewModel(snapshot())

    expect(view.anchor.label).toBe('Contexto actual')
    expect(view.dominantContexts.map((item) => item.node.id)).toEqual(expect.arrayContaining(['goal:launch', 'pattern:switching', 'signal:deadline']))
    expect(view.dominantContexts).toHaveLength(5)
    expect(view.dominantContexts.map((item) => item.node.id)).not.toContain('twin:qa')
    expect(view.dominantContexts.map((item) => item.node.id)).not.toContain('signal:excluded')
    expect(view.collapsedCount).toBe(1)
    expect(view.recommendation?.title).toBe('Termina el flujo de la demo')
  })

  it('uses semantic roles rather than color-only categories', () => {
    const view = buildTwinGraphViewModel(snapshot())
    const roles = new Map(view.dominantContexts.map((item) => [item.node.id, item.role]))

    expect(roles.get('goal:launch')).toBe('fact')
    expect(roles.get('pattern:switching')).toBe('emerging-pattern')
    expect(roles.get('outcome:session')).toBe('outcome')
    expect(view.recommendation?.role).toBe('recommended-action')
  })

  it('creates a causal focus neighborhood while retaining remote orientation', () => {
    const view = buildTwinGraphViewModel(snapshot(), 'pattern:switching')

    expect(view.focus?.selected.node.id).toBe('pattern:switching')
    expect(view.focus?.supporting.map((item) => item.node.id)).toEqual(expect.arrayContaining(['goal:launch', 'outcome:session']))
    expect(view.focus?.affected.map((item) => item.node.id)).toContain('action:finish')
    expect(view.focus?.remote.map((item) => item.node.id)).toContain('signal:deadline')
  })
})
