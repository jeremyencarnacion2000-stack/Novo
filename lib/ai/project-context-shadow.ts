import type { UserContext } from './context-builder'

const projectContextBudgetBytes = 12_000

/** Compare the already-authorized context without a second lookup or generation. */
export function buildProjectContextShadow(context: UserContext, projectEvidence: string, localEvidence: string) {
  const started = performance.now()
  const { system, preferences, providerHealth, retrieval, sources } = context.structured
  const removedSections = [
    'todaySchedule', 'metrics', 'state', 'activeSignal', 'twinContext', 'currentPlan',
    'recentOutcomes', 'activePlugins', 'mailbox', 'externalSignals', 'currentWorkContexts', 'contextWindow',
  ].filter(key => Object.hasOwn(context.structured, key))
  const summary = 'Project-only view. General account sections were omitted. Missing data is unknown, not zero. Do not infer that a source has no tasks from its absence here.\n'
    + JSON.stringify({ system, preferences, providerHealth, retrieval, sources })
  const baselineBytes = Buffer.byteLength(context.summary + projectEvidence + localEvidence)
  const candidateBytes = Buffer.byteLength(summary + projectEvidence + localEvidence)
  const withinBudget = candidateBytes <= projectContextBudgetBytes
  const selected = withinBudget && candidateBytes < baselineBytes
  return {
    // The caller never sends the candidate. When required evidence exceeds the cap,
    // keep the whole baseline for the evaluation rather than truncating it.
    summary: selected ? summary : context.summary,
    metrics: {
      baselineBytes,
      candidateBytes: selected ? candidateBytes : baselineBytes,
      withinBudget,
      removedSections: selected ? removedSections : [],
      sourceCount: sources.length,
      unavailableCount: retrieval?.unavailable.length ?? 0,
      selectionMs: performance.now() - started,
    },
  }
}
