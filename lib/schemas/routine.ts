import { z } from 'zod'

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

const daysOfWeekSchema = z.union([
  z.string().max(256),
  z.array(z.enum(WEEKDAYS)).max(7),
]).nullable().optional().transform((value) => {
  if (Array.isArray(value)) return JSON.stringify(value)
  return value
})

export const routineTaskSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1, 'Task text is required'),
  completed: z.boolean().optional().default(false)
})

export const routineExerciseSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Exercise name is required'),
  muscleGroup: z.string().min(1, 'Muscle group is required'),
  sets: z.number().min(1, 'Sets must be at least 1'),
  reps: z.string().min(1, 'Reps are required'),
  tempo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  order: z.number().default(0)
})

export const routineDaySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Day name is required'),
  weekday: z.string().optional().nullable(),
  exercises: z.array(routineExerciseSchema).default([]),
  order: z.number().default(0)
})

export const routineSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  timeOfDay: z.string().min(1, 'Time of day is required'),
  duration: z.number().min(1, 'Duration is required'),
  isActive: z.boolean().optional().default(true),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Scheduled time must use HH:mm').nullable().optional(),
  daysOfWeek: daysOfWeekSchema,

  // New structured fields
  objective: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  level: z.string().optional().nullable(),
  tempo: z.string().optional().nullable(),
  method: z.string().optional().nullable(),
  days: z.array(routineDaySchema).optional().default([]),

  // Legacy
  tasks: z.array(routineTaskSchema).optional().default([])
})

export const updateRoutineSchema = routineSchema.partial()
