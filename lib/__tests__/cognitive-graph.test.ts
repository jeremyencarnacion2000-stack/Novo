import { buildCognitiveGraph } from '@/lib/cognitive-graph'

describe('cognitive graph metric boundaries', () => {
  it('does not render a legacy burnout index as a user metric', () => {
    const graph = buildCognitiveGraph({
      identity: {},
      energyCurve: {},
      metrics: { currentCognitiveLoad: 68, burnoutIndex: 93 },
      bottlenecks: { mainFrictionPoint: 'overcommitment' },
    }, [])

    expect(graph.nodes.some((node) => node.id === 'burnout')).toBe(false)
    expect(graph.edges.some((edge) => edge.source === 'burnout' || edge.target === 'burnout')).toBe(false)
    expect(graph.nodes.find((node) => node.id === 'load')).toMatchObject({
      label: '68%',
      detail: 'Carga operativa estimada (no biométrica)',
    })
  })
})
