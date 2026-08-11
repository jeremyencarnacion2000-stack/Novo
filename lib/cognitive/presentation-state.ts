import type { BioState } from '@/lib/cognitive-engine'

// Heuristic time-of-day and completed-habit values are not biometrics. They
// must not control page visibility, device presentation, or automatic audio.
export function normalizeCognitivePresentation(state: BioState): BioState {
  if (state.phase !== 'SYNAPTIC_FATIGUE' && state.phase !== 'REDUCED_CAPACITY_MODE') return state
  return { ...state, phase: 'LINEAR_EXECUTION', label: 'Execution Mode', blueLight: false, recommendedAudioCategory: 'none' }
}
