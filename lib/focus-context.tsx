'use client'

import React, { createContext, useContext, useState, useEffect, useRef } from 'react'

interface FocusContextType {
  isFocusModeActive: boolean
  setIsFocusModeActive: (active: boolean) => void
  // Timer state
  time: number
  setTime: (time: number) => void
  isActive: boolean
  setIsActive: (active: boolean) => void
  initialTime: number
  setInitialTime: (time: number) => void
  mode: "work" | "shortBreak" | "longBreak"
  setMode: (mode: "work" | "shortBreak" | "longBreak") => void
  selectedTask: string
  setSelectedTask: (task: string) => void
  tasks: { id: string; text: string }[]
  setTasks: (tasks: { id: string; text: string }[]) => void
  // Functions
  toggleTimer: () => void
  resetTimer: () => void
  setTimerMode: (mode: "work" | "shortBreak" | "longBreak") => void
  formatTime: (seconds: number) => string
}

const FocusContext = createContext<FocusContextType | undefined>(undefined)

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [isFocusModeActive, setIsFocusModeActive] = useState(false)
  const [time, setTime] = useState(25 * 60) // 25 minutes in seconds
  const [isActive, setIsActive] = useState(false)
  const [initialTime, setInitialTime] = useState(25 * 60)
  const [mode, setMode] = useState<"work" | "shortBreak" | "longBreak">("work")
  const [selectedTask, setSelectedTask] = useState<string>("")
  const [tasks, setTasks] = useState<{ id: string; text: string }[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)

  useEffect(() => {
    // Initialize audio with a pleasant notification sound
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3")
    audioRef.current.volume = 0.5
  }, [])

  useEffect(() => {
    setIsFocusModeActive(isActive)
  }, [isActive])

  // Save focus session when timer completes
  const saveFocusSession = async (duration: number) => {
    try {
      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trackEvent',
          userId: 'current-user', // This should come from session
          eventType: 'focus_session_complete',
          module: `focus-${mode}`,
        })
      })

      // Also update daily analytics with focus time
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'startSession',
          userId: 'current-user',
          module: 'focus-timer'
        })
      }).then(res => res.json()).then(async (data) => {
        // Immediately end it with the actual duration
        if (data.sessionId) {
          await fetch('/api/analytics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'endSession',
              sessionId: data.sessionId,
            })
          })
        }
      })

      console.log('Focus session saved successfully')
    } catch (error) {
      console.error('Failed to save focus session:', error)
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isActive && time > 0) {
      // Track session start time
      if (!sessionStartTime) {
        setSessionStartTime(Date.now())
      }

      interval = setInterval(() => {
        setTime((prevTime) => prevTime - 1)
      }, 1000)
    } else if (time === 0) {
      setIsActive(false)
      if (interval) clearInterval(interval)

      // Calculate actual duration and save session
      const actualDuration = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : initialTime
      saveFocusSession(actualDuration)
      setSessionStartTime(null)

      if (audioRef.current) {
        audioRef.current.play().catch((e) => console.log("Audio play failed:", e))
      }

      new Notification("Focus Timer Finished!", { body: "Time to take a break or get back to work." })
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isActive, time, sessionStartTime, initialTime, mode])

  const toggleTimer = () => setIsActive(!isActive)

  const resetTimer = () => {
    setIsActive(false)
    setTime(initialTime)
    setSessionStartTime(null) // Reset session tracking
  }

  const setTimerMode = (newMode: "work" | "shortBreak" | "longBreak") => {
    setMode(newMode)
    setIsActive(false)
    setSessionStartTime(null) // Reset session tracking
    let newTime = 25 * 60
    if (newMode === "shortBreak") newTime = 5 * 60
    if (newMode === "longBreak") newTime = 15 * 60
    setInitialTime(newTime)
    setTime(newTime)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <FocusContext.Provider value={{
      isFocusModeActive,
      setIsFocusModeActive,
      time,
      setTime,
      isActive,
      setIsActive,
      initialTime,
      setInitialTime,
      mode,
      setMode,
      selectedTask,
      setSelectedTask,
      tasks,
      setTasks,
      toggleTimer,
      resetTimer,
      setTimerMode,
      formatTime
    }}>
      {children}
    </FocusContext.Provider>
  )
}

export function useFocus() {
  const context = useContext(FocusContext)
  if (context === undefined) {
    return {
      isFocusModeActive: false,
      setIsFocusModeActive: () => { },
      time: 25 * 60,
      setTime: () => { },
      isActive: false,
      setIsActive: () => { },
      initialTime: 25 * 60,
      setInitialTime: () => { },
      mode: "work" as "work" | "shortBreak" | "longBreak",
      setMode: () => { },
      selectedTask: "",
      setSelectedTask: () => { },
      tasks: [],
      setTasks: () => { },
      toggleTimer: () => { },
      resetTimer: () => { },
      setTimerMode: () => { },
      formatTime: (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
      }
    }
  }
  return context
}