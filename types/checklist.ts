import { Task } from './project'

export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  dueDate?: string | null
  taskId?: string
  task?: Task | null
}
