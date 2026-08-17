# Arquitectura del Cognitive Graph

## Decisión

La primera entrega debe conservar el renderer SVG existente y reemplazar su contrato por una proyección server-side estable. Sigma.js + Graphology es la opción de escalado para 100–2,000 nodos, pero instalarlo antes de tener lentes, ownership, evidencia e inspector solo movería complejidad al cliente.

### Comparación

| Opción | Ventajas | Coste/riesgo | Decisión |
|---|---|---|---|
| SVG actual | Cero dependencias, accesible como fallback, suficiente para 35 nodos | No escala a miles de nodos, layout manual | Primer slice |
| Sigma + Graphology | WebGL, culling, layouts y selección eficientes | Nueva dependencia, accesibilidad alternativa obligatoria, SSR/client boundary | Segunda fase |
| React Flow | Excelente para flujos y nodos DOM | No es ideal para una red de contexto densa; más layout DOM | No |
| Cytoscape.js | Ecosistema de grafos maduro | Bundle y API más pesados para el alcance actual | No |

## Contrato de snapshot

La ruta `/api/cognitive/graph` debe aceptar `lens`, `focusNodeId`, `depth`, `limit` y `since`. La respuesta debe incluir un snapshot versionado:

```ts
type CognitiveLens = 'now' | 'goals' | 'patterns' | 'memory' | 'sources'

type CognitiveEvidence = {
  id: string
  sourceId: string
  sourceType: string
  classification: 'user_reported' | 'observed' | 'deterministic_estimate' | 'model_inference' | 'uncalibrated'
  observedAt: string
  reliability: 'high' | 'medium' | 'low'
  correctedAt?: string
  excludedAt?: string
  userConfirmed: boolean
}

type CognitiveGraphNode = {
  id: string
  kind: 'twin' | 'objective' | 'project' | 'commitment' | 'action' | 'routine' | 'constraint' | 'blocker' | 'signal' | 'memory' | 'pattern' | 'strategy' | 'intervention' | 'outcome' | 'source' | 'integration'
  label: string
  summary?: string
  status?: string
  relevance: number
  confidence: 'high' | 'medium' | 'low'
  evidenceIds: string[]
  actionIds: string[]
  isInferred: boolean
  isCorrectable: boolean
  isExcluded: boolean
  isStale: boolean
  createdAt: string
  updatedAt: string
  lastActivityAt?: string
  position?: { x: number; y: number }
}

type CognitiveGraphEdge = {
  id: string
  source: string
  target: string
  kind: 'supports' | 'blocks' | 'depends_on' | 'conflicts_with' | 'derived_from' | 'belongs_to' | 'caused_by' | 'learned_from' | 'recommended_for' | 'executed_as' | 'corrected_by' | 'excluded_from'
  weight: number
  confidence: 'high' | 'medium' | 'low'
  evidenceIds: string[]
  isInferred: boolean
  isActive: boolean
}
```

## Pipeline

```text
owned Prisma query
  -> normalize evidence
  -> project domain nodes/edges
  -> source exclusion + correction filter
  -> apply lens and focus depth
  -> rank relevance and cap density
  -> deterministic layout seed
  -> serialize snapshot
  -> client graph store
  -> renderer + inspector + alternative list
```

The query must be bounded and batched. Labels must not contain private note bodies or raw tool arguments. No LLM call is allowed during render.

## Mobile and accessibility

Mobile starts with a focused local graph and a list/tree alternative. The selected node is shown in a bottom sheet. Keyboard selection uses a roving active node, Enter opens the inspector, Escape closes it, and the same snapshot powers the textual relationship list.
# Latest projection refinement (2026-08-04)

The shared projection now exposes persisted Twin bottlenecks as explicitly inferred `blocker` nodes and aggregates repeated evolution events into bounded `pattern` nodes. These are derived only from owned persisted records, are marked with medium/low confidence, and remain subject to the same lens and density filters as all other nodes.
