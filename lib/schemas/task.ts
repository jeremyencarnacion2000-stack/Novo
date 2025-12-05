import { z } from 'zod'

export const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  status: z.enum(['todo', 'in-progress', 'done']).optional().default('todo'),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  dueDate: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
})

export const updateTaskSchema = taskSchema.partial()
