import { ChecklistItem } from "@/types/checklist"
import { Routine, RoutineTask } from "@/types/routine"
import { Project, Task, Subtask } from "@/types/project"
import { isSameDay, parseISO } from "date-fns"

// IndexedDB utilities for offline storage
class OfflineStorage {
  private db: IDBDatabase | null = null
  private readonly dbName = 'novo-offline'
  private readonly version = 1

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
        }
      }
    })
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readonly')
      const store = transaction.objectStore('cache')
      const request = store.get(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result?.data || null)
    })
  }

  async set<T>(key: string, data: T): Promise<void> {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      const request = store.put({ key, data, timestamp: Date.now() })

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async addToQueue(operation: Omit<OfflineOperation, 'id' | 'timestamp'>): Promise<void> {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queue'], 'readwrite')
      const store = transaction.objectStore('queue')
      const request = store.add({ ...operation, timestamp: Date.now() })

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getQueue(): Promise<OfflineOperation[]> {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queue'], 'readonly')
      const store = transaction.objectStore('queue')
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async clearQueue(ids: number[]): Promise<void> {
    if (!this.db) await this.init()
    const transaction = this.db!.transaction(['queue'], 'readwrite')
    const store = transaction.objectStore('queue')

    ids.forEach(id => store.delete(id))
  }
}

interface OfflineOperation {
  id: number
  type: 'create' | 'update' | 'delete'
  endpoint: string
  data: any
  method: 'POST' | 'PUT' | 'DELETE'
  timestamp: number
}

const offlineStorage = new OfflineStorage()

// Network status detection
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true
    syncPendingOperations()
  })
  window.addEventListener('offline', () => {
    isOnline = false
  })
}

// Sync pending operations when back online
async function syncPendingOperations(): Promise<void> {
  if (!isOnline) return

  try {
    const queue = await offlineStorage.getQueue()
    const successfulIds: number[] = []
    const conflicts: Conflict[] = []

    for (const operation of queue) {
      try {
        const response = await fetch(operation.endpoint, {
          method: operation.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operation.data)
        })

        if (response.ok) {
          successfulIds.push(operation.id)
        } else if (response.status === 409) {
          // Conflict detected
          const conflictData = await response.json()
          conflicts.push({
            operation,
            serverData: conflictData,
            localData: operation.data
          })
          successfulIds.push(operation.id) // Remove from queue even with conflict
        }
      } catch (error) {
        console.error('Failed to sync operation:', operation, error)
      }
    }

    if (successfulIds.length > 0) {
      await offlineStorage.clearQueue(successfulIds)
    }

    // Handle conflicts - for now, notify user and use server version
    if (conflicts.length > 0) {
      console.warn('Conflicts detected during sync:', conflicts)
      // In a real app, you might want to show a UI notification
      // For now, we'll emit an event that components can listen to
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sync-conflicts', { detail: conflicts }))
      }
    }
  } catch (error) {
    console.error('Error syncing pending operations:', error)
  }
}

interface Conflict {
  operation: OfflineOperation
  serverData: any
  localData: any
}

// Types for our integrated data
export interface IntegratedTask extends ChecklistItem {
  source: "manual" | "routine" | "project" | "school" | "standalone"
  sourceId?: string // ID of the routine, project, or subject
  originalId?: string // ID of the task within the source
  metadata?: {
    routineName?: string
    projectName?: string
    subjectName?: string
    dueDate?: string
  }
}

export interface CalendarEvent {
  id: string
  title: string
  date: Date
  type: "task" | "project" | "routine" | "school" | "habit"
  completed: boolean
  metadata?: Record<string, unknown>
}

export interface SchoolEvent {
  id: string
  title: string
  date: string
  type: string
  completed: boolean
}

export interface SchoolSubject {
  id: string
  name: string
  events: SchoolEvent[]
}

// Cache interface
interface CacheData<T> {
  data: T
  lastSynced: string
  version: number
}

