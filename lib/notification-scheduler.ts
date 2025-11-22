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

    if ('Notification' in window && Notification.permission === 'granted') {
      const options: NotificationOptions = {
        body: notification.body,
        icon: '/icon.svg',
        badge: '/icon.svg',
        data: notification.data,
        tag: `novo-${notification.type}-${notification.id}`
      }

      new Notification(notification.title, options)
    }

    // Remove from scheduled list after execution
    this.scheduledNotifications.delete(notification.id)
    this.timeouts.delete(notification.id)
    this.saveToStorage()
  }

  // Save scheduled notifications to localStorage
  private saveToStorage() {
    try {
      const notifications = Array.from(this.scheduledNotifications.values())
      localStorage.setItem('novo-scheduled-notifications', JSON.stringify(notifications))
    } catch (error) {
      console.error('Failed to save scheduled notifications:', error)
    }
  }

  // Load scheduled notifications from localStorage
  loadFromStorage() {
    try {
      const stored = localStorage.getItem('novo-scheduled-notifications')
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
    } catch (error) {
      console.error('Failed to load scheduled notifications:', error)
    }
  }

  // Clear all scheduled notifications
  clearAll() {
    this.timeouts.forEach(timeout => clearTimeout(timeout))
    this.timeouts.clear()
    this.scheduledNotifications.clear()
    localStorage.removeItem('novo-scheduled-notifications')
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