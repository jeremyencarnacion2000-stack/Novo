'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react'

type PomodoroMode = 'work' | 'shortBreak' | 'longBreak'

interface PomodoroContextType {
    mode: PomodoroMode
    timeLeft: number
    isRunning: boolean
    completedPomodoros: number
    startTimer: () => void
    pauseTimer: () => void
    resetTimer: () => void
    setMode: (mode: PomodoroMode) => void
}

const POMODORO_TIMES = {
    work: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60,
}

const PomodoroContext = createContext<PomodoroContextType | undefined>(undefined)

export function PomodoroProvider({ children }: { children: ReactNode }) {
    const [mode, setModeState] = useState<PomodoroMode>('work')
    const [timeLeft, setTimeLeft] = useState(POMODORO_TIMES.work)
    const [isRunning, setIsRunning] = useState(false)
    const [completedPomodoros, setCompletedPomodoros] = useState(0)

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null

        if (isRunning && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1)
            }, 1000)
        } else if (timeLeft === 0 && isRunning) {
            playAlarm()
            handleModeSwitch()
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [isRunning, timeLeft])

    const playAlarm = () => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)

            oscillator.frequency.value = 800
            oscillator.type = 'sine'
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)

            oscillator.start(audioContext.currentTime)
            oscillator.stop(audioContext.currentTime + 0.3)
        } catch (error) {
            console.error('Error playing alarm:', error)
        }
    }

    const handleModeSwitch = () => {
        setIsRunning(false)

        if (mode === 'work') {
            setCompletedPomodoros((prev) => prev + 1)
            const nextMode = completedPomodoros > 0 && (completedPomodoros + 1) % 4 === 0 ? 'longBreak' : 'shortBreak'
            setModeState(nextMode)
            setTimeLeft(POMODORO_TIMES[nextMode])
        } else {
            setModeState('work')
            setTimeLeft(POMODORO_TIMES.work)
        }
    }

    const startTimer = () => setIsRunning(true)
    const pauseTimer = () => setIsRunning(false)
    const resetTimer = () => {
        setIsRunning(false)
        setTimeLeft(POMODORO_TIMES[mode])
    }
    const setMode = (newMode: PomodoroMode) => {
        setModeState(newMode)
        setTimeLeft(POMODORO_TIMES[newMode])
        setIsRunning(false)
    }

    return (
        <PomodoroContext.Provider
            value={{
                mode,
                timeLeft,
                isRunning,
                completedPomodoros,
                startTimer,
                pauseTimer,
                resetTimer,
                setMode,
            }}
        >
            {children}
        </PomodoroContext.Provider>
    )
}

export function usePomodoro() {
    const context = useContext(PomodoroContext)
    if (context === undefined) {
        throw new Error('usePomodoro must be used within a PomodoroProvider')
    }
    return context
}
