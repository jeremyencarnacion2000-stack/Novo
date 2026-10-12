'use client'

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { eventBus } from '@/lib/events/event-bus'
import { createClientIdempotencyKey } from '@/lib/client-idempotency'

export type FocusMode = 'work' | 'shortBreak' | 'longBreak'

export interface TimerProfile {
  id: string
  name: string
  workDuration: number // minutes
  shortBreakDuration: number // minutes
  longBreakDuration: number // minutes
  pomodorosUntilLongBreak: number
  autoStartBreaks: boolean
  autoStartWork: boolean
}

export interface SoundSettings {
  volume: number // 0-1
  soundId: string
  enabled: boolean
}

export interface Task {
  id: string
  text: string
  completed: boolean
  // True when `id` is a real backend Task id (seeded via addTask(text, id)
  // by the peak-task orchestrator) rather than a locally-generated one from
  // typing into the Focus page's own "Add a task" box.
  isBackendTask?: boolean
}

interface FocusContextType {
  // Timer State
  time: number
  isActive: boolean
  mode: FocusMode
  pomodoroCount: number
  progress: number

  // Actions
  toggleTimer: () => void
  resetTimer: () => void
  skipTimer: () => void
  setMode: (mode: FocusMode) => void

  // Settings
  activeProfileId: string
  setActiveProfileId: (id: string) => void
  profiles: TimerProfile[]
  addProfile: (profile: TimerProfile) => void
  updateProfile: (profile: TimerProfile) => void
  deleteProfile: (id: string) => void

  soundSettings: SoundSettings
  setSoundSettings: (settings: SoundSettings) => void

  // Tasks
  selectedTaskId: string | null
  setSelectedTaskId: (id: string | null) => void
  tasks: Task[]
  addTask: (text: string, id?: string) => void
  toggleTaskCompletion: (id: string) => void
  deleteTask: (id: string) => void

  formatTime: (seconds: number) => string
}
type FocusControlsContextType = Pick<
  FocusContextType,
  | 'setMode'
  | 'toggleTimer'
  | 'resetTimer'
  | 'pomodoroCount'
  | 'isActive'
  | 'mode'
  | 'activeProfileId'
  | 'setActiveProfileId'
  | 'profiles'
  | 'addProfile'
  | 'deleteProfile'
  | 'soundSettings'
  | 'setSoundSettings'
  | 'tasks'
  | 'selectedTaskId'
  | 'toggleTaskCompletion'
  | 'setSelectedTaskId'
  | 'addTask'
>


const DEFAULT_PROFILES: TimerProfile[] = [
  {
    id: 'pomodoro',
    name: 'Pomodoro (25/5)',
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    pomodorosUntilLongBreak: 4,
    autoStartBreaks: false,
    autoStartWork: false
  },
  {
    id: 'deep-work',
    name: 'Deep Work (50/10)',
    workDuration: 50,
    shortBreakDuration: 10,
    longBreakDuration: 30,
    pomodorosUntilLongBreak: 3,
    autoStartBreaks: false,
    autoStartWork: false
  },
  {
    id: 'quick-focus',
    name: 'Quick Focus (15/3)',
    workDuration: 15,
    shortBreakDuration: 3,
    longBreakDuration: 10,
    pomodorosUntilLongBreak: 4,
    autoStartBreaks: true,
    autoStartWork: true
  }
]

const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  volume: 0.5,
  soundId: 'bell',
  enabled: true
}

