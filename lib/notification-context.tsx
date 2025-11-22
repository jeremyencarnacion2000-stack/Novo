'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { notificationScheduler } from './notification-scheduler'

export interface NotificationSettings {
  habitReminders: boolean
  taskNotifications: boolean
  progressAchievements: boolean
  soundEnabled: boolean
  vibrationEnabled: boolean
}

interface NotificationContextType {
  isSupported: boolean
  permission: NotificationPermission
  requestPermission: () => Promise<NotificationPermission>
  showNotification: (title: string, options?: NotificationOptions) => void
  scheduleNotification: (title: string, body: string, delay: number, data?: any) => void
  settings: NotificationSettings
  updateSettings: (updates: Partial<NotificationSettings>) => void
}

const defaultNotificationSettings: NotificationSettings = {
  habitReminders: true,
  taskNotifications: true,
  progressAchievements: true,
  soundEnabled: true,
  vibrationEnabled: true,
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [settings, setSettings] = useState<NotificationSettings>(defaultNotificationSettings)
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null)

  // Check if notifications are supported
  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator
    setIsSupported(supported)

    if (supported) {
      setPermission(Notification.permission)
    }
  }, [])

  // Load settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('novo-notification-settings')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setSettings({ ...defaultNotificationSettings, ...parsed })
      } catch (e) {
        console.error('Failed to parse notification settings:', e)
      }
    }

    // Load scheduled notifications
    notificationScheduler.loadFromStorage()
  }, [])

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('novo-notification-settings', JSON.stringify(settings))
  }, [settings])

  // Register service worker - DISABLED to fix redirect error
  // useEffect(() => {
  //   if (!isSupported) return

  //   const registerSW = async () => {
  //     try {
  //       const registration = await navigator.serviceWorker.register('/sw.js', {
  //         scope: '/'
  //       })

  //       console.log('Service Worker registered:', registration)

  //       // Handle updates
  //       registration.addEventListener('updatefound', () => {
  //         const newWorker = registration.installing
  //         if (newWorker) {
  //           newWorker.addEventListener('statechange', () => {
  //             if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
  //               // New version available
  //               console.log('New service worker version available')
  //             }
  //           }
  //         })

  //       setSwRegistration(registration)

  //       // Request notification permission if not already granted
  //       if (Notification.permission === 'default') {
  //         // We'll request permission when user enables notifications
  //       }

  //     } catch (error) {
  //       console.error('Service Worker registration failed:', error)
  //     }
  //   }

  //   registerSW()
  // }, [isSupported])

  // Listen for permission changes
  useEffect(() => {
    if (!isSupported) return

    const handlePermissionChange = () => {
      setPermission(Notification.permission)
    }

    // Check permission periodically (since there's no direct event)
    const interval = setInterval(() => {
      if (Notification.permission !== permission) {
        setPermission(Notification.permission)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isSupported, permission])

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      return 'denied'
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return 'denied'
    }
  }

  const showNotification = (title: string, options: NotificationOptions = {}) => {
    if (!isSupported || permission !== 'granted') {
      console.warn('Notifications not supported or permission not granted')
      return
    }

    const defaultOptions: NotificationOptions = {
      icon: '/icon.svg',
      badge: '/icon.svg',
      silent: !settings.soundEnabled,
      ...options
    }

    // Use service worker if available for background notifications
    if (swRegistration) {
      swRegistration.showNotification(title, defaultOptions)
    } else {
      // Fallback to direct notification
      new Notification(title, defaultOptions)
    }
  }

  const scheduleNotification = (title: string, body: string, delay: number, data?: any) => {
    if (!isSupported || permission !== 'granted') {
      console.warn('Cannot schedule notification: not supported or permission not granted')
      return
    }

    // Send message to service worker to schedule the notification
    if (swRegistration && swRegistration.active) {
      swRegistration.active.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        title,
        body,
        delay,
        data
      })
    } else {
      // Fallback: use setTimeout in main thread (won't work when page is closed)
      setTimeout(() => {
        showNotification(title, { body, data })
      }, delay)
    }
  }

  const updateSettings = (updates: Partial<NotificationSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }))
  }

  return (
    <NotificationContext.Provider
      value={{
        isSupported,
        permission,
        requestPermission,
        showNotification,
        scheduleNotification,
        settings,
        updateSettings,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}