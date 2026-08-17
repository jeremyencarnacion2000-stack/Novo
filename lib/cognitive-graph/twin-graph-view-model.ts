import type { CognitiveGraphEdge, CognitiveGraphNode, CognitiveGraphSnapshot } from './types'

export type TwinGraphSemanticRole =
  | 'fact'
  | 'observation'
  | 'inference'
  | 'emerging-pattern'
  | 'confirmed-pattern'
  | 'outcome'
  | 'recommended-action'

export type TwinGraphPosition = { x: number; y: number }

export type TwinGraphContext = {
  node: CognitiveGraphNode
  role: TwinGraphSemanticRole
  position: TwinGraphPosition
  relatedCount: number
}

export type TwinGraphFocus = {
  selected: TwinGraphContext
  supporting: TwinGraphContext[]
  affected: TwinGraphContext[]
  remote: TwinGraphContext[]
}

export type TwinGraphViewModel = {
  anchor: { id: string; label: string; detail: string; position: TwinGraphPosition }
  dominantContexts: TwinGraphContext[]
  collapsedCount: number
  recommendation?: CognitiveGraphSnapshot['recommendation'] & { role: 'recommended-action' }
  focus?: TwinGraphFocus
}

const OVERVIEW_POSITIONS: TwinGraphPosition[] = [
  { x: 23, y: 22 },
  { x: 75, y: 21 },
  { x: 83, y: 56 },
  { x: 55, y: 78 },
  { x: 18, y: 67 },
  { x: 43, y: 14 },
]

const FOCUS_SUPPORTING_POSITIONS: TwinGraphPosition[] = [
  { x: 28, y: 16 },
  { x: 52, y: 11 },
  { x: 73, y: 17 },
]

const FOCUS_AFFECTED_POSITIONS: TwinGraphPosition[] = [
  { x: 36, y: 80 },
  { x: 64, y: 80 },
  { x: 82, y: 67 },
]

function compareByDominance(left: CognitiveGraphNode, right: CognitiveGraphNode) {
  return dominance(right) - dominance(left) || left.label.localeCompare(right.label)
}

function dominance(node: CognitiveGraphNode) {
  const kindWeight: Partial<Record<CognitiveGraphNode['kind'], number>> = {
    objective: .12,
    project: .09,
    commitment: .1,
    action: .08,
    blocker: .12,
    pattern: .1,
    strategy: .09,
    intervention: .08,
    outcome: .07,
  }
  return node.relevance
    + (node.urgency ?? 0) * .12
    + (node.evidenceIds.length ? .035 : 0)
    + (node.actionIds.length ? .05 : 0)
    + (node.isStale ? -.15 : 0)
    + (kindWeight[node.kind] ?? 0)
}

export function semanticRole(node: CognitiveGraphNode): TwinGraphSemanticRole {
  if (node.kind === 'outcome') return 'outcome'
  if (node.kind === 'pattern') {
    const state = `${node.status ?? ''} ${node.summary ?? ''}`.toLocaleLowerCase()
    return state.includes('confirm') || state.includes('stable') ? 'confirmed-pattern' : 'emerging-pattern'
  }
  if (node.isInferred) return 'inference'
  if (node.kind === 'signal' || node.kind === 'source' || node.kind === 'integration') return 'observation'
  return 'fact'
}

function relatedCount(node: CognitiveGraphNode, edges: CognitiveGraphEdge[]) {
  return edges.filter((edge) => edge.isActive && (edge.source === node.id || edge.target === node.id)).length
}

function asContext(node: CognitiveGraphNode, edges: CognitiveGraphEdge[], position: TwinGraphPosition): TwinGraphContext {
  return { node, role: semanticRole(node), position, relatedCount: relatedCount(node, edges) }
}

