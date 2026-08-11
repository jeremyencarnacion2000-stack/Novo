type JsonRecord = Record<string, unknown>

export type TwinAdaptationProposal = {
  id: 'respect_peak_window' | 'reduce_context_switching' | 'keep_confirmation_boundary' | 'use_validated_pattern'
  reason: string
  behavior: string
}

const adaptationProposalIds = new Set<TwinAdaptationProposal['id']>([
  'respect_peak_window',
  'reduce_context_switching',
  'keep_confirmation_boundary',
  'use_validated_pattern',
])

/**
 * Reads only the bounded policy shape persisted by the Twin. This is shared by
 * recommendation, graph, and Agent API consumers so untrusted JSON never turns
 * into an executable capability.
 */
export function parsePersistedTwinAdaptationProposals(identity: unknown): TwinAdaptationProposal[] {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) return []
  const policy = (identity as Record<string, unknown>).adaptationPolicy
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return []
  const proposals = (policy as Record<string, unknown>).proposals
  if (!Array.isArray(proposals)) return []
  return proposals.flatMap((proposal) => {
    if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) return []
    const value = proposal as Record<string, unknown>
    if (typeof value.id !== 'string' || !adaptationProposalIds.has(value.id as TwinAdaptationProposal['id'])) return []
    if (typeof value.reason !== 'string' || typeof value.behavior !== 'string') return []
    return [{ id: value.id as TwinAdaptationProposal['id'], reason: value.reason.slice(0, 240), behavior: value.behavior.slice(0, 240) }]
  })
}

export function inferTwinAdaptationProposals(input: {
  confidenceScore: number
  trustLevel: string
  energyCurve: JsonRecord
  bottlenecks: JsonRecord
}): TwinAdaptationProposal[] {
  const proposals: TwinAdaptationProposal[] = []
  const chronotype = typeof input.energyCurve.chronotype === 'string' ? input.energyCurve.chronotype : ''
  const friction = typeof input.bottlenecks.mainFrictionPoint === 'string' ? input.bottlenecks.mainFrictionPoint : ''

  if (input.confidenceScore >= 56 && (chronotype || input.energyCurve.peakFocusStart)) {
    proposals.push({ id: 'respect_peak_window', reason: 'Hay evidencia suficiente de una ventana energética repetida.', behavior: 'Priorizar bloques exigentes dentro de la ventana observada.' })
  }
  if (friction === 'context_switching' || friction === 'procrastination') {
    proposals.push({ id: 'reduce_context_switching', reason: `La fricción observada es ${friction}.`, behavior: 'Proponer un único siguiente paso pequeño y limitar cambios de contexto.' })
  }
  if (input.confidenceScore < 76 || input.trustLevel === 'initial' || input.trustLevel === 'learning') {
    proposals.push({ id: 'keep_confirmation_boundary', reason: 'El Twin todavía está calibrando su modelo.', behavior: 'Solicitar confirmación antes de adaptar acciones o integraciones.' })
  } else {
    proposals.push({ id: 'use_validated_pattern', reason: 'El nivel de confianza permite usar patrones persistentes.', behavior: 'Aplicar patrones confirmados como contexto, sin convertirlos en hechos.' })
  }
  return proposals
}
