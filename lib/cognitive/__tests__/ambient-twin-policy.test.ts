import { evaluateInitiative } from '../ambient-twin-policy'

describe('ambient initiative policy', () => {
  it('learns silently when nothing changed', () => {
    expect(evaluateInitiative({ relevance: 0.2, confidence: 0.1, urgency: 0, interruptibility: 0.8, contextChanged: false })).toBe('SILENT_LEARN')
  })

  it('does not interrupt when proactive suggestions are paused', () => {
    expect(evaluateInitiative({ relevance: 1, confidence: 1, urgency: 1, interruptibility: 1, contextChanged: true, proactivePaused: true })).toBe('UPDATE_CONTEXT')
  })

  it('surfaces a strong urgent change', () => {
    expect(evaluateInitiative({ relevance: 0.9, confidence: 0.9, urgency: 0.95, interruptibility: 0.8, contextChanged: true })).toBe('URGENT_NOTIFICATION')
  })
})
