import { normalizeCognitivePresentation } from '../presentation-state'

const base = { fatigueScore: 90, attentionScore: 10, ultradianCycle: 4, minutesToNextPhase: 20, label: 'Recovery Required', blueLight: true, recommendedAudioCategory: 'ambient' as const }

describe('cognitive presentation normalization', () => {
  it.each(['SYNAPTIC_FATIGUE', 'REDUCED_CAPACITY_MODE'] as const)('does not publish %s as a global fatigue state', (phase) => {
    expect(normalizeCognitivePresentation({ ...base, phase })).toMatchObject({ phase: 'LINEAR_EXECUTION', label: 'Execution Mode', blueLight: false, recommendedAudioCategory: 'none' })
  })

  it('preserves a normal execution state by reference', () => {
    const state = { ...base, phase: 'LINEAR_EXECUTION' as const, label: 'Execution Mode', blueLight: false, recommendedAudioCategory: 'none' as const }
    expect(normalizeCognitivePresentation(state)).toBe(state)
  })
})
