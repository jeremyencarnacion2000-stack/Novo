export type ProjectStatus = "not-started" | "in-progress" | "completed"

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export interface Project {
  id: string
  title: string
  description: string
  status: ProjectStatus
  priority: "low" | "medium" | "high"
  startDate: string
  dueDate: string
  progress: number
  tags: string[]
  subtasks: Subtask[] // These are now referred to as "Tasks" in the UI
  notes: string
}

export interface Task {
  id: string
  title: string
  status: "todo" | "in-progress" | "done"
  priority: "low" | "medium" | "high"
  dueDate?: string
  projectId?: string // Optional link to a project
  tags: string[]
  createdAt: string
}
