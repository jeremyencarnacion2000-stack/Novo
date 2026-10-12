import { ChecklistItem } from "@/types/checklist"
import { Routine, RoutineTask } from "@/types/routine"
import { Project, Task, Subtask } from "@/types/project"
import { isSameDay, parseISO } from "date-fns"
import { trackActivity } from "@/lib/activity-tracker"
import { eventBus } from "@/lib/events/event-bus"
import { createClientIdempotencyKey } from "@/lib/client-idempotency"

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

  async addToQueue(operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'status'>): Promise<void> {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queue'], 'readwrite')
      const store = transaction.objectStore('queue')
      const request = store.add({ ...operation, timestamp: Date.now(), status: 'pending' })

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

  async updateQueueItem(id: number, updates: Partial<OfflineOperation>): Promise<void> {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queue'], 'readwrite')
      const store = transaction.objectStore('queue')
      const request = store.get(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const item = request.result
        if (item) {
          const updatedItem = { ...item, ...updates }
          const updateRequest = store.put(updatedItem)
          updateRequest.onerror = () => reject(updateRequest.error)
          updateRequest.onsuccess = () => resolve()
        } else {
          reject(new Error(`Item with id ${id} not found in queue.`))
        }
      }
    })
  }
}

interface OfflineOperation {
  id: number
  userId: string
  type: 'create' | 'update' | 'delete'
  endpoint: string
  data: any
  method: 'POST' | 'PUT' | 'DELETE'
  timestamp: number
  status: 'pending' | 'conflicted'
  serverData?: any
  // Every queued create keeps the same key from the first attempt through
  // offline replay so a network timeout cannot create a second record.
  idempotencyKey?: string
  // Present only for a 'create' queued while offline that assigned a local
  // temp-<timestamp> id to unblock optimistic UI. Lets syncPendingOperations
  // patch that temp id to the real server-generated one once the queued
  // create actually lands - without this, the temp id survives in the
  // IndexedDB cache forever, and any edit/delete on that item before a full
  // reload targets /api/.../temp-... and 404s server-side.
  reconcile?: { userId: string; cacheKind: string; tempId: string }
}

const offlineStorage = new OfflineStorage()
let activeDataIntegratorUserId: string | null = null

const scopedStorageKey = (base: string, userId: string) => `${base}:user:${userId}`
const backupStorageKey = (userId: string, date: string) => `novo-backup:${userId}:${date}`

export const clearUserLocalData = (userId: string) => {
  if (typeof window === 'undefined') return
  const suffix = `:user:${userId}`
  const directSuffix = `:${userId}`
  const backupPrefix = `novo-backup:${userId}:`
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key && (key.endsWith(suffix) || key.endsWith(directSuffix) || key.startsWith(backupPrefix))) keysToRemove.push(key)
  }
  keysToRemove.forEach(key => localStorage.removeItem(key))
}

/**
 * Select only mutations owned by the active account. This remains pure so the
 * account boundary can be regression-tested without opening IndexedDB.
 */
export function pendingOperationsForUser<T extends { status: string; userId?: string }>(
  queue: T[],
  userId: string
): T[] {
  return queue.filter(operation => operation.status === 'pending' && operation.userId === userId)
}

// Network status detection
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

