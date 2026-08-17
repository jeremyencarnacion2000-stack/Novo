export type InitiativeDecision = 'SILENT_LEARN' | 'UPDATE_CONTEXT' | 'UPDATE_RECOMMENDATION' | 'ASK_USER' | 'PROACTIVE_SUGGESTION' | 'URGENT_NOTIFICATION'
export type InitiativeInputs = { relevance: number; confidence: number; urgency: number; interruptibility: number; contextChanged: boolean; proactivePaused?: boolean }
const atLeast = (value: number, threshold: number) => value === Math.max(value, threshold)

/** Conservative policy: most observations are silent; only strong evidence interrupts. */
export function evaluateInitiative(input: InitiativeInputs): InitiativeDecision {
  if (input.proactivePaused) return input.contextChanged ? 'UPDATE_CONTEXT' : 'SILENT_LEARN'
  if (!input.contextChanged && !atLeast(input.relevance, 0.45)) return 'SILENT_LEARN'
  if (atLeast(input.urgency, 0.9) && atLeast(input.confidence, 0.72) && atLeast(input.interruptibility, 0.45)) return 'URGENT_NOTIFICATION'
  if (atLeast(input.relevance, 0.8) && atLeast(input.confidence, 0.72) && atLeast(input.interruptibility, 0.55)) return 'PROACTIVE_SUGGESTION'
  if (atLeast(input.relevance, 0.68) && !atLeast(input.confidence, 0.62)) return 'ASK_USER'
  if (input.contextChanged || atLeast(input.relevance, 0.5)) return 'UPDATE_RECOMMENDATION'
  return 'SILENT_LEARN'
}

export function isSignificantAmbientTrigger(trigger: string) {
  return ['task_completed', 'calendar_changed', 'agent_outcome', 'focus_completed', 'user_correction'].includes(trigger)
}
