import type { EvidenceClassification, EvidenceReliability } from './types'
export function classifyLedgerReliability(value: string): { classification: EvidenceClassification; reliability: EvidenceReliability } {
  if (value === 'user_reported') return { classification: 'user_reported', reliability: 'high' }
  if (value === 'direct') return { classification: 'observed', reliability: 'high' }
  if (value === 'deterministic') return { classification: 'deterministic_estimate', reliability: 'medium' }
  if (value === 'inference') return { classification: 'model_inference', reliability: 'low' }
  return { classification: 'uncalibrated', reliability: 'low' }
}
