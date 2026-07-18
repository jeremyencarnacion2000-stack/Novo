/**
 * insight-types.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared shape for anything the Cognitive Twin surfaces to the user as a
 * one-off notice: a live phase transition (usePeakTaskOrchestrator), a
 * burnout warning, or an ambient "the twin learned something" signal read
 * from TwinEvolutionLog. Previously these rendered through two separate,
 * uncoordinated UI elements (a floating card and a toast popup) that could
 * both fire at once. They now share this one shape and one surface — see
 * the `insight` state in usePeakTaskOrchestrator and its render in
 * dashboard-shell.tsx.
 *
 * `action` is optional on purpose: most insights are still just FYI (e.g.
 * a burnout warning doesn't need a button, it needs to be read). Only give
 * an insight an action when there's something concrete and low-risk to do
 * about it in one tap.
 */

export interface TwinInsight {
  id: string
  message: string
  tone: 'info' | 'warning' | 'critical'
  action?: {
    label: string
    onClick: () => void | Promise<void>
  }
}
