export const novoActivityPhases = [
  'initializing', 'retrieving_context', 'interpreting_signals', 'evaluating_constraints',
  'prioritizing', 'planning', 'calling_tool', 'awaiting_confirmation',
  'executing_action', 'verifying_result', 'learning', 'composing_response', 'completed', 'failed', 'cancelled',
  'adapting',
] as const
export type NovoActivityPhase = (typeof novoActivityPhases)[number]
export type NovoActivitySurface = 'novo_loop' | 'chat' | 'twin_inference'
export type NovoActivityEvent = {
  runId: string
  sequence: number
  phase: NovoActivityPhase
  label: string
  detail?: string
  timestamp: string
  sourceCount?: number
  toolName?: string
  requiresConfirmation?: boolean
  recoverable?: boolean
  terminal?: boolean
}

/** Client-side recovery reducer: duplicate and stale frames are harmless. */
export function mergeNovoActivityEvents(current: NovoActivityEvent[], incoming: NovoActivityEvent[]) {
  const bySequence = new Map(current.map((event) => [event.sequence, event]))
  for (const event of incoming) {
    if (!bySequence.has(event.sequence)) bySequence.set(event.sequence, event)
  }
  return [...bySequence.values()].sort((a, b) => a.sequence - b.sequence)
}
