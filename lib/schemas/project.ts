import { z } from 'zod'

export const subtaskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Subtask title is required'),
  completed: z.boolean().optional().default(false)
})

export const projectSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().default(''), // Database field is NOT NULL, so default to empty string
  status: z.enum(['not-started', 'in-progress', 'completed', 'on-hold', 'cancelled']).optional().default('not-started'),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  progress: z.number().min(0).max(100).optional().default(0),
  tags: z.array(z.string()).optional().default([]),
  subtasks: z.array(subtaskSchema).optional().default([]),
  notes: z.string().optional().default(''), // Database has default('') 
})

export const updateProjectSchema = projectSchema.partial();
