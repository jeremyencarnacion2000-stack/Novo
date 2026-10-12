import { z } from 'zod'

export const COMPANION_WORK_CONTEXT_TTL_MS = 4 * 60 * 60 * 1000

const unsafeWorkContextText = [
  /https?:\/\/|\bwww\./i,
  /(?:^|\s)[a-z]:\\|\\\\|(?:^|\s)~?\/(?:users|home|workspace|workspaces|private|var|etc)(?:\/|\b)/i,
  /\b(?:api[_ -]?key|access[_ -]?token|password|passwd|secret|bearer)\s*[:=]/i,
  /[\u0000-\u001f\u007f]/,
]

function isSafeSummary(value: string): boolean {
  return !unsafeWorkContextText.some((pattern) => pattern.test(value))
}

export const companionWorkContextInputSchema = z.object({
  projectLabel: z.string().trim().max(100).optional().transform((value) => value || null),
  focusSummary: z.string().trim().min(1).max(240),
}).strict().superRefine((value, context) => {
  if (value.projectLabel && !isSafeSummary(value.projectLabel)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['projectLabel'], message: 'unsafe_work_context' })
  }
  if (!isSafeSummary(value.focusSummary)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['focusSummary'], message: 'unsafe_work_context' })
  }
})

export type CompanionWorkContextInput = z.infer<typeof companionWorkContextInputSchema>
