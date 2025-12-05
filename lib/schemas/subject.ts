import { z } from 'zod'

export const subjectBaseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
})

export const createSubjectSchema = subjectBaseSchema
export const updateSubjectSchema = subjectBaseSchema.partial()