// Sync data to cloud or queue for offline. `reconcile` is only meaningful
// for a 'create' (POST) whose caller already assigned a local temp id to an
// optimistically-inserted item - see OfflineOperation.reconcile.
const syncToCloud = async (
  userId: string,
  url: string,
  data: any,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST',
  reconcile?: { userId: string; cacheKind: string; tempId: string }
) => {
  const idempotencyKey = method === 'POST' ? createClientIdempotencyKey() : undefined
  const queueOperation = {
    userId,
    type: method === 'POST' ? 'create' as const : method === 'PUT' ? 'update' as const : 'delete' as const,
    endpoint: url,
    data,
    method,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    ...(method === 'POST' && reconcile ? { reconcile } : {}),
  }

  if (!isOnline) {
    // Queue for later sync
    await offlineStorage.addToQueue(queueOperation)
    return
  }

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      // If server error (5xx), throw to queue for retry
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.statusText}`)
      } else {
        // 4xx error - likely validation or logic error.
        // We shouldn't retry blindly, but we should log it.
        console.error(`Sync failed with ${response.status}; operation was not queued`)
        return // Don't queue
      }
    }

    // Callers (e.g. createManualTask) need the server-generated record — most
    // ignore this return value, which is safe since it's additive.
    return await response.json().catch(() => undefined)
  } catch {
    // Queue for later sync if network fails or server error
    console.error('Sync failed, queuing for later')
    await offlineStorage.addToQueue(queueOperation)
  }
}

// Sync pending operations when back online
async function syncPendingOperations(): Promise<void> {
  if (!isOnline || !activeDataIntegratorUserId) return

  try {
    const queue = await offlineStorage.getQueue()
    // Legacy entries created before the queue carried an owner cannot be
    // safely replayed under the current session. Remove them instead of
    // risking a cross-account write.
    const orphanedIds = queue
      .filter(op => !op.userId)
      .map(op => op.id)
    if (orphanedIds.length > 0) await offlineStorage.clearQueue(orphanedIds)

    const pendingOperations = pendingOperationsForUser(queue, activeDataIntegratorUserId)
    if (pendingOperations.length === 0) return

    const successfulIds: number[] = []

    for (const operation of pendingOperations) {
      try {
        const response = await fetch(operation.endpoint, {
          method: operation.method,
          headers: {
            'Content-Type': 'application/json',
            ...(operation.idempotencyKey ? { 'Idempotency-Key': operation.idempotencyKey } : {}),
          },
          body: JSON.stringify(operation.data)
        })

        if (response.ok) {
          successfulIds.push(operation.id)
          if (operation.reconcile) {
            try {
              const created = await response.json()
              if (created?.id) {
                const { userId, cacheKind, tempId } = operation.reconcile
                await reconcileCachedId(cacheKind, userId, tempId, created.id)
              }
            } catch {
              console.error(`Failed to reconcile temp id for operation ${operation.id}`)
            }
          }
        } else if (response.status === 409) {
          // Conflict
          const serverData = await response.json()
          await offlineStorage.updateQueueItem(operation.id, {
            status: 'conflicted',
            serverData
          })

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sync-conflict', { detail: { operation, serverData } }))
          }
        } else if (response.status >= 400 && response.status < 500) {
          // Client error, remove from queue as it will likely fail again
          console.error(`Removing invalid operation ${operation.id} from queue: ${response.status}`)
          successfulIds.push(operation.id) // Treat as "handled" to remove it
        }
        // 5xx errors will be left in queue (pending)
      } catch {
        console.error(`Failed to sync operation ${operation.id}`)
        // Network error, leave in queue
      }
    }

    if (successfulIds.length > 0) {
      await offlineStorage.clearQueue(successfulIds)
    }
    // For now, we'll emit an event that components can listen to
    if (typeof window !== 'undefined') {
      const updatedConflicts = await offlineStorage.getQueue()
      window.dispatchEvent(new CustomEvent('sync-conflicts', { detail: updatedConflicts.filter(op => op.status === 'conflicted') }))
    }
  } catch {
    console.error('Error syncing pending operations')
  }
}

interface Conflict {
  operation: OfflineOperation
  serverData: any
  localData: any
}

// Types for our integrated data
export interface IntegratedTask extends ChecklistItem {
  source: "manual" | "routine" | "project" | "standalone" | "project-task" | "school"
  sourceId?: string | null // ID of the routine, project, or subject
  originalId?: string // ID of the task within the source
  task?: Task | null // For linked tasks
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
  type: "task" | "project" | "routine" | "habit" | "google" | "school"
  completed: boolean
  metadata?: Record<string, unknown>
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

// Swaps a temp id for the real server id in a cached array, once a queued
// offline 'create' finally lands. No-ops quietly if the cache entry is gone
// or the item isn't there (e.g. a later online session already replaced the
// cache from a real fetch) - reconciliation is best-effort, not required for
// correctness once fresh server data is loaded again anyway.
// Pure swap, split out from the IndexedDB I/O below so it's testable without
// mocking IndexedDB.
export function swapTempId<T extends { id: string }>(items: T[], tempId: string, realId: string): T[] {
  return items.map(item => (item.id === tempId ? { ...item, id: realId } : item))
}

async function reconcileCachedId(cacheKind: string, userId: string, tempId: string, realId: string): Promise<void> {
  const cached = await getCachedData<{ id: string }[]>(cacheKind, userId)
  if (!cached || !Array.isArray(cached.data)) return
  await setCachedData(cacheKind, userId, swapTempId(cached.data, tempId, realId))
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
    if (!response.ok) {
      const error = new Error(`API error: ${response.statusText}`)
        ; (error as any).status = response.status
      throw error
    }
    const data = await response.json()
    await setCachedData(cacheKey, userId, data)
    return data
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.warn(`Network error for ${url}. Falling back to cache.`)
      const cached = await getCachedData<T>(cacheKey, userId)
      if (cached) return cached.data
    }
    throw error
  }
}

export interface BackupData {
  version: string
  timestamp: string
  settings: any
  checklist: any[]
  routines: any[]
  projects: any[]
  tasks: any[]
  trackers: any[]
}

/**
 * A backup import can be retried after a timeout or a partial network failure.
 * Keep one deterministic key per item/file so the server's MutationRequest
 * boundary converges a retry instead of creating a second copy. The backup
 * timestamp intentionally scopes a new export as a new import intent.
 */
export function backupImportKey(kind: string, item: any, backupTimestamp: string, index: number) {
  const identity = String(item?.id ?? item?.externalId ?? item?.title ?? item?.name ?? index)
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .slice(0, 72)
  const timestamp = backupTimestamp.replace(/[^a-zA-Z0-9]+/g, '').slice(0, 32)
  return `backup:${timestamp}:${kind}:${identity || index}`.slice(0, 128)
}

// Module-level timer so we can clear it across calls within the same session.
// localStorage cannot store live timer IDs — they are process-local and meaningless after reload.
let _autoBackupTimer: ReturnType<typeof setInterval> | null = null
let _initialSyncTimer: ReturnType<typeof setTimeout> | null = null

export const DataIntegrator = {
  clearUserLocalData,
  // Initialize sync listeners and run initial sync (idempotent — safe to call multiple times)
  _initialized: false,
  _handleOnline: () => { isOnline = true; syncPendingOperations() },
  _handleOffline: () => { isOnline = false },

  initialize: function(userId?: string) {
    // The offline queue lives in a shared IndexedDB database. Bind the
    // listener to the authenticated account before any replay can run so a
    // queue created by account A is never flushed while account B is active.
    activeDataIntegratorUserId = userId ?? null
    if (this._initialized || typeof window === 'undefined') return
    this._initialized = true

    if (navigator.onLine && activeDataIntegratorUserId) {
      // Replaying an offline queue is important, but an IndexedDB open and
      // any queued requests should not compete with the first route paint.
      _initialSyncTimer = setTimeout(() => {
        _initialSyncTimer = null
        void syncPendingOperations()
      }, 1200)
    }

    window.addEventListener('online', this._handleOnline)
    window.addEventListener('offline', this._handleOffline)
  },

  destroy: function() {
    activeDataIntegratorUserId = null
    if (_initialSyncTimer !== null) {
      clearTimeout(_initialSyncTimer)
      _initialSyncTimer = null
    }
    if (!this._initialized || typeof window === 'undefined') return
    window.removeEventListener('online', this._handleOnline)
    window.removeEventListener('offline', this._handleOffline)
    this.cancelAutoBackup()
    this._initialized = false
  },

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
      tasks: [],
      trackers: []
    }

    try {
      const settingsStr = localStorage.getItem(scopedStorageKey('novo-settings', userId))
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

    if (!backupData.version || !backupData.timestamp) {
      throw new Error('Invalid backup file: missing version or timestamp')
    }

    // Import settings
    if (backupData.settings && Object.keys(backupData.settings).length > 0) {
      try {
        const settingsKey = scopedStorageKey('novo-settings', userId)
        const currentSettings = localStorage.getItem(settingsKey)
        if (currentSettings && !options.overwrite) {
          result.conflicts.push({
            type: 'settings',
            current: JSON.parse(currentSettings),
            incoming: backupData.settings
          })
        } else {
          localStorage.setItem(settingsKey, JSON.stringify(backupData.settings))
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
          for (const item of current) {
            await fetch(`/api/checklist/${item.id}`, { method: 'DELETE' })
          }
          for (const [index, item] of backupData.checklist.entries()) {
            await fetch('/api/checklist', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': backupImportKey('checklist', item, backupData.timestamp, index),
              },
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
          for (const [index, item] of backupData.routines.entries()) {
            await fetch('/api/routines', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': backupImportKey('routine', item, backupData.timestamp, index),
              },
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
          for (const [index, item] of backupData.projects.entries()) {
            await fetch('/api/projects', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': backupImportKey('project', item, backupData.timestamp, index),
              },
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
          for (const [index, item] of backupData.tasks.entries()) {
            await fetch('/api/tasks', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': backupImportKey('task', item, backupData.timestamp, index),
              },
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
          for (const [index, item] of backupData.trackers.entries()) {
            await fetch('/api/trackers', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': backupImportKey('tracker', item, backupData.timestamp, index),
              },
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

  // Auto-backup scheduling. The timer lives in memory by design; storing a
  // browser interval id in localStorage cannot cancel it after a reload and
  // can leave an old user's export running after logout.
  cancelAutoBackup: (userId?: string) => {
    if (_autoBackupTimer !== null) {
      clearInterval(_autoBackupTimer)
      _autoBackupTimer = null
    }
    if (typeof window !== 'undefined' && userId) {
      localStorage.removeItem(scopedStorageKey('novo-auto-backup-frequency', userId))
    }
  },

  scheduleAutoBackup: (userId: string, frequency: 'daily' | 'weekly' | 'monthly') => {
    DataIntegrator.cancelAutoBackup(userId)

    const getInterval = (freq: string) => {
      switch (freq) {
        case 'daily': return 24 * 60 * 60 * 1000
        case 'weekly': return 7 * 24 * 60 * 60 * 1000
        case 'monthly': return 30 * 24 * 60 * 60 * 1000
        default: return 24 * 60 * 60 * 1000
      }
    }

    const interval = getInterval(frequency)

    const backup = async () => {
      try {
        const data = await DataIntegrator.exportData(userId)
        const backupKey = backupStorageKey(userId, new Date().toISOString().split('T')[0])
        localStorage.setItem(backupKey, JSON.stringify(data))
        console.log('Auto-backup completed:', backupKey)
      } catch (error) {
        console.error('Auto-backup failed:', error)
      }
    }

    _autoBackupTimer = setInterval(backup, interval)
    localStorage.setItem(scopedStorageKey('novo-auto-backup-frequency', userId), frequency)
  },

  // Get available backups
  getAvailableBackups: (userId: string): { date: string, data: BackupData }[] => {
    const backups: { date: string, data: BackupData }[] = []
    const prefix = `novo-backup:${userId}:`
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        try {
          const data = JSON.parse(localStorage.getItem(key)!)
          backups.push({
            date: key.replace(prefix, ''),
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
    const backupKey = backupStorageKey(userId, backupDate)
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
    // A task due today has a linked ChecklistItem mirror. Keep the mirror as
    // the single daily-queue representation; adding the canonical Task again
    // below would make one user action appear twice in Checklist/Twin views.
    const linkedTaskIds = new Set<string>()

    try {
      // 1. Get Manual Checklist Items
      const manualItems = await fetchWithCache<ChecklistItem[]>(
        '/api/checklist',
        userId,
        'checklist'
      )
      manualItems.forEach((item: ChecklistItem) => {
        if (item.task) {
          linkedTaskIds.add(item.task.id)
          tasks.push({
            ...item,
            source: 'project-task',
            metadata: {
              projectName: item.task.project?.title || 'Project Task'
            }
          })
        } else {
          tasks.push({
            ...item,
            source: 'manual'
          })
        }
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
      // 4. Get Standalone Tasks
      const standaloneTasks = await fetchWithCache<Task[]>(
        '/api/tasks',
        userId,
        'tasks'
      )
      standaloneTasks.forEach((task: Task) => {
        if (linkedTaskIds.has(task.id)) return
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
      // 2. Google Calendar Events
      const googleEvents = await fetchWithCache<any[]>('/api/calendar/google', userId, 'google-calendar')
      googleEvents.forEach((event: any) => {
        if (event.start?.dateTime || event.start?.date) {
          events.push({
            id: `google-${event.id}`,
            title: event.summary || '(No Title)',
            date: parseISO(event.start.dateTime || event.start.date),
            type: 'google',
            completed: false,
            metadata: {
              description: event.description,
              location: event.location,
              htmlLink: event.htmlLink
            }
          })
        }
      })
    } catch (error) {
      console.error('Failed to fetch Google Calendar events:', error)
    }

    try {
      // 3. Standalone Tasks
      const tasks = await fetchWithCache<Task[]>('/api/tasks', userId, 'tasks')
      tasks.forEach((task: Task) => {
        if (task.dueDate) {
          events.push({
            id: `task-${task.id}`,
            title: task.title,
            date: parseISO(task.dueDate),
            type: 'task',
            completed: task.status === 'done',
            metadata: { priority: task.priority }
          })
        }
      })
    } catch (error) {
      console.error('Failed to fetch tasks for calendar:', error)
    }

    return events
  },

  // Sync task completion back to source with offline support
  toggleTaskCompletion: async (userId: string, task: IntegratedTask) => {
    const updatedTask = { ...task, completed: !task.completed }

    if (updatedTask.completed) {
      trackActivity('task', true, { id: task.id, name: task.text, module: task.source }).catch(err =>
        console.error('Failed to track task completion:', err)
      )
      eventBus.dispatch('TaskCompleted', {
        taskId: task.id,
        taskTitle: task.text,
        source: task.source
      })
    }

    try {
      if (task.source === "manual") {
        await syncToCloud(userId, `/api/checklist/${task.id}`, { completed: updatedTask.completed }, 'PUT')
        const checklist = await getCachedData<ChecklistItem[]>('checklist', userId)
        if (checklist) {
          const updatedChecklist = checklist.data.map(item =>
            item.id === task.id ? { ...item, completed: updatedTask.completed } : item
          )
          await setCachedData('checklist', userId, updatedChecklist)
        }
      } else if (task.source === "routine") {
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
            await syncToCloud(userId, `/api/routines/${task.sourceId}`, { tasks: updatedTasks }, 'PUT')
          }
        }
      } else if (task.source === "project") {
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
            await syncToCloud(userId, `/api/projects/${task.sourceId}`, { subtasks: updatedSubtasks }, 'PUT')
          }
        }
      } else if (task.source === "standalone") {
        const newStatus = updatedTask.completed ? "done" : "todo"
        await syncToCloud(userId, `/api/tasks/${task.originalId}`, { status: newStatus }, 'PUT')
        const tasks = await getCachedData<Task[]>('tasks', userId)
        if (tasks) {
          const updatedTasks = tasks.data.map(t =>
            t.id === task.originalId ? { ...t, status: newStatus } : t
          )
          await setCachedData('tasks', userId, updatedTasks)
        }
      } else if (task.source === "project-task") {
        await syncToCloud(userId, `/api/checklist/${task.id}`, { completed: updatedTask.completed }, 'PUT')
        const newStatus = updatedTask.completed ? "done" : "todo"
        await syncToCloud(userId, `/api/tasks/${task.task?.id}`, { status: newStatus }, 'PUT')
        const checklist = await getCachedData<ChecklistItem[]>('checklist', userId)
        if (checklist) {
          const updatedChecklist = checklist.data.map(item =>
            item.id === task.id ? { ...item, completed: updatedTask.completed } : item
          )
          await setCachedData('checklist', userId, updatedChecklist)
        }
        const tasks = await getCachedData<Task[]>('tasks', userId)
        if (tasks) {
          const updatedTasks = tasks.data.map(t =>
            t.id === task.task?.id ? { ...t, status: newStatus } : t
          )
          await setCachedData('tasks', userId, updatedTasks)
        }
      }
    } catch (error) {
      console.error('Failed to sync task completion:', error)
    }

    return updatedTask
  },


  // Create a new manual task
  createManualTask: async (userId: string, taskData: any) => {
    const tempId = `temp-${Date.now()}`
    const newTask = { ...taskData, id: tempId, source: 'manual' }

    try {
      const checklist = await getCachedData<ChecklistItem[]>('checklist', userId)
      if (checklist) {
        await setCachedData('checklist', userId, [...checklist.data, newTask])
      }
      // POST /api/checklist returns the DB-generated record — without wiring
      // its real id back, the item keeps the temp id in local state and any
      // toggle/delete on it before a reload silently 404s server-side. If
      // this goes offline instead, the reconcile context lets
      // syncPendingOperations do the same swap once the queued create
      // actually lands, instead of the temp id surviving forever.
      const created = await syncToCloud(userId, '/api/checklist', taskData, 'POST', { userId, cacheKind: 'checklist', tempId })
      if (created?.id) {
        newTask.id = created.id
      }
      eventBus.dispatch('TaskCreated', {
        taskId: newTask.id,
        taskTitle: taskData.text || taskData.title,
        source: 'manual'
      })
    } catch (error) {
      console.error('Failed to create manual task:', error)
    }
    return newTask
  },

  // Delete a manual task
  deleteManualTask: async (userId: string, taskId: string) => {
    try {
      const checklist = await getCachedData<ChecklistItem[]>('checklist', userId)
      if (checklist) {
        const updatedChecklist = checklist.data.filter(item => item.id !== taskId)
        await setCachedData('checklist', userId, updatedChecklist)
      }
      await syncToCloud(userId, `/api/checklist/${taskId}`, {}, 'DELETE')
    } catch (error) {
      console.error('Failed to delete manual task:', error)
    }
  },

  // Get standalone tasks
  getTasks: async (userId: string) => {
    return await fetchWithCache<Task[]>('/api/tasks', userId, 'tasks')
  },

  // Create standalone task
  createTask: async (userId: string, taskData: any) => {
    const tempId = `temp-${Date.now()}`
    const newTask = { ...taskData, id: tempId, createdAt: new Date().toISOString() }

    try {
      const tasks = await getCachedData<Task[]>('tasks', userId)
      if (tasks) {
        await setCachedData('tasks', userId, [...tasks.data, newTask])
      }
      // POST /api/tasks returns the DB-generated record — same fix as
      // createManualTask above: without wiring the real id back, the caller
      // (tasks-view.tsx) keeps the temp id in React state for the rest of the
      // session, and any updateTask/deleteTask on it before a reload 404s
      // server-side while the UI shows the edit/delete as having succeeded.
      // Reconcile context covers the same gap for the offline-queue path.
      const created = await syncToCloud(userId, '/api/tasks', taskData, 'POST', { userId, cacheKind: 'tasks', tempId })
      if (created?.id) {
        newTask.id = created.id
      }
      eventBus.dispatch('TaskCreated', {
        taskId: newTask.id,
        taskTitle: taskData.title,
        source: 'standalone'
      })
      if (taskData.dueDate) {
        eventBus.dispatch('CalendarModified', {
          action: 'create',
          eventId: newTask.id,
          eventTitle: taskData.title,
          date: taskData.dueDate
        })
      }
    } catch (error) {
      console.error('Failed to create task:', error)
    }
    return newTask
  },

  // Update standalone task
  updateTask: async (userId: string, taskId: string, updates: any) => {
    try {
      const tasks = await getCachedData<Task[]>('tasks', userId)
      if (tasks) {
        const updatedTasks = tasks.data.map(t => t.id === taskId ? { ...t, ...updates } : t)
        await setCachedData('tasks', userId, updatedTasks)
      }
      await syncToCloud(userId, `/api/tasks/${taskId}`, updates, 'PUT')
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  },

  // Delete standalone task
  deleteTask: async (userId: string, taskId: string) => {
    try {
      const tasks = await getCachedData<Task[]>('tasks', userId)
      if (tasks) {
        const updatedTasks = tasks.data.filter(t => t.id !== taskId)
        await setCachedData('tasks', userId, updatedTasks)
      }
      await syncToCloud(userId, `/api/tasks/${taskId}`, {}, 'DELETE')
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  },
}
