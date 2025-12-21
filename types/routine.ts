export type MuscleGroup = string;

export interface RoutineExercise {
  id: string
  name: string
  muscleGroup: MuscleGroup
  sets: number
  reps: string
  tempo?: string
  notes?: string | null
  order: number
}

export interface RoutineDay {
  id: string
  name: string
  exercises: RoutineExercise[]
  order: number
  weekday?: string
}

export interface RoutineTask {
  id: string
  text: string
  completed: boolean
}

export interface Routine {
  id: string
  name: string
  description: string
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime'
  duration: number
  isActive: boolean
  scheduledTime?: string | null
  daysOfWeek?: string | null

  // New structured fields
  objective?: string | null
  frequency?: string | null
  level?: string | null
  tempo?: string | null
  method?: string | null
  days?: RoutineDay[]

  // Legacy
  tasks: RoutineTask[]
}