// Helper to get cached data from IndexedDB
const getCachedData = async <T,>(key: string, userId: string): Promise<CacheData<T> | null> => {
  if (typeof window === 'undefined') return null
  const prefixedKey = `cache-${userId}-${key}`
  const data = await offlineStorage.get<CacheData<T>>(prefixedKey)
  return data
}

// Helper to set cached data in IndexedDB
const setCachedData = async <T,>(key: string, userId: string, data: T, version: number = 1): Promise<void> => {
  if (typeof window === 'undefined') return
  const cache: CacheData<T> = {
    data,
    lastSynced: new Date().toISOString(),
    version
  }
  const prefixedKey = `cache-${userId}-${key}`
  await offlineStorage.set(prefixedKey, cache)
}

// API fetch with caching
const fetchWithCache = async <T,>(
  url: string,
  userId: string,
  cacheKey: string,
  options?: RequestInit
): Promise<T> => {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    })
    if (!response.ok) throw new Error('API error')
    const data = await response.json()
    await setCachedData(cacheKey, userId, data)
    return data
  } catch (error) {
    // Fallback to cache if offline
    const cached = await getCachedData<T>(cacheKey, userId)
    if (cached) return cached.data
    throw error
  }
}

// Sync data to cloud or queue for offline
const syncToCloud = async (url: string, data: any, method: 'POST' | 'PUT' | 'DELETE' = 'POST') => {
  if (!isOnline) {
    // Queue for later sync
    await offlineStorage.addToQueue({
      type: method === 'POST' ? 'create' : method === 'PUT' ? 'update' : 'delete',
      endpoint: url,
      data,
      method
    })
    return
  }

  try {
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
  } catch (error) {
    // Queue for later sync if network fails
    console.error('Sync failed, queuing for later:', error)
    await offlineStorage.addToQueue({
      type: method === 'POST' ? 'create' : method === 'PUT' ? 'update' : 'delete',
      endpoint: url,
      data,
      method
    })
  }
}

export interface BackupData {
  version: string
  timestamp: string
  settings: any
  checklist: any[]
  routines: any[]
  projects: any[]
  school: any[]
  tasks: any[]
  trackers: any[]
}