function neighborsFor(selectedId: string, nodes: CognitiveGraphNode[], edges: CognitiveGraphEdge[]) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const incoming: CognitiveGraphNode[] = []
  const outgoing: CognitiveGraphNode[] = []
  for (const edge of edges) {
    if (!edge.isActive) continue
    if (edge.target === selectedId) {
      const node = nodesById.get(edge.source)
      if (node && node.kind !== 'twin' && !node.isExcluded) incoming.push(node)
    }
    if (edge.source === selectedId) {
      const node = nodesById.get(edge.target)
      if (node && node.kind !== 'twin' && !node.isExcluded) outgoing.push(node)
    }
  }
  return { incoming, outgoing }
}

/**
 * Presentation-only adapter. It never persists or interprets a second Twin:
 * every context, relation and recommendation comes from the canonical snapshot.
 */
export function buildTwinGraphViewModel(snapshot: CognitiveGraphSnapshot, selectedId?: string | null): TwinGraphViewModel {
  const twin = snapshot.nodes.find((node) => node.kind === 'twin')
  const candidates = snapshot.nodes
    .filter((node) => node.kind !== 'twin' && !node.isExcluded)
    .sort(compareByDominance)
  const visibleCount = candidates.length >= 4 ? Math.min(6, Math.max(5, Math.ceil(candidates.length * .42))) : candidates.length
  const dominantNodes = candidates.slice(0, visibleCount)
  const dominantContexts = dominantNodes.map((node, index) => asContext(node, snapshot.edges, OVERVIEW_POSITIONS[index] ?? OVERVIEW_POSITIONS[0]))
  const selected = selectedId ? snapshot.nodes.find((node) => node.id === selectedId && !node.isExcluded) : undefined
  const recommendation = snapshot.recommendation ? { ...snapshot.recommendation, role: 'recommended-action' as const } : undefined

  let focus: TwinGraphFocus | undefined
  if (selected && selected.kind !== 'twin') {
    const { incoming, outgoing } = neighborsFor(selected.id, snapshot.nodes, snapshot.edges)
    const evidenceIds = new Set(selected.evidenceIds)
    const sharedEvidence = snapshot.nodes.filter((node) => node.id !== selected.id && !node.isExcluded && node.kind !== 'twin' && node.evidenceIds.some((id) => evidenceIds.has(id)))
    const supportingNodes = [...incoming, ...sharedEvidence]
      .filter((node, index, items) => items.findIndex((item) => item.id === node.id) === index)
      .sort(compareByDominance)
      .slice(0, 3)
    const affectedNodes = outgoing
      .filter((node) => !supportingNodes.some((item) => item.id === node.id))
      .sort(compareByDominance)
      .slice(0, 3)
    const localIds = new Set([selected.id, ...supportingNodes.map((node) => node.id), ...affectedNodes.map((node) => node.id)])
    const remoteNodes = dominantNodes.filter((node) => !localIds.has(node.id)).slice(0, 3)

    focus = {
      selected: asContext(selected, snapshot.edges, { x: 50, y: 48 }),
      supporting: supportingNodes.map((node, index) => asContext(node, snapshot.edges, FOCUS_SUPPORTING_POSITIONS[index] ?? FOCUS_SUPPORTING_POSITIONS[0])),
      affected: affectedNodes.map((node, index) => asContext(node, snapshot.edges, FOCUS_AFFECTED_POSITIONS[index] ?? FOCUS_AFFECTED_POSITIONS[0])),
      remote: remoteNodes.map((node, index) => asContext(node, snapshot.edges, [{ x: 11, y: 46 }, { x: 89, y: 39 }, { x: 12, y: 83 }][index] ?? { x: 11, y: 46 })),
    }
  }

  return {
    anchor: {
      id: twin?.id ?? 'twin:current-context',
      label: 'Contexto actual',
      detail: `Tu Twin · actualizado ${relativeUpdate(snapshot.generatedAt)}`,
      position: { x: 50, y: 49 },
    },
    dominantContexts,
    collapsedCount: Math.max(0, candidates.length - dominantNodes.length),
    recommendation,
    focus,
  }
}

function relativeUpdate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'ahora'
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000))
  if (minutes < 2) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  return `hace ${hours} h`
}
