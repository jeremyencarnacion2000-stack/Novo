import { z } from 'zod'

export const stateCheckinSchema = z.object({
  energy: z.number().int().min(1).max(5),
  focus: z.number().int().min(1).max(5),
  availableMinutes: z.number().int().min(5).max(1_440),
  workload: z.number().int().min(1).max(5),
  currentContext: z.string().trim().min(1).max(240),
  timezone: z.string().trim().min(1).max(100),
})

export const actionResponseSchema = z.object({
  actionId: z.string().cuid(),
  response: z.enum(['accepted', 'modified', 'started', 'postponed', 'completed', 'abandoned', 'failed', 'dismissed', 'helpful', 'unhelpful', 'intrusive']),
  note: z.string().trim().max(500).optional(),
  reason: z.enum(['lack_of_time', 'too_large', 'external_dependency', 'priority_changed', 'incorrect_recommendation', 'insufficient_information', 'technical_problem', 'other']).optional(),
  modifiedNextStep: z.string().trim().min(3).max(500).optional(),
  idempotencyKey: z.string().uuid(),
}).superRefine((value, context) => {
  if ((value.response === 'abandoned' || value.response === 'failed') && !value.reason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reason'],
      message: 'A structured reason is required when an action is abandoned or fails.',
    })
  }
})

// Boundary contract for an optional language model. Server rules validate and
// constrain this output before any persistence or external action happens.
export const aiActionSuggestionSchema = z.object({
  title: z.string().trim().min(3).max(180),
  nextStep: z.string().trim().min(3).max(500),
  explanation: z.string().trim().min(3).max(700),
  estimatedMinutes: z.number().int().min(5).max(480).optional(),
  confidence: z.number().min(0).max(1),
}).strict()

export type StateCheckinInput = z.infer<typeof stateCheckinSchema>
export type ActionResponseInput = z.infer<typeof actionResponseSchema>
export type AiActionSuggestion = z.infer<typeof aiActionSuggestionSchema>
