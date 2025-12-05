import { z } from 'zod'

export const schoolEventSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Event title is required'),
  date: z.string().datetime('Invalid date'),
  type: z.enum(['exam', 'assignment', 'project']),
  completed: z.boolean().optional().default(false)
})

export const schoolGradeSchema = z.object({
  id: z.string().optional(),
  period: z.string().min(1, 'Period is required'),
  grade: z.number().min(0).max(100)
})

export const subjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  events: z.array(schoolEventSchema).optional().default([]),
  grades: z.array(schoolGradeSchema).optional().default([])
})

export const updateSubjectSchema = subjectSchema.partial()
