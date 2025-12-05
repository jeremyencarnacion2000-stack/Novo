import { z } from 'zod'

export const trackerEntrySchema = z.object({
  id: z.string().optional(),
  date: z.string(),
  value: z.number().min(0)
})

export const trackerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['habit', 'metric']),
  unit: z.string().min(1, 'Unit is required'),
  goal: z.number().min(0),
  entries: z.array(trackerEntrySchema).optional().default([])
})

export const updateTrackerSchema = trackerSchema.partial()
