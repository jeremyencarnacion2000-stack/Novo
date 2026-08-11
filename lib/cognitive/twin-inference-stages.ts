import type { NovoActivityPhase } from '@/lib/ai/activity-contract'

/**
 * The Twin's thinking stages are explicit workers over the existing Activity
 * Protocol. They describe orchestration and observability; they do not invent
 * a second memory or agent runtime.
 */
export const twinInferenceSubagents = [
  { id: 'observe', phase: 'retrieving_context', label: 'Subagente de observación', detail: 'Reuniendo señales recientes y contexto operativo.' },
  { id: 'understand', phase: 'interpreting_signals', label: 'Subagente de comprensión', detail: 'Separando hechos observados de inferencias del Twin.' },
  { id: 'propose', phase: 'prioritizing', label: 'Subagente de propuesta', detail: 'Evaluando restricciones y cambios posibles.' },
  { id: 'verify', phase: 'verifying_result', label: 'Subagente de verificación', detail: 'Comprobando que el cambio esté respaldado por evidencia.' },
  { id: 'learn', phase: 'learning', label: 'Subagente de aprendizaje', detail: 'Persistiendo la evolución y su nivel de confianza.' },
  { id: 'adapt', phase: 'adapting', label: 'Subagente de adaptación', detail: 'Preparando el siguiente comportamiento del Twin.' },
] as const satisfies ReadonlyArray<{ id: string; phase: NovoActivityPhase; label: string; detail: string }>

export type TwinInferenceStageId = (typeof twinInferenceSubagents)[number]['id']

export function getTwinInferenceStage(id: TwinInferenceStageId) {
  return twinInferenceSubagents.find((stage) => stage.id === id)!
}