const FocusContext = createContext<FocusContextType | undefined>(undefined)
const FocusControlsContext = createContext<FocusControlsContextType | undefined>(undefined)

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()

  // Focus preferences are private account state. Keep the storage namespace
  // tied to the authenticated user so signing out/in on the same browser can
  // never leak a timer profile, sound preference, or paused session across
  // accounts. During auth resolution we intentionally do not hydrate or write
  // anything; this prevents the default first render from overwriting the
  // eventual user's saved state.
  const focusStorageKey = useMemo(
    () => session?.user?.id ? `user:${session.user.id}` : null,
    [session?.user?.id]
  )
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null)

  // State
  const [profiles, setProfiles] = useState<TimerProfile[]>(DEFAULT_PROFILES)
  const [activeProfileId, setActiveProfileId] = useState<string>('pomodoro')
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(DEFAULT_SOUND_SETTINGS)

  const activeProfile = profiles.find(p => p.id === activeProfileId) || DEFAULT_PROFILES[0]

  const [mode, setModeState] = useState<FocusMode>('work')
  const [time, setTime] = useState(activeProfile.workDuration * 60)
  const [isActive, setIsActive] = useState(false)
  const [pomodoroCount, setPomodoroCount] = useState(0)
  const [initialTime, setInitialTime] = useState(activeProfile.workDuration * 60)

  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const sessionStartTimeRef = useRef<number | null>(null)
  const sessionIntentKeyRef = useRef<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize Audio
  useEffect(() => {
    // Keep the focus provider network-free on route mount. The alarm is an optional
    // affordance, so create its media element only when a session actually ends.

    if (!focusStorageKey) {
      setHydratedStorageKey(null)
      return
    }

    const stateKey = `novo-focus-state:${focusStorageKey}`
    const profilesKey = `novo-focus-profiles:${focusStorageKey}`
    const activeProfileKey = `novo-focus-active-profile:${focusStorageKey}`
    const soundKey = `novo-focus-sound:${focusStorageKey}`
    setHydratedStorageKey(null)

    // Reset in-memory state before loading the next account. This also clears
    // the previous user's paused timer while the new account is hydrating.
    setProfiles(DEFAULT_PROFILES)
    setActiveProfileId('pomodoro')
    setSoundSettings(DEFAULT_SOUND_SETTINGS)
    setModeState('work')
    setTime(DEFAULT_PROFILES[0].workDuration * 60)
    setInitialTime(DEFAULT_PROFILES[0].workDuration * 60)
    setPomodoroCount(0)
    setIsActive(false)

    // Load state from localStorage
    const savedState = localStorage.getItem(stateKey)
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        setModeState(parsed.mode || 'work')
        setTime(parsed.time)
        setPomodoroCount(parsed.pomodoroCount || 0)
        setInitialTime(parsed.initialTime || parsed.time)
        // We don't auto-start the timer for safety
        setIsActive(false)
      } catch (e) {
        console.error('Failed to parse saved focus state', e)
      }
    }

    // Load custom timer profiles + sound settings. There's no server model
    // for these yet, and FocusSettings (components/focus/focus-settings.tsx)
    // lets users "Add Profile" / delete profiles / tweak sound with nothing
    // below it — without this, every profile you create is gone on the next
    // reload even though the UI just showed it saved into the list.
    try {
      const savedProfiles = localStorage.getItem(profilesKey)
      if (savedProfiles) setProfiles(JSON.parse(savedProfiles))
      const savedActiveProfileId = localStorage.getItem(activeProfileKey)
      if (savedActiveProfileId) setActiveProfileId(savedActiveProfileId)
      const savedSound = localStorage.getItem(soundKey)
      if (savedSound) setSoundSettings(JSON.parse(savedSound))
    } catch (e) {
      console.error('Failed to parse saved focus profiles/sound settings', e)
    }
    setHydratedStorageKey(focusStorageKey)
  }, [focusStorageKey])

  // Persist profiles, active profile, and sound settings — same rationale
  // as the load effect above.
  useEffect(() => {
    if (!focusStorageKey || hydratedStorageKey !== focusStorageKey) return
    localStorage.setItem(`novo-focus-profiles:${focusStorageKey}`, JSON.stringify(profiles))
  }, [profiles, focusStorageKey, hydratedStorageKey])

  useEffect(() => {
    if (!focusStorageKey || hydratedStorageKey !== focusStorageKey) return
    localStorage.setItem(`novo-focus-active-profile:${focusStorageKey}`, activeProfileId)
  }, [activeProfileId, focusStorageKey, hydratedStorageKey])

  useEffect(() => {
    if (!focusStorageKey || hydratedStorageKey !== focusStorageKey) return
    localStorage.setItem(`novo-focus-sound:${focusStorageKey}`, JSON.stringify(soundSettings))
  }, [soundSettings, focusStorageKey, hydratedStorageKey])

  // Save state to localStorage
  useEffect(() => {
    if (!focusStorageKey || hydratedStorageKey !== focusStorageKey) return
    // While a timer is running, checkpoint every 15 seconds instead of
    // synchronously serializing the same small record on every visual tick.
    // Pauses, resets, profile/mode changes, and completed sessions still save
    // immediately so the user never loses an intentional state transition.
    if (isActive && time % 15 !== 0) return
    const stateToSave = {
      mode,
      time,
      pomodoroCount,
      initialTime,
      updatedAt: Date.now()
    }

    // Only save if it's not the default state or if it's active
    const isDefaultTime = time === (mode === 'work' ? activeProfile.workDuration * 60 :
      mode === 'shortBreak' ? activeProfile.shortBreakDuration * 60 :
        activeProfile.longBreakDuration * 60)

    if (!isDefaultTime || pomodoroCount > 0) {
      localStorage.setItem(`novo-focus-state:${focusStorageKey}`, JSON.stringify(stateToSave))
    } else {
      localStorage.removeItem(`novo-focus-state:${focusStorageKey}`)
    }
  }, [mode, time, isActive, pomodoroCount, initialTime, activeProfile, focusStorageKey, hydratedStorageKey])

  // Update volume when settings change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = soundSettings.volume
    }
  }, [soundSettings.volume])

  // Update timer when profile or mode changes (only if not running)
  useEffect(() => {
    if (!isActive) {
      let newTime = 0
      switch (mode) {
        case 'work': newTime = activeProfile.workDuration * 60; break;
        case 'shortBreak': newTime = activeProfile.shortBreakDuration * 60; break;
        case 'longBreak': newTime = activeProfile.longBreakDuration * 60; break;
      }

      // Only set time if it's a fresh start for this mode/profile
      // We check if the current time is the same as the previous mode's initial time
      // to avoid resetting a paused timer.
      if (time === 0 || time === initialTime) {
        setTime(newTime)
        setInitialTime(newTime)
      }
    }
  }, [activeProfile, mode, isActive])

  // Timer Logic
  useEffect(() => {
    if (!isActive) return
    if (sessionStartTimeRef.current === null) sessionStartTimeRef.current = Date.now()

    // Keep one interval for the full active session. The previous dependency
    // on `time` tore it down and recreated it after every one-second update.
    const interval = window.setInterval(() => {
      setTime((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isActive])

  useEffect(() => {
    if (time === 0 && isActive) handleTimerComplete()
  }, [isActive, time])

  const handleTimerComplete = () => {
    setIsActive(false)
    playAlarm()

    // Save Session
    const sessionStartTime = sessionStartTimeRef.current
    const actualDuration = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : initialTime
    saveFocusSession(actualDuration)
    sessionStartTimeRef.current = null

    // Handle Mode Switch
    if (mode === 'work') {
      const newCount = pomodoroCount + 1
      setPomodoroCount(newCount)

      const isLongBreak = newCount % activeProfile.pomodorosUntilLongBreak === 0
      const nextMode = isLongBreak ? 'longBreak' : 'shortBreak'

      setModeState(nextMode)
      if (activeProfile.autoStartBreaks) {
        sessionIntentKeyRef.current = createClientIdempotencyKey()
        sessionStartTimeRef.current = Date.now()
        setIsActive(true)
      }

      notifyFocus('Focus Session Complete!', 'Time for a break.')
    } else {
      setModeState('work')
      if (activeProfile.autoStartWork) {
        sessionIntentKeyRef.current = createClientIdempotencyKey()
        sessionStartTimeRef.current = Date.now()
        setIsActive(true)
      }

      notifyFocus('Break Over!', 'Time to get back to work.')
    }
  }

  // Notification constructors throw in some browsers when permission was
  // denied (even if the API exists). A completed focus session must never
  // surface an unhandled exception or interrupt the timer state machine.
  const notifyFocus = (title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return
    try {
      new Notification(title, { body })
    } catch {
      // Notifications are an optional affordance; the persisted session is
      // still the source of truth when the browser rejects the constructor.
    }
  }

  const playAlarm = () => {
    if (!soundSettings.enabled) return

    const audio = audioRef.current ?? (audioRef.current = new Audio(
      'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
    ))
    audio.volume = soundSettings.volume

    try {
      // HTMLMediaElement.play() is allowed to return void in some embedded
      // webviews (and can throw when autoplay is blocked). Sound is an
      // enhancement, so neither shape should interrupt session persistence.
      const playback = audio.play()
      if (playback && typeof playback.catch === 'function') playback.catch(() => {})
    } catch {
      // Ignore autoplay/device failures; the completed session remains the
      // source of truth and the visual timer continues normally.
    }
  }

  const userId = session?.user?.id
  const saveFocusSession = useCallback(async (duration: number, interrupted = false) => {
    if (!userId) return
    const durationMins = Math.round(duration / 60)
    if (durationMins < 1) return // ignore accidental sub-minute sessions
    const idempotencyKey = sessionIntentKeyRef.current ?? createClientIdempotencyKey()

    try {
      // Emit to twin evolution engine (persists FocusSession + fires twin.signal)
      fetch('/api/focus-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          event: 'finished',
          duration: durationMins,
          sessionType: mode === 'work' ? 'work' : 'break',
          taskId: selectedTaskId,
          interrupted,
        })
      }).catch(() => {})

      // Legacy analytics event (kept for backward compatibility)
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trackEvent',
          userId,
          eventType: 'focus_session_complete',
          module: `focus-${mode}`,
          metadata: { duration, profileId: activeProfileId, taskId: selectedTaskId }
        })
      }).catch(() => {})

      // Dispatch to Central Event Bus
      if (interrupted) {
        eventBus.dispatch('FocusInterrupted', {
          duration: durationMins,
          mode,
          profileId: activeProfileId,
          taskId: selectedTaskId
        })
      } else {
        eventBus.dispatch('FocusEnded', {
          duration: durationMins,
          mode,
          profileId: activeProfileId,
          taskId: selectedTaskId
        })
      }
    } catch (error) {
      console.error('Failed to save focus session:', error)
    }
  }, [userId, mode, selectedTaskId, activeProfileId])

  // Actions
  const toggleTimer = useCallback(() => {
    if (!isActive) {
      sessionStartTimeRef.current = Date.now()
      // Every start boundary is a new user intent. A previous session may
      // still be finishing its network write, so never reuse its key here.
      sessionIntentKeyRef.current = createClientIdempotencyKey()
      // Starting — emit focus_started signal
      eventBus.dispatch('FocusStarted', {
        mode,
        profileId: activeProfileId,
        taskId: selectedTaskId
      })
      fetch('/api/focus-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'started' })
      }).catch(() => {})
    } else if (isActive && sessionStartTimeRef.current !== null) {
      // Stopping: save partial time
      const actualDuration = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
      if (actualDuration > 0) saveFocusSession(actualDuration, true)
      sessionStartTimeRef.current = null
    }
    setIsActive(!isActive)
  }, [isActive, mode, activeProfileId, selectedTaskId, saveFocusSession])

  const resetTimer = useCallback(() => {
    if (isActive && sessionStartTimeRef.current !== null) {
      const actualDuration = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
      if (actualDuration > 0) saveFocusSession(actualDuration, true)
    }
    setIsActive(false)
    sessionStartTimeRef.current = null
    let newTime = 0
    switch (mode) {
      case 'work': newTime = activeProfile.workDuration * 60; break;
      case 'shortBreak': newTime = activeProfile.shortBreakDuration * 60; break;
      case 'longBreak': newTime = activeProfile.longBreakDuration * 60; break;
    }
    setTime(newTime)
    if (focusStorageKey) localStorage.removeItem(`novo-focus-state:${focusStorageKey}`)
  }, [isActive, activeProfile, mode, focusStorageKey, saveFocusSession])

  const skipTimer = () => {
    handleTimerComplete()
  }

  const setMode = useCallback((newMode: FocusMode) => {
    setModeState(newMode)
    setIsActive(false)
    sessionStartTimeRef.current = null
  }, [])

  // Task Actions
  // `id` is optional and only passed by callers that need to hand off a task
  // they already know the identity of (e.g. the cognitive orchestrator
  // seeding the Focus page's queue with a real backend task id) so it can be
  // selected deterministically right after — everyday manual entry from the
  // Focus page itself omits it and gets a random local id, same as before.
  const addTask = useCallback((text: string, id?: string) => {
    const newTask: Task = { id: id ?? Math.random().toString(36).substr(2, 9), text, completed: false, isBackendTask: !!id }
    setTasks(prev => [...prev, newTask])
    if (!selectedTaskId) setSelectedTaskId(newTask.id)
  }, [selectedTaskId])

  const toggleTaskCompletion = useCallback((id: string) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const nextCompleted = !task.completed
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: nextCompleted } : t))

    // Tasks seeded from the orchestrator carry a real backend Task id (see
    // isBackendTask above) and are shown elsewhere (e.g. /checklist) — if we
    // only flip local state, checking a task off here silently reverts the
    // next time that id is re-fetched from the server. Locally-typed tasks
    // (no backend id) have nothing to sync.
    if (task.isBackendTask) {
      fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextCompleted ? 'done' : 'todo' }),
      }).then(res => {
        if (!res.ok) setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !nextCompleted } : t))
      }).catch(() => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !nextCompleted } : t))
      })
    }
  }, [tasks])

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    if (selectedTaskId === id) setSelectedTaskId(null)
  }

  // Profile Actions
  const addProfile = useCallback((profile: TimerProfile) => {
    setProfiles(prev => [...prev, profile])
  }, [])

  const updateProfile = (profile: TimerProfile) => {
    setProfiles(prev => prev.map(p => p.id === profile.id ? profile : p))
  }

  const deleteProfile = useCallback((id: string) => {
    if (profiles.length <= 1) return // Prevent deleting last profile
    setProfiles(prev => prev.filter(p => p.id !== id))
    if (activeProfileId === id) setActiveProfileId(profiles[0].id)
  }, [profiles, activeProfileId])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const progress = initialTime > 0 ? ((initialTime - time) / initialTime) * 100 : 0
  const focusControlsValue = useMemo<FocusControlsContextType>(() => ({
    setMode,
    toggleTimer,
    resetTimer,
    pomodoroCount,
    isActive,
    mode,
    activeProfileId,
    setActiveProfileId,
    profiles,
    addProfile,
    deleteProfile,
    soundSettings,
    setSoundSettings,
    tasks,
    selectedTaskId,
    toggleTaskCompletion,
    setSelectedTaskId,
    addTask,
  }), [setMode, toggleTimer, resetTimer, pomodoroCount, isActive, mode, activeProfileId, profiles, addProfile, deleteProfile, soundSettings, tasks, selectedTaskId, toggleTaskCompletion, setSelectedTaskId, addTask])

  return (
    <FocusControlsContext.Provider value={focusControlsValue}>
    <FocusContext.Provider value={{
      time,
      isActive,
      mode,
      pomodoroCount,
      progress,
      toggleTimer,
      resetTimer,
      skipTimer,
      setMode,
      activeProfileId,
      setActiveProfileId,
      profiles,
      addProfile,
      updateProfile,
      deleteProfile,
      soundSettings,
      setSoundSettings,
      selectedTaskId,
      setSelectedTaskId,
      tasks,
      addTask,
      toggleTaskCompletion,
      deleteTask,
      formatTime
    }}>
      {children}
    </FocusContext.Provider>
    </FocusControlsContext.Provider>
  )
}
export function useFocusControls() {
  const context = useContext(FocusControlsContext)
  if (context === undefined) {
    throw new Error('useFocusControls must be used within a FocusProvider')
  }
  return context
}


export function useFocus() {
  const context = useContext(FocusContext)
  if (context === undefined) {
    throw new Error('useFocus must be used within a FocusProvider')
  }
  return context
}
