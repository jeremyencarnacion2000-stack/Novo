import { canTransitionRecommendation, staleAcceptedAt } from '@/lib/cognitive/action-state-machine'

describe('recommendation state machine', () => {
  it('allows the executable lifecycle and rejects contradictory terminal states', () => {
    expect(canTransitionRecommendation('proposed', 'accepted')).toBe(true)
    expect(canTransitionRecommendation('accepted', 'started')).toBe(true)
    expect(canTransitionRecommendation('accepted', 'dismissed')).toBe(true)
    expect(canTransitionRecommendation('started', 'completed')).toBe(true)
    expect(canTransitionRecommendation('completed', 'abandoned')).toBe(false)
    expect(canTransitionRecommendation('dismissed', 'accepted')).toBe(false)
  })
  it('flags accepted actions that require verification', () => {
    expect(staleAcceptedAt(new Date(Date.now() - 25 * 60 * 60_000))).toBe(true)
    expect(staleAcceptedAt(new Date())).toBe(false)
  })
})
