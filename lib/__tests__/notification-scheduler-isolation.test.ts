import { notificationScheduler } from '@/lib/notification-scheduler'

describe('notification scheduler session isolation', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    localStorage.clear()
    notificationScheduler.setStorageScope(null)
  })

  afterEach(() => {
    notificationScheduler.setStorageScope(null)
    jest.useRealTimers()
  })

  it('does not restore reminders across accounts', () => {
    notificationScheduler.setStorageScope('user:user-a')
    const id = notificationScheduler.schedule({
      title: 'A reminder',
      body: 'Private',
      scheduledTime: new Date(Date.now() + 60_000),
      type: 'general',
    })

    expect(localStorage.getItem('novo-scheduled-notifications:user:user-a')).toContain(id)
    notificationScheduler.setStorageScope('user:user-b')
    expect(notificationScheduler.getScheduled()).toHaveLength(0)
    expect(localStorage.getItem('novo-scheduled-notifications:user:user-b')).toBeNull()

    notificationScheduler.setStorageScope('user:user-a')
    expect(notificationScheduler.getScheduled()).toHaveLength(1)
  })

  it('does not throw when the browser rejects a native notification', () => {
    const originalNotification = (window as Window & { Notification?: unknown }).Notification
    class ThrowingNotification {
      static permission = 'granted'
      constructor() {
        throw new Error('notification blocked')
      }
    }

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: ThrowingNotification,
    })

    expect(() => notificationScheduler.schedule({
      title: 'Reminder',
      body: 'Body',
      scheduledTime: new Date(Date.now() - 1),
      type: 'general',
    })).not.toThrow()

    if (originalNotification === undefined) {
      delete (window as Window & { Notification?: unknown }).Notification
    } else {
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: originalNotification,
      })
    }
  })
})