export const DataIntegrator = {
  // Get network status
  getNetworkStatus: () => isOnline,

  // Export all user data to JSON backup
  exportData: async (userId: string): Promise<BackupData> => {
    const backup: BackupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      settings: {},
      checklist: [],
      routines: [],
      projects: [],
      school: [],
      tasks: [],
      trackers: []
    }

    try {
      // Get settings from localStorage
      const settingsStr = localStorage.getItem('novo-settings')
      if (settingsStr) {
        backup.settings = JSON.parse(settingsStr)
      }
    } catch (error) {
      console.error('Failed to export settings:', error)
    }

    try {
      backup.checklist = await fetchWithCache('/api/checklist', userId, 'checklist')
    } catch (error) {
      console.error('Failed to export checklist:', error)
    }

    try {
      backup.routines = await fetchWithCache('/api/routines', userId, 'routines')
    } catch (error) {
      console.error('Failed to export routines:', error)
    }

    try {
      backup.projects = await fetchWithCache('/api/projects', userId, 'projects')
    } catch (error) {
      console.error('Failed to export projects:', error)
    }

    try {
      backup.school = await fetchWithCache('/api/school', userId, 'school')
    } catch (error) {
      console.error('Failed to export school:', error)
    }

    try {
      backup.tasks = await fetchWithCache('/api/tasks', userId, 'tasks')
    } catch (error) {
      console.error('Failed to export tasks:', error)
    }

    try {
      backup.trackers = await fetchWithCache('/api/trackers', userId, 'trackers')
    } catch (error) {
      console.error('Failed to export trackers:', error)
    }

    return backup
  },

  // Import data from JSON backup with conflict resolution
  importData: async (userId: string, backupData: BackupData, options: { overwrite?: boolean } = {}): Promise<{ success: boolean, conflicts: any[], imported: string[] }> => {
    const result = {
      success: true,
      conflicts: [] as any[],
      imported: [] as string[]
    }

    // Validate backup structure
    if (!backupData.version || !backupData.timestamp) {
      throw new Error('Invalid backup file: missing version or timestamp')
    }

    // Import settings
    if (backupData.settings && Object.keys(backupData.settings).length > 0) {
      try {
        const currentSettings = localStorage.getItem('novo-settings')
        if (currentSettings && !options.overwrite) {
          result.conflicts.push({
            type: 'settings',
            current: JSON.parse(currentSettings),
            incoming: backupData.settings
          })
        } else {
          localStorage.setItem('novo-settings', JSON.stringify(backupData.settings))
          result.imported.push('settings')
        }
      } catch (error) {
        console.error('Failed to import settings:', error)
        result.success = false
      }
    }

    // Import checklist
    if (backupData.checklist && backupData.checklist.length > 0) {
      try {
        const current = await fetchWithCache<any[]>('/api/checklist', userId, 'checklist')
        if (current.length > 0 && !options.overwrite) {
          result.conflicts.push({
            type: 'checklist',
            current,
            incoming: backupData.checklist
          })
        } else {
          // Clear existing and add new
          for (const item of current) {
            await fetch(`/api/checklist/${item.id}`, { method: 'DELETE' })
          }
          for (const item of backupData.checklist) {
            await fetch('/api/checklist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item)
            })
          }
          result.imported.push('checklist')
        }
      } catch (error) {
        console.error('Failed to import checklist:', error)
        result.success = false
      }
    }

    // Import routines
    if (backupData.routines && backupData.routines.length > 0) {
      try {
        const current = await fetchWithCache<any[]>('/api/routines', userId, 'routines')
        if (current.length > 0 && !options.overwrite) {
          result.conflicts.push({
            type: 'routines',
            current,
            incoming: backupData.routines
          })
        } else {
          for (const item of current) {
            await fetch(`/api/routines/${item.id}`, { method: 'DELETE' })
          }
          for (const item of backupData.routines) {
            await fetch('/api/routines', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item)
            })
          }
          result.imported.push('routines')
        }
      } catch (error) {
        console.error('Failed to import routines:', error)
        result.success = false
      }
    }

    // Import projects
    if (backupData.projects && backupData.projects.length > 0) {
      try {
        const current = await fetchWithCache<any[]>('/api/projects', userId, 'projects')
        if (current.length > 0 && !options.overwrite) {
          result.conflicts.push({
            type: 'projects',
            current,
            incoming: backupData.projects
          })
        } else {
          for (const item of current) {
            await fetch(`/api/projects/${item.id}`, { method: 'DELETE' })
          }
          for (const item of backupData.projects) {
            await fetch('/api/projects', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item)
            })
          }
          result.imported.push('projects')
        }
      } catch (error) {
        console.error('Failed to import projects:', error)
        result.success = false
      }
    }

    // Import school
    if (backupData.school && backupData.school.length > 0) {
      try {
        const current = await fetchWithCache<any[]>('/api/school', userId, 'school')
        if (current.length > 0 && !options.overwrite) {
          result.conflicts.push({
            type: 'school',
            current,
            incoming: backupData.school
          })
        } else {
          for (const item of current) {
            await fetch(`/api/school/${item.id}`, { method: 'DELETE' })
          }
          for (const item of backupData.school) {
            await fetch('/api/school', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item)
            })
          }
          result.imported.push('school')
        }
      } catch (error) {
        console.error('Failed to import school:', error)
        result.success = false
      }
    }

    // Import tasks
    if (backupData.tasks && backupData.tasks.length > 0) {
      try {
        const current = await fetchWithCache<any[]>('/api/tasks', userId, 'tasks')
        if (current.length > 0 && !options.overwrite) {
          result.conflicts.push({
            type: 'tasks',
            current,
            incoming: backupData.tasks
          })
        } else {
          for (const item of current) {
            await fetch(`/api/tasks/${item.id}`, { method: 'DELETE' })
          }
          for (const item of backupData.tasks) {
            await fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item)
            })
          }
          result.imported.push('tasks')
        }
      } catch (error) {
        console.error('Failed to import tasks:', error)
        result.success = false
      }
    }

    // Import trackers
    if (backupData.trackers && backupData.trackers.length > 0) {
      try {
        const current = await fetchWithCache<any[]>('/api/trackers', userId, 'trackers')
        if (current.length > 0 && !options.overwrite) {
          result.conflicts.push({
            type: 'trackers',
            current,
            incoming: backupData.trackers
          })
        } else {
          for (const item of current) {
            await fetch(`/api/trackers/${item.id}`, { method: 'DELETE' })
          }
          for (const item of backupData.trackers) {
            await fetch('/api/trackers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item)
            })
          }
          result.imported.push('trackers')
        }
      } catch (error) {
        console.error('Failed to import trackers:', error)
        result.success = false
      }
    }

    return result
  },

  // Auto-backup scheduling
  scheduleAutoBackup: (userId: string, frequency: 'daily' | 'weekly' | 'monthly') => {
    // Clear existing backup timer
    const existingTimer = localStorage.getItem('novo-auto-backup-timer')
    if (existingTimer) {
      clearInterval(parseInt(existingTimer))
    }

    const getInterval = (freq: string) => {
      switch (freq) {
        case 'daily': return 24 * 60 * 60 * 1000 // 24 hours
        case 'weekly': return 7 * 24 * 60 * 60 * 1000 // 7 days
        case 'monthly': return 30 * 24 * 60 * 60 * 1000 // 30 days
        default: return 24 * 60 * 60 * 1000
      }
    }

    const interval = getInterval(frequency)

    const backup = async () => {
      try {
        const data = await DataIntegrator.exportData(userId)
        const backupKey = `novo-backup-${new Date().toISOString().split('T')[0]}`
        localStorage.setItem(backupKey, JSON.stringify(data))
        console.log('Auto-backup completed:', backupKey)
      } catch (error) {
        console.error('Auto-backup failed:', error)
      }
    }

    // Schedule first backup
    const timerId = setInterval(backup, interval)
    localStorage.setItem('novo-auto-backup-timer', timerId.toString())

    // Store backup settings
    localStorage.setItem('novo-auto-backup-frequency', frequency)
  },

  // Get available backups
  getAvailableBackups: (): { date: string, data: BackupData }[] => {
    const backups: { date: string, data: BackupData }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('novo-backup-')) {
        try {
          const data = JSON.parse(localStorage.getItem(key)!)
          backups.push({
            date: key.replace('novo-backup-', ''),
            data
          })
        } catch (error) {
          console.error('Failed to parse backup:', key, error)
        }
      }
    }
    return backups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  },

  // Restore from auto-backup
  restoreFromBackup: async (userId: string, backupDate: string, options: { overwrite?: boolean } = {}): Promise<{ success: boolean, conflicts: any[], imported: string[] }> => {
    const backupKey = `novo-backup-${backupDate}`
    const backupStr = localStorage.getItem(backupKey)
    if (!backupStr) {
      throw new Error('Backup not found')
    }
    const backupData = JSON.parse(backupStr)
    return DataIntegrator.importData(userId, backupData, options)
  },

  // Get all tasks for a specific date (defaults to today)
  getDailyTasks: async (userId: string, date: Date = new Date()): Promise<IntegratedTask[]> => {
    const tasks: IntegratedTask[] = []

    try {
      // 1. Get Manual Checklist Items
      const manualItems = await fetchWithCache<ChecklistItem[]>(
        '/api/checklist',
        userId,
        'checklist'
      )
      manualItems.forEach((item: ChecklistItem) => {
        tasks.push({
          ...item,
          source: 'manual'
        })
      })
    } catch (error) {
      console.error('Failed to fetch checklist items:', error)
    }

    try {
      // 2. Get Routine Tasks
      const routines = await fetchWithCache<Routine[]>(
        '/api/routines',
        userId,
        'routines'
      )
      routines.filter((r: Routine) => r.isActive).forEach((routine: Routine) => {
        routine.tasks.forEach((task: RoutineTask) => {
          tasks.push({
            id: `routine-${routine.id}-${task.id}`,
            text: task.text,
            completed: task.completed,
            priority: 'medium',
            source: 'routine',
            sourceId: routine.id,
            originalId: task.id,
            metadata: {
              routineName: routine.name
            }
          })
        })
      })
    } catch (error) {
      console.error('Failed to fetch routines:', error)
    }

    try {
      // 3. Get Project Subtasks (Due Today or In Progress)
      const projects = await fetchWithCache<Project[]>(
        '/api/projects',
        userId,
        'projects'
      )
      projects.forEach((project: Project) => {
        if (project.status === 'in-progress') {
          project.subtasks.forEach((subtask: Subtask) => {
            tasks.push({
              id: `project-${project.id}-${subtask.id}`,
              text: subtask.title,
              completed: subtask.completed,
              priority: project.priority,
              source: 'project',
              sourceId: project.id,
              originalId: subtask.id,
              metadata: {
                projectName: project.title,
                dueDate: project.dueDate
              }
            })
          })
        }
      })
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    }

    try {
      // 4. Get School Events (Due Today)
      const subjects = await fetchWithCache<SchoolSubject[]>(
        '/api/school',
        userId,
        'school'
      )
      subjects.forEach((subject: SchoolSubject) => {
        if (subject.events) {
          subject.events.forEach((event: SchoolEvent) => {
            if (isSameDay(parseISO(event.date), date)) {
              tasks.push({
                id: `school-${subject.id}-${event.id}`,
                text: `${event.type === 'exam' ? 'Exam: ' : 'Assignment: '}${event.title}`,
                completed: event.completed,
                priority: 'high',
                source: 'school',
                sourceId: subject.id,
                originalId: event.id,
                metadata: {
                  subjectName: subject.name
                }
              })
            }
          })
        }
      })
    } catch (error) {
      console.error('Failed to fetch school subjects:', error)
    }

    try {
      // 5. Get Standalone Tasks
      const standaloneTasks = await fetchWithCache<Task[]>(
        '/api/tasks',
        userId,
        'tasks'
      )
      standaloneTasks.forEach((task: Task) => {
        const isRelevant =
          task.status !== "done" || (task.dueDate && isSameDay(parseISO(task.dueDate), date))

        if (isRelevant) {
          tasks.push({
            id: `task-${task.id}`,
            text: task.title,
            completed: task.status === "done",
            priority: task.priority,
            source: "standalone",
            sourceId: "standalone",
            originalId: task.id,
            metadata: {
              projectName: "Standalone Task",
              dueDate: task.dueDate,
            },
          })
        }
      })
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    }

    return tasks
  },

  // Get all events for the calendar
  getCalendarEvents: async (userId: string): Promise<CalendarEvent[]> => {
    const events: CalendarEvent[] = []

    try {
      // 1. Projects
      const projects = await fetchWithCache<Project[]>('/api/projects', userId, 'projects')
      projects.forEach((project: Project) => {
        if (project.dueDate) {
          events.push({
            id: `proj-${project.id}`,
            title: `Project Due: ${project.title}`,
            date: parseISO(project.dueDate),
            type: 'project',
            completed: project.status === 'completed',
            metadata: { priority: project.priority }
          })
        }
        if (project.startDate) {
          events.push({
            id: `proj-start-${project.id}`,
            title: `Start: ${project.title}`,
            date: parseISO(project.startDate),
            type: 'project',
            completed: false,
            metadata: { isStart: true }
          })
        }
      })
    } catch (error) {
      console.error('Failed to fetch projects for calendar:', error)
    }

    try {
      // 2. School Events
      const subjects = await fetchWithCache<SchoolSubject[]>('/api/school', userId, 'school')
      subjects.forEach((subject: SchoolSubject) => {
        if (subject.events) {
          subject.events.forEach((event: SchoolEvent) => {
            events.push({
              id: `school-${event.id}`,
              title: `${subject.name}: ${event.title}`,
              date: parseISO(event.date),
              type: 'school',
              completed: event.completed,
              metadata: { type: event.type }
            })
          })
        }
      })
    } catch (error) {
      console.error('Failed to fetch school subjects for calendar:', error)
    }

    return events
  },

  // Sync task completion back to source with offline support
  toggleTaskCompletion: async (userId: string, task: IntegratedTask) => {
    // Optimistic local update
    const updatedTask = { ...task, completed: !task.completed }

    try {
      if (task.source === "manual") {
        await syncToCloud(`/api/checklist/${task.id}`, { completed: updatedTask.completed }, 'PUT')
        // Update local cache
        const checklist = await getCachedData<ChecklistItem[]>('checklist', userId)
        if (checklist) {
          const updatedChecklist = checklist.data.map(item =>
            item.id === task.id ? { ...item, completed: updatedTask.completed } : item
          )
          await setCachedData('checklist', userId, updatedChecklist)
        }
      } else if (task.source === "routine") {
        // For routine tasks, we need to update the routine
        const routines = await getCachedData<Routine[]>('routines', userId)
        if (routines) {
          const routine = routines.data.find(r => r.id === task.sourceId)
          if (routine) {
            const updatedTasks = routine.tasks.map((t: RoutineTask) =>
              t.id === task.originalId ? { ...t, completed: updatedTask.completed } : t
            )
            const updatedRoutine = { ...routine, tasks: updatedTasks }
            const updatedRoutines = routines.data.map(r =>
              r.id === task.sourceId ? updatedRoutine : r
            )
            await setCachedData('routines', userId, updatedRoutines)
            await syncToCloud(`/api/routines/${task.sourceId}`, { tasks: updatedTasks }, 'PUT')
          }
        }
      } else if (task.source === "project") {
        // For project subtasks, update the project
        const projects = await getCachedData<Project[]>('projects', userId)
        if (projects) {
          const project = projects.data.find(p => p.id === task.sourceId)
          if (project) {
            const updatedSubtasks = project.subtasks.map((t: Subtask) =>
              t.id === task.originalId ? { ...t, completed: updatedTask.completed } : t
            )
            const updatedProject = { ...project, subtasks: updatedSubtasks }
            const updatedProjects = projects.data.map(p =>
              p.id === task.sourceId ? updatedProject : p
            )
            await setCachedData('projects', userId, updatedProjects)
            await syncToCloud(`/api/projects/${task.sourceId}`, { subtasks: updatedSubtasks }, 'PUT')
          }
        }
      } else if (task.source === "school") {
        // For school events, update the subject
        const subjects = await getCachedData<SchoolSubject[]>('school', userId)
        if (subjects) {
          const subject = subjects.data.find(s => s.id === task.sourceId)
          if (subject) {
            const updatedEvents = subject.events.map((e: SchoolEvent) =>
              e.id === task.originalId ? { ...e, completed: updatedTask.completed } : e
            )
            const updatedSubject = { ...subject, events: updatedEvents }
            const updatedSubjects = subjects.data.map(s =>
              s.id === task.sourceId ? updatedSubject : s
            )
            await setCachedData('school', userId, updatedSubjects)
            await syncToCloud(`/api/school/${task.sourceId}`, { events: updatedEvents }, 'PUT')
          }
        }
      } else if (task.source === "standalone") {
        const newStatus = updatedTask.completed ? "todo" : "done"
        await syncToCloud(`/api/tasks/${task.originalId}`, { status: newStatus }, 'PUT')
        // Update local cache
        const tasks = await getCachedData<Task[]>('tasks', userId)
        if (tasks) {
          const updatedTasks = tasks.data.map(t =>
            t.id === task.originalId ? { ...t, status: newStatus } : t
          )
          await setCachedData('tasks', userId, updatedTasks)
        }
      }

      // Emit WebSocket event for real-time sync
      if (typeof window !== 'undefined') {
        // Assume socket is available globally or through context
        // For now, we'll handle this in the component that calls this
      }
    } catch (error) {
      console.error('Failed to sync task completion:', error)
      // The operation is queued for later retry
    }

    return updatedTask
  },
}
