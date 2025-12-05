import { z } from 'zod'

export const goalSchema = z.object({
  title: z.string().min(1, 'Goal title is required'),
  description: z.string().optional().nullable(),
  status: z.enum(['active', 'completed', 'paused']).default('active'),
  deadline: z.string().datetime('Invalid date').optional().nullable(),
})

export const updateGoalSchema = goalSchema.partial()
