import { z } from 'zod'

export const routineTaskSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1, 'Task text is required'),
  completed: z.boolean().optional().default(false)
})

export const routineSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  timeOfDay: z.string().min(1, 'Time of day is required'),
  duration: z.number().min(1, 'Duration is required'),
  tasks: z.array(routineTaskSchema).optional().default([])
})

export const updateRoutineSchema = routineSchema.partial()
