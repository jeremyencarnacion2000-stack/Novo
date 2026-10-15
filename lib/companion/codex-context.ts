import { z } from 'zod'

const unsafeSummaryPatterns = [
  /https?:\/\/|\bwww\./i,
  /(?:^|\s)(?:[a-z]:[\\/]|\\\\|~[\\/]|\/(?:users|home|tmp|private|workspace|workspaces|var|etc|mnt|opt)(?:\/|\b))/i,
  /\b(?:api[_ -]?key|access[_ -]?token|password|passwd|secret|bearer)\s*[:=]/i,
  /\b(?:sk-[a-z0-9_-]{12,}|gh[pousr]_[a-z0-9_]{20,}|github_pat_[a-z0-9_]{20,}|novo_mcp_[a-z0-9]{30,})\b/i,
  /```|~~~/,
  /[\u0000-\u001f\u007f]/,
]

function isSafeSummary(value: string): boolean {
  return !unsafeSummaryPatterns.some((pattern) => pattern.test(value))
}

const safeSummary = z.string().trim().min(1).max(240).refine(isSafeSummary, 'unsafe_codex_summary')
const safeProjectLabel = z.string().trim().min(1).max(80)
  .refine((value) => !/[\\/:]/.test(value) && isSafeSummary(value), 'unsafe_codex_project')

export const codexContextInputSchema = z.object({
  sessionKey: z.string().regex(/^[a-f0-9]{64}$/i),
  event: z.enum(['start', 'prompt', 'stop', 'stop_failure', 'end']),
  projectLabel: safeProjectLabel.optional(),
  summary: safeSummary.optional(),
  observedAt: z.string().datetime({ offset: true }).optional(),
}).strict().superRefine((value, context) => {
  if (value.summary && !isSafeSummary(value.summary)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['summary'], message: 'unsafe_codex_summary' })
  }
})

export type CodexContextInput = z.infer<typeof codexContextInputSchema>

export type CodexSignalUpdate = {
  fingerprint: string
  sourceRef: string
  signalType: 'codex_task' | 'codex_result' | 'codex_status'
  label: string
}

export function codexSignalUpdates(input: CodexContextInput): CodexSignalUpdate[] {
  const project = input.projectLabel ? ` · ${input.projectLabel}` : ''
  const updates: CodexSignalUpdate[] = []
  const add = (signalType: CodexSignalUpdate['signalType'], label: string) => {
    updates.push({
      fingerprint: `codex:${input.sessionKey}:${signalType}`,
      sourceRef: input.sessionKey,
      signalType,
      label,
    })
  }

  if (input.event === 'prompt' && input.summary) add('codex_task', `Tarea de Codex${project}: ${input.summary}`)
  if (input.event === 'prompt') add('codex_result', `Codex sigue trabajando${project}`)
  if ((input.event === 'stop' || input.event === 'stop_failure') && input.summary) {
    add('codex_result', `Resultado de Codex${project}: ${input.summary}`)
  }

  const status = {
    start: 'Sesión de Codex activa',
    prompt: 'Tarea de Codex en curso',
    stop: 'Tarea de Codex terminada',
    stop_failure: 'Tarea de Codex interrumpida',
    end: 'Sesión de Codex cerrada',
  }[input.event]
  add('codex_status', `${status}${project}`)
  return updates
}
