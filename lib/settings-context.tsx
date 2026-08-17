'use client'

import { createContext, useContext, useState, useEffect, useLayoutEffect, ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useSession } from 'next-auth/react'
import { runAppearanceTransition } from '@/lib/appearance-transition'
import { resolveMaterialContract } from '@/lib/material-contract'

export interface AppSettings {
  // Appearance
  theme: 'light' | 'dark' | 'system' | 'auto'
  autoThemeEnabled: boolean
  autoThemeMode: 'system' | 'time' | 'both'
  compactMode: boolean
  showAnimations: boolean
  backgroundImage?: string
  backgroundHistory: string[]  // Recent wallpapers (Windows 10/11 style)
  backgroundBlur: number
  backgroundDimness: number
  autoContrast: boolean
  glassOpacity: number
  glassBlur: number
  accentColor: string
  // Dashboard Card — Liquid Glass layer (independent from sidebar frosted glass)
  cardOpacity: number
  cardLiquidIntensity: number

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

export interface SettingsContextType {
  settings: AppSettings
  updateSettings: (updates: Partial<AppSettings>) => void
  resetSettings: () => void
  isSettingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}

const defaultSettings: AppSettings = {
  theme: 'light',
  autoThemeEnabled: false,
  autoThemeMode: 'system',
  compactMode: false,
  showAnimations: true,
  backgroundImage: '',
  backgroundHistory: [],
  backgroundBlur: 0,
  backgroundDimness: 15,
  autoContrast: false,
  glassOpacity: 12,
  glassBlur: 20,
  accentColor: 'indigo',
  cardOpacity: 15,
  cardLiquidIntensity: 16,
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

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load settings from database when user logs in
  useLayoutEffect(() => {
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

    const applyEffectiveTheme = (nextIsDark: boolean) => {
      root.classList.toggle('dark', nextIsDark)

      // Inline custom properties outrank the .dark fallbacks in globals.css,
      // so every system/time theme transition must refresh the complete
      // contract instead of only toggling the class.
      const material = resolveMaterialContract({
        theme: nextIsDark ? 'dark' : 'light',
        backgroundImage: settings.backgroundImage,
        backgroundDimness: settings.backgroundDimness,
        backgroundBlur: settings.backgroundBlur,
        autoContrast: settings.autoContrast,
        glassOpacity: settings.glassOpacity,
        glassBlur: settings.glassBlur,
        cardOpacity: settings.cardOpacity,
        cardLiquidIntensity: settings.cardLiquidIntensity,
      })

      const materialVariables = {
        '--novo-canvas-background': material.canvas.background,
        '--novo-canvas-backdrop-filter': material.canvas.backdropFilter,
        '--novo-canvas-border': material.canvas.border,
        '--novo-canvas-box-shadow': material.canvas.boxShadow,
        '--novo-context-background': material.contextGlass.background,
        '--novo-context-backdrop-filter': material.contextGlass.backdropFilter,
        '--novo-context-border': material.contextGlass.border,
        '--novo-context-box-shadow': material.contextGlass.boxShadow,
        '--novo-focus-background': material.focusSurface.background,
        '--novo-focus-backdrop-filter': material.focusSurface.backdropFilter,
        '--novo-focus-border': material.focusSurface.border,
        '--novo-focus-box-shadow': material.focusSurface.boxShadow,
        // Settings owns the appearance of its own backdrop too. Keeping the
        // overlay values on the same root contract prevents DialogOverlay's
        // default black/blur treatment from masking Background Dimness/Blur.
        '--novo-dialog-overlay-opacity': `${Math.max(0, Math.min(0.8, settings.backgroundDimness / 100))}`,
        '--novo-dialog-overlay-blur': `${Math.max(0, settings.backgroundBlur)}px`,
      }

      Object.entries(materialVariables).forEach(([property, value]) => {
        root.style.setProperty(property, value)
      })

      // Preserve the original Novo variable namespaces used by the restored
      // sidebar and card primitives. The material contract remains the source
      // of wallpaper safety; these aliases keep the existing Settings controls
      // connected to the historical presentation instead of replacing it.
      const sidebarOpacity = Math.max(0, settings.glassOpacity / 100)
      const effectiveSidebarOpacity = sidebarOpacity
      const sidebarBlur = `${settings.glassBlur}px`
      const cardOpacity = Math.max(0, settings.cardOpacity / 100)
      const cardBlur = `${Math.max(0, settings.cardLiquidIntensity)}px`
      const cardRefraction = Math.min(0.25, cardOpacity * 1.5)
      const legacyVariables = {
        '--sidebar-blur-px': sidebarBlur,
        '--sidebar-opacity': `${effectiveSidebarOpacity}`,
        '--glass-opacity': `${effectiveSidebarOpacity}`,
        '--glass-blur': `${settings.glassBlur}`,
        '--glass-blur-px': sidebarBlur,
        '--card-liquid-opacity': `${cardOpacity}`,
        '--card-blur-px': cardBlur,
        '--card-refraction': `${cardRefraction}`,
      }

      Object.entries(legacyVariables).forEach(([property, value]) => {
        root.style.setProperty(property, value)
        document.body.style.setProperty(property, value)
      })
    }

    applyEffectiveTheme(isDark)

    // Sincronizar preferencia de animaciones/efectos en el DOM root
    root.setAttribute('data-animations', settings.showAnimations ? 'true' : 'false')

    // Apply accent color
    const colors: Record<string, string> = {
      indigo: '#6366f1',
      purple: '#a855f7',
      blue: '#3b82f6',
      cyan: '#06b6d4',
      green: '#22c55e',
      pink: '#ec4899',
      red: '#ef4444',
      orange: '#f97316',
      rose: '#f43f5e',
      violet: '#8b5cf6',
    }

    const color = colors[settings.accentColor] || colors.indigo
    root.style.setProperty('--primary', color)
    root.style.setProperty('--ring', color)

    // Helper to Convert Hex to RGB for shadows/glows
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return `${r}, ${g}, ${b}`
    }
    const rgb = hexToRgb(color)
    root.style.setProperty('--primary-rgb', rgb)
    root.style.setProperty('--primary-glow', `rgba(${rgb}, 0.5)`)

    // Calculate a darker/lighter variant for other uses if needed, or just let Tailwind handles opacity variants
    // converting hex to rgb for tailwind using --primary: R G B format if we were using that method, 
    // but here we are using hex directly in --primary. 
    // Note: Tailwind v4 might handle this differently, but v3 usually needs RGB numbers for opacity modifiers.
    // However, the current globals.css defines --primary as a HEX.
    // So distinct --primary-foreground might be needed for contrast.
    // For now, let's assume white foreground is fine for all these bright colors.
    root.style.setProperty('--primary-foreground', '#ffffff')


    // The class controls whether the Canvas wallpaper layer participates in
    // layout; all paint and filtering values come from the contract above.
    if (settings.backgroundImage) {
      document.body.classList.add('has-bg-image')
    } else {
      document.body.classList.remove('has-bg-image')
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
          applyEffectiveTheme(newIsDark)
        }
        mediaQuery.addEventListener('change', handleSystemChange)
        listeners.push(() => mediaQuery.removeEventListener('change', handleSystemChange))
      }

      if (settings.autoThemeMode === 'time' || settings.autoThemeMode === 'both') {
        // Check every minute for time changes, pausing while the tab is hidden
        const applyTimeTheme = () => {
          let newIsDark = !isDaytime()
          if (settings.autoThemeMode === 'both') {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            newIsDark = systemDark || newIsDark
          }
          applyEffectiveTheme(newIsDark)
        }
        let timeInterval: ReturnType<typeof setInterval> | null = setInterval(applyTimeTheme, 60000)
        const onVisibility = () => {
          if (document.visibilityState === 'visible') {
            applyTimeTheme()
            if (!timeInterval) timeInterval = setInterval(applyTimeTheme, 60000)
          } else if (timeInterval) {
            clearInterval(timeInterval)
            timeInterval = null
          }
        }
        document.addEventListener('visibilitychange', onVisibility)
        listeners.push(() => {
          if (timeInterval) clearInterval(timeInterval)
          document.removeEventListener('visibilitychange', onVisibility)
        })
      }

      return () => listeners.forEach(cleanup => cleanup())
    } else if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        applyEffectiveTheme(e.matches)
      }
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [settings.theme, settings.autoThemeEnabled, settings.autoThemeMode, settings.backgroundBlur, settings.backgroundDimness, settings.autoContrast, settings.glassOpacity, settings.glassBlur, settings.cardOpacity, settings.cardLiquidIntensity, settings.accentColor, settings.backgroundImage, isLoaded])

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
    const commit = () => setSettings((prev) => {
      const next = { ...prev, ...updates }

      // Auto-track background image history (keep last 8, no duplicates)
      if (updates.backgroundImage && updates.backgroundImage.length > 0) {
        const history = [updates.backgroundImage, ...(prev.backgroundHistory || []).filter(img => img !== updates.backgroundImage)].slice(0, 8)
        next.backgroundHistory = history
      }

      return next
    })

    const affectsAppearance = [
      'theme', 'autoThemeEnabled', 'autoThemeMode', 'backgroundImage',
      'backgroundBlur', 'backgroundDimness', 'autoContrast', 'accentColor',
      'glassOpacity', 'glassBlur', 'cardOpacity', 'cardLiquidIntensity',
    ].some((key) => key in updates)

    if (affectsAppearance) {
      runAppearanceTransition(() => flushSync(commit))
    } else {
      commit()
    }
  }

  const resetSettings = async () => {
    runAppearanceTransition(() => flushSync(() => setSettings(defaultSettings)))
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
    <SettingsContext.Provider value={{
      settings,
      updateSettings,
      resetSettings,
      isSettingsOpen,
      setSettingsOpen
    }}>
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
      resetSettings: () => { },
      isSettingsOpen: false,
      setSettingsOpen: () => { }
    }
  }
  return context
}
