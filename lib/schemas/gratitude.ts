import { z } from 'zod'

export const gratitudeSchema = z.object({
  content: z.string().min(1, 'Gratitude content is required'),
  date: z.string().optional(),
})

export const updateGratitudeSchema = gratitudeSchema.partial()
