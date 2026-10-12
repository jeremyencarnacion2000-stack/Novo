import { useNotifications } from './notification-context'

export interface ScheduledNotification {
  id: string
  title: string
  body: string
  scheduledTime: Date
  type: 'habit' | 'task' | 'progress' | 'general'
  data?: any
}

class NotificationScheduler {
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map()
  private timeouts: Map<string, NodeJS.Timeout> = new Map()
  private storageScope: string | null = null

  private storageKey() {
    return this.storageScope ? `novo-scheduled-notifications:${this.storageScope}` : null
  }

  // The scheduler is a module singleton, while the app can change sessions
  // without a full page reload. Tear down the old user's timers before
  // hydrating the new user's queue so reminders never cross accounts.
  setStorageScope(scope: string | null) {
    if (this.storageScope === scope) return
    this.timeouts.forEach(timeout => clearTimeout(timeout))
    this.timeouts.clear()
    this.scheduledNotifications.clear()
    this.storageScope = scope
    if (scope) this.loadFromStorage()
  }

  // Schedule a notification
  schedule(notification: Omit<ScheduledNotification, 'id'>): string {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const scheduledNotification: ScheduledNotification = { ...notification, id }

    this.scheduledNotifications.set(id, scheduledNotification)

    const delay = scheduledNotification.scheduledTime.getTime() - Date.now()

    if (delay > 0) {
      const timeout = setTimeout(() => {
        this.executeNotification(scheduledNotification)
      }, delay)

      this.timeouts.set(id, timeout)
    } else {
      // If the time has already passed, execute immediately
      this.executeNotification(scheduledNotification)
    }

    // Save to localStorage for persistence
    this.saveToStorage()

    return id
  }

  // Cancel a scheduled notification
  cancel(id: string): boolean {
    const timeout = this.timeouts.get(id)
    if (timeout) {
      clearTimeout(timeout)
      this.timeouts.delete(id)
    }

    const removed = this.scheduledNotifications.delete(id)
    if (removed) {
      this.saveToStorage()
    }

    return removed
  }

  // Get all scheduled notifications
  getScheduled(): ScheduledNotification[] {
    return Array.from(this.scheduledNotifications.values())
  }

  // Get notifications by type
  getByType(type: ScheduledNotification['type']): ScheduledNotification[] {
    return this.getScheduled().filter(n => n.type === type)
  }

  // Execute a notification (internal method)
  private executeNotification(notification: ScheduledNotification) {
    // This would normally use the notification context, but since this is a utility class,
    // we'll need to handle it differently. For now, we'll use the browser Notification API directly.

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const options: NotificationOptions = {
        body: notification.body,
        icon: '/icon.svg',
        badge: '/icon.svg',
        data: notification.data,
        tag: `novo-${notification.type}-${notification.id}`
      }

      try {
        new Notification(notification.title, options)
      } catch {
        // Browser permission can change between the check and construction;
        // a reminder must never surface an unhandled error.
      }
    }

    // Remove from scheduled list after execution
    this.scheduledNotifications.delete(notification.id)
    this.timeouts.delete(notification.id)
    this.saveToStorage()
  }

  // Save scheduled notifications to localStorage
  private saveToStorage() {
    const key = this.storageKey()
    if (!key) return
    try {
      const notifications = Array.from(this.scheduledNotifications.values())
      localStorage.setItem(key, JSON.stringify(notifications))
    } catch {
      console.error('Failed to save scheduled notifications.')
    }
  }

  // Load scheduled notifications from localStorage
  loadFromStorage() {
    const key = this.storageKey()
    if (!key) return
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        const notifications: ScheduledNotification[] = JSON.parse(stored)
        const now = Date.now()

        notifications.forEach(notification => {
          // Only restore future notifications
          if (new Date(notification.scheduledTime).getTime() > now) {
            this.scheduledNotifications.set(notification.id, notification)

            const delay = new Date(notification.scheduledTime).getTime() - now
            const timeout = setTimeout(() => {
              this.executeNotification(notification)
            }, delay)

            this.timeouts.set(notification.id, timeout)
          }
        })
      }
    } catch {
      console.error('Failed to load scheduled notifications.')
    }
  }

  // Clear all scheduled notifications
  clearAll() {
    this.timeouts.forEach(timeout => clearTimeout(timeout))
    this.timeouts.clear()
    this.scheduledNotifications.clear()
    const key = this.storageKey()
    if (key) localStorage.removeItem(key)
  }
}

// Singleton instance
export const notificationScheduler = new NotificationScheduler()

// React hook for using the scheduler
export function useNotificationScheduler() {
  const { scheduleNotification } = useNotifications()

  return {
    schedule: (title: string, body: string, delay: number, data?: any) => {
      return notificationScheduler.schedule({
        title,
        body,
        scheduledTime: new Date(Date.now() + delay),
        type: 'general',
        data
      })
    },

    scheduleHabitReminder: (habitName: string, delay: number) => {
      return notificationScheduler.schedule({
        title: 'Habit Reminder',
        body: `Time for your ${habitName} habit!`,
        scheduledTime: new Date(Date.now() + delay),
        type: 'habit',
        data: { habitName }
      })
    },

    scheduleTaskNotification: (taskTitle: string, delay: number) => {
      return notificationScheduler.schedule({
        title: 'Task Reminder',
        body: `Don't forget: ${taskTitle}`,
        scheduledTime: new Date(Date.now() + delay),
        type: 'task',
        data: { taskTitle }
      })
    },

    scheduleProgressAchievement: (achievement: string, delay: number) => {
      return notificationScheduler.schedule({
        title: 'Achievement Unlocked!',
        body: achievement,
        scheduledTime: new Date(Date.now() + delay),
        type: 'progress',
        data: { achievement }
      })
    },

    cancel: (id: string) => notificationScheduler.cancel(id),
    getScheduled: () => notificationScheduler.getScheduled(),
    getByType: (type: ScheduledNotification['type']) => notificationScheduler.getByType(type),
    clearAll: () => notificationScheduler.clearAll()
  }
}
