'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSession } from 'next-auth/react'

export interface AppSettings {
  // Appearance
  theme: 'light' | 'dark' | 'system' | 'auto'
  autoThemeEnabled: boolean
  autoThemeMode: 'system' | 'time' | 'both'
  compactMode: boolean
  showAnimations: boolean
  backgroundImage?: string
  backgroundBlur: number
  backgroundDimness: number
  autoContrast: boolean

  // Notifications
  dailyReminder: boolean
  routineNotifications: boolean
  projectDeadlines: boolean
  reminderTime: string

  // Profile
  displayName: string
  email: string

  // Data & Privacy
  autoBackup: boolean
  backupFrequency: 'daily' | 'weekly' | 'monthly'
  exportFormat: 'json' | 'csv' | 'pdf'

  // General
  startOfWeek: 'sunday' | 'monday' | 'saturday'
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
  timeFormat: '12h' | '24h'
  language: 'en' | 'es' | 'fr' | 'de'

  // Generic preferences for UI state (widgets, etc.)
  preferences: Record<string, any>
}

const defaultSettings: AppSettings = {
  theme: 'light',
  autoThemeEnabled: false,
  autoThemeMode: 'system',
  compactMode: false,
  showAnimations: true,
  backgroundImage: '',
  backgroundBlur: 40,
  backgroundDimness: 20,
  autoContrast: false,
  dailyReminder: true,
  routineNotifications: true,
  projectDeadlines: true,
  reminderTime: '09:00',
  displayName: '',
  email: '',
  autoBackup: true,
  backupFrequency: 'daily',
  exportFormat: 'json',
  startOfWeek: 'monday',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  language: 'en',
  preferences: {},
}

interface SettingsContextType {
  settings: AppSettings
  updateSettings: (updates: Partial<AppSettings>) => void
  resetSettings: () => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load settings from database when user logs in
  useEffect(() => {
    const loadSettings = async () => {
      if (status === 'loading') return

      if (status === 'authenticated' && session?.user?.id) {
        try {
          const response = await fetch('/api/user-settings')
          if (response.ok) {
            const data = await response.json()
            if (data.settings) {
              setSettings({ ...defaultSettings, ...data.settings })
            } else {
              setSettings(defaultSettings)
            }
          }
        } catch (error) {
          console.error('Failed to load settings from database:', error)
          // Fallback to default settings
          setSettings(defaultSettings)
        }
      } else {
        // User not logged in, use default settings
        setSettings(defaultSettings)
      }
      setIsLoaded(true)
    }

    loadSettings()
  }, [session?.user?.id, status])

  // Helper function to determine if it's daytime
  const isDaytime = () => {
    const now = new Date()
    const hour = now.getHours()
    return hour >= 6 && hour < 18 // 6 AM to 6 PM
  }

  // Apply theme changes
  useEffect(() => {
    if (!isLoaded) return

    const root = document.documentElement
    let isDark = false

    if (settings.theme === 'dark') {
      isDark = true
    } else if (settings.theme === 'light') {
      isDark = false
    } else if (settings.theme === 'auto' && settings.autoThemeEnabled) {
      // Auto theme logic
      if (settings.autoThemeMode === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      } else if (settings.autoThemeMode === 'time') {
        isDark = !isDaytime()
      } else if (settings.autoThemeMode === 'both') {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        const timeDark = !isDaytime()
        isDark = systemDark || timeDark
      }
    } else {
      // System theme (fallback)
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    }

    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    // Apply background settings
    root.style.setProperty('--bg-blur', `${settings.backgroundBlur}px`)
    root.style.setProperty('--bg-dimness', `${settings.backgroundDimness / 100}`)

    // Apply background image if set
    if (settings.backgroundImage) {
      document.body.style.backgroundImage = `url(${settings.backgroundImage})`
      document.body.style.backgroundSize = 'cover'
      document.body.style.backgroundPosition = 'center'
      document.body.style.backgroundAttachment = 'fixed'
    } else {
      document.body.style.backgroundImage = ''
      document.body.style.backgroundSize = ''
      document.body.style.backgroundPosition = ''
      document.body.style.backgroundAttachment = ''
    }

    // Set up listeners for auto themes
    if (settings.theme === 'auto' && settings.autoThemeEnabled) {
      const listeners: (() => void)[] = []

      if (settings.autoThemeMode === 'system' || settings.autoThemeMode === 'both') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleSystemChange = (e: MediaQueryListEvent) => {
          let newIsDark = e.matches
          if (settings.autoThemeMode === 'both') {
            newIsDark = newIsDark || !isDaytime()
          }
          root.classList.toggle('dark', newIsDark)
        }
        mediaQuery.addEventListener('change', handleSystemChange)
        listeners.push(() => mediaQuery.removeEventListener('change', handleSystemChange))
      }

      if (settings.autoThemeMode === 'time' || settings.autoThemeMode === 'both') {
        // Check every minute for time changes
        const timeInterval = setInterval(() => {
          let newIsDark = !isDaytime()
          if (settings.autoThemeMode === 'both') {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            newIsDark = systemDark || newIsDark
          }
          root.classList.toggle('dark', newIsDark)
        }, 60000) // Check every minute
        listeners.push(() => clearInterval(timeInterval))
      }

      return () => listeners.forEach(cleanup => cleanup())
    } else if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        root.classList.toggle('dark', e.matches)
      }
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [settings.theme, settings.autoThemeEnabled, settings.autoThemeMode, settings.backgroundBlur, settings.backgroundDimness, settings.backgroundImage, isLoaded])

  useEffect(() => {
    if (!isLoaded || !settings.dailyReminder) return

    const scheduleReminder = () => {
      const now = new Date()
      const [hours, minutes] = settings.reminderTime.split(':').map(Number)
      const scheduledTime = new Date(now)
      scheduledTime.setHours(hours, minutes, 0, 0)

      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1)
      }

      const timeUntilReminder = scheduledTime.getTime() - now.getTime()

      const timerId = setTimeout(() => {
        // Show notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Novo Reminder', {
            body: 'Time to check your daily tasks and routines!',
            icon: '/icon.svg',
          })
        }
        // Reschedule for next day
        scheduleReminder()
      }, timeUntilReminder)

      return timerId
    }

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const timerId = scheduleReminder()
    return () => clearTimeout(timerId)
  }, [settings.dailyReminder, settings.reminderTime, isLoaded])

  // Save settings to database
  useEffect(() => {
    if (isLoaded && session?.user?.id && status === 'authenticated') {
      const saveSettings = async () => {
        try {
          await fetch('/api/user-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings })
          })
        } catch (error) {
          console.error('Failed to save settings to database:', error)
        }
      }

      // Debounce saving to avoid too many API calls
      const timeoutId = setTimeout(saveSettings, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [settings, isLoaded, session?.user?.id, status])

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }))
  }

  const resetSettings = async () => {
    setSettings(defaultSettings)
    if (session?.user?.id) {
      try {
        await fetch('/api/user-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: defaultSettings })
        })
      } catch (error) {
        console.error('Failed to reset settings in database:', error)
      }
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    return {
      settings: defaultSettings,
      updateSettings: () => { },
      resetSettings: () => { }
    }
  }
  return context
}
