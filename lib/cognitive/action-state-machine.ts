export const recommendationStates = ['proposed', 'modified', 'accepted', 'started', 'postponed', 'completed', 'abandoned', 'failed', 'dismissed'] as const
export type RecommendationState = (typeof recommendationStates)[number]
export type RecommendationTransition = RecommendationState | 'helpful' | 'unhelpful' | 'intrusive'

const transitions: Record<RecommendationState, ReadonlySet<RecommendationTransition>> = {
  proposed: new Set(['modified', 'accepted', 'postponed', 'dismissed']),
  modified: new Set(['accepted', 'postponed', 'dismissed']),
  accepted: new Set(['started', 'postponed', 'abandoned', 'failed', 'completed', 'dismissed']),
  started: new Set(['completed', 'abandoned', 'failed', 'postponed']),
  postponed: new Set(['accepted', 'dismissed']),
  completed: new Set(['helpful', 'unhelpful', 'intrusive']),
  abandoned: new Set(['helpful', 'unhelpful', 'intrusive']),
  failed: new Set(['accepted', 'dismissed', 'helpful', 'unhelpful', 'intrusive']),
  dismissed: new Set(),
}

export function isTerminalRecommendationState(state: RecommendationState) {
  return ['completed', 'abandoned', 'failed', 'dismissed'].includes(state)
}

export function canTransitionRecommendation(from: string, to: RecommendationTransition) {
  return recommendationStates.includes(from as RecommendationState) && transitions[from as RecommendationState].has(to)
}

export function outcomeTypeForTransition(to: RecommendationTransition) {
  return to
}

export function staleAcceptedAt(value: Date, now = new Date()) {
  return now.getTime() - value.getTime() >= 24 * 60 * 60 * 1000
}
