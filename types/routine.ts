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
  tasks: RoutineTask[]
  isActive: boolean
}
