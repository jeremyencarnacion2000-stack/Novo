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

  useEffect(() => {
    // Initialize audio with a pleasant notification sound
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3")
    audioRef.current.volume = 0.5
  }, [])

  useEffect(() => {
    setIsFocusModeActive(isActive)
  }, [isActive])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isActive && time > 0) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime - 1)
      }, 1000)
    } else if (time === 0) {
      setIsActive(false)
      if (interval) clearInterval(interval)

      if (audioRef.current) {
        audioRef.current.play().catch((e) => console.log("Audio play failed:", e))
      }

      new Notification("Focus Timer Finished!", { body: "Time to take a break or get back to work." })
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isActive, time])

  const toggleTimer = () => setIsActive(!isActive)

  const resetTimer = () => {
    setIsActive(false)
    setTime(initialTime)
  }

  const setTimerMode = (newMode: "work" | "shortBreak" | "longBreak") => {
    setMode(newMode)
    setIsActive(false)
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
    throw new Error('useFocus must be used within a FocusProvider')
  }
  return context
}