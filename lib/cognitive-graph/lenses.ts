import type { CognitiveGraphEdge, CognitiveGraphNode, CognitiveLens } from './types'

function connectedWithin(nodes: CognitiveGraphNode[], edges: CognitiveGraphEdge[], focusNodeId: string, depth: number) {
  const keep = new Set([focusNodeId])
  let frontier = new Set([focusNodeId])
  for (let level = 0; level < depth; level += 1) {
    const next = new Set<string>()
    for (const edge of edges) {
      if (frontier.has(edge.source)) next.add(edge.target)
      if (frontier.has(edge.target)) next.add(edge.source)
    }
    next.forEach((id) => keep.add(id))
    frontier = next
  }
  return nodes.filter((node) => keep.has(node.id))
}

export function applyGraphLens(input: {
  nodes: CognitiveGraphNode[]
  edges: CognitiveGraphEdge[]
  lens: CognitiveLens
  focusNodeId?: string
  depth: number
}) {
  const lensKinds: Record<CognitiveLens, Set<CognitiveGraphNode['kind']>> = {
    now: new Set(['twin', 'objective', 'commitment', 'blocker', 'action', 'signal', 'source', 'memory', 'pattern', 'strategy']),
    goals: new Set(['twin', 'objective', 'project', 'commitment', 'action', 'outcome', 'blocker']),
    patterns: new Set(['twin', 'pattern', 'strategy', 'outcome', 'signal', 'action']),
    memory: new Set(['twin', 'memory', 'pattern', 'strategy', 'outcome', 'action']),
    sources: new Set(['twin', 'source', 'integration', 'signal', 'memory']),
  }
  const allowed = lensKinds[input.lens]
  let nodes = input.nodes.filter((node) => allowed.has(node.kind) || node.id === input.focusNodeId)
  let edges = input.edges.filter((edge) => nodes.some((node) => node.id === edge.source) && nodes.some((node) => node.id === edge.target))
  if (input.focusNodeId && nodes.some((node) => node.id === input.focusNodeId)) {
    nodes = connectedWithin(nodes, edges, input.focusNodeId, input.depth)
    const ids = new Set(nodes.map((node) => node.id))
    edges = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
  }
  return { nodes, edges }
}
