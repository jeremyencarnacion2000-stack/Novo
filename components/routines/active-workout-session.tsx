import { useState, useEffect } from 'react'
import { eventBus } from '@/lib/events/event-bus'
import { motion } from 'framer-motion'
import { Routine, RoutineDay, RoutineExercise } from '@/types/routine'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Timer, CheckCircle2, ChevronLeft, Save, X, SkipForward, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useSession } from 'next-auth/react'
import { trackActivity } from '@/lib/activity-tracker'
import { mutate } from 'swr'
import { ROUTINE_STATS_KEY } from '@/hooks/use-swr'

interface ActiveWorkoutSessionProps {
    routine: Routine
    onComplete: () => void
    onCancel: () => void
}

export function ActiveWorkoutSession({ routine, onComplete, onCancel }: ActiveWorkoutSessionProps) {
    const { toast } = useToast()
    const [activeDayId, setActiveDayId] = useState<string>(
        routine.days && routine.days.length > 0 ? routine.days[0].id : ''
    )
    const [elapsedTime, setElapsedTime] = useState(0)
    const [isTimerRunning, setIsTimerRunning] = useState(true)

    // Rest Timer State
    const [isResting, setIsResting] = useState(false)
    const [restTime, setRestTime] = useState(0)

    // Tracking state: { [exerciseId]: { [setIndex]: { completed: boolean, weight: string, reps: string, notes: string } } }
    const [logs, setLogs] = useState<Record<string, Record<number, { completed: boolean, weight: string, reps: string, notes: string }>>>({})

    // Workout Timer
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (isTimerRunning) {
            interval = setInterval(() => {
                setElapsedTime((prev) => prev + 1)
            }, 1000)
        }
        return () => clearInterval(interval)
    }, [isTimerRunning])

    // Rest Timer
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (isResting) {
            interval = setInterval(() => {
                setRestTime((prev) => {
                    const next = prev + 1

                    // Notification Logic: Trigger 5 seconds before a target rest time
                    // For now, let's assume a default rest target of 60s or 90s, or just notify every minute?
                    // The user specifically asked for "when 5 seconds are left to prepare".
                    // Since we don't have a fixed countdown for all exercises yet, we'll notify at 55s, 85s, 115s etc.
                    // Or if we hit a specific "Get Ready" threshold.

                    // USER REQUEST specific: "beep when 5 seconds left"
                    // If we assume a standard 60s rest for now as a default for the beep test
                    if (next === 55 || next === 85 || next === 115) {
                        playBeep()
                        triggerVibration()
                    }

                    return next
                })
            }, 1000)
        } else {
            setRestTime(0)
        }
        return () => clearInterval(interval)
    }, [isResting])

    // Audio & Vibration Helpers
    const playBeep = () => {
        try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)()
            const oscillator = context.createOscillator()
            const gainNode = context.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(context.destination)

            oscillator.type = 'sine'
            oscillator.frequency.setValueAtTime(880, context.currentTime) // A5 note
            gainNode.gain.setValueAtTime(0, context.currentTime)
            gainNode.gain.linearRampToValueAtTime(0.3, context.currentTime + 0.05)
            gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 0.3)

            oscillator.start(context.currentTime)
            oscillator.stop(context.currentTime + 0.3)
        } catch (e) {
            console.warn('AudioContext not supported or blocked:', e)
        }
    }

    const triggerVibration = () => {
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]) // Short double pulse
        }
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const handleLogChange = (exerciseId: string, setIndex: number, field: 'completed' | 'weight' | 'reps' | 'notes', value: any) => {
        setLogs(prev => {
            const exerciseLogs = prev[exerciseId] || {}
            const setLog = exerciseLogs[setIndex] || { completed: false, weight: '', reps: '', notes: '' }

            // If marking as completed and not already completed, start rest timer
            if (field === 'completed' && value === true && !setLog.completed) {
                setIsResting(true)
            }

            return {
                ...prev,
                [exerciseId]: {
                    ...exerciseLogs,
                    [setIndex]: { ...setLog, [field]: value }
                }
            }
        })
    }

    const skipRest = () => {
        setIsResting(false)
    }

    const { data: session } = useSession()

    const handleFinish = async () => {
        setIsTimerRunning(false)
        setIsResting(false)

        // Calculate stats for completion
        let tasksTotal = 0
        let tasksCompleted = 0

        activeDay.exercises.forEach(ex => {
            tasksTotal += ex.sets
            const exerciseLog = logs[ex.id] || {}
            Object.values(exerciseLog).forEach(set => {
                if (set.completed) tasksCompleted++
            })
        })

        // Dispatch to Central Event Bus
        eventBus.dispatch('HabitCompleted', {
            habitId: routine.id,
            habitName: routine.name,
            type: 'routine',
            completionRate: tasksTotal > 0 ? (tasksCompleted / tasksTotal) : 1
        })

        // Track completion if user is logged in
        if (session?.user?.id) {
            try {
                // 1. Activity tracker (legacy/feed)
                await trackActivity('routine', true, { id: routine.id, name: routine.name, module: 'routines' })

                // 2. Specialized routine completions API (for stats)
                await fetch('/api/routines/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        routineId: routine.id,
                        tasksTotal,
                        tasksCompleted
                    })
                })
            } catch (e) {
                console.error('[Workout] Failed to track completion:', e)
            }
        }

        // Refresh stats and show success
        mutate(ROUTINE_STATS_KEY)
        mutate('/api/analytics')
        mutate('/api/routines')
        toast({
            title: "Workout Completed!",
            description: `Great job! You finished in ${formatTime(elapsedTime)}.`,
        })
        onComplete()
    }

    // Smart Day Detection: Select the day that matches today's weekday
    useEffect(() => {
        if (!routine.days) return

        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        const todayWeekday = days[new Date().getDay()]

        const todayDay = routine.days.find(d => d.weekday?.toLowerCase() === todayWeekday)
        if (todayDay) {
            setActiveDayId(todayDay.id)
        }
    }, [routine.days])

    // Reset timer when active day changes
    useEffect(() => {
        setElapsedTime(0)
        setIsTimerRunning(true)
        setIsResting(false)
    }, [activeDayId])

    if (!routine.days || routine.days.length === 0) return null

    const activeDay = routine.days.find(d => d.id === activeDayId) || routine.days[0]

    return (
        <motion.div
            className="fixed inset-0 h-[100dvh] bg-black z-[9999] flex flex-col font-sans overflow-hidden"
            data-lenis-prevent
            initial={{ opacity: 0, y: '100%', scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: '60%', scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 38, mass: 0.9 }}
        >
            {/* Header Layer */}
            <div className="absolute top-0 left-0 right-0 h-16 bg-black/60 border-b border-white/10 z-[100] flex items-center justify-between px-4 sm:px-6 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onCancel} className="hover:bg-white/10 rounded-full text-muted-foreground hover:text-white">
                        <X className="h-5 w-5" />
                    </Button>
                    <div className="flex flex-col">
                        <h2 className="font-bold text-base sm:text-lg tracking-tight leading-none text-white">{routine.name}</h2>
                        <p className="text-xs text-white/50 font-medium mt-1 uppercase tracking-tight">{activeDay.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-6">
                    <div className="hidden sm:flex items-center gap-2 font-mono text-sm font-medium text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20 shadow-[0_0_15px_rgba(52,211,153,0.1)]">
                        <Timer className="h-4 w-4" />
                        {formatTime(elapsedTime)}
                    </div>
                    <Button onClick={handleFinish} size="sm" className="rounded-full px-6 font-medium bg-white text-black hover:bg-white/90 shadow-lg shadow-white/5 transition-all hover:scale-105 active:scale-95">
                        Finish Workout
                    </Button>
                </div>
            </div>

            {/* Main Layout Area */}
            <div className="flex-1 flex flex-col md:flex-row pt-16 h-full overflow-hidden min-h-0 relative z-0">

                {/* Sidebar with isolated glass layer */}
                <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-white/5 flex flex-col shrink-0 relative bg-white/[0.02] backdrop-blur-xl z-0">
                    
                    {/* Sharp Sidebar Content */}
                    <div className="flex flex-col h-full overflow-hidden w-full relative z-10">
                        <div className="p-5 border-b border-white/5 hidden md:block">
                            <h2 className="font-bold text-lg tracking-tight text-white/90">Schedule</h2>
                            <p className="text-[10px] text-white/40 mt-1 font-bold uppercase tracking-wider">Plan del día</p>
                        </div>

                    <div className="flex md:flex-col overflow-x-auto md:overflow-y-auto p-3 gap-3 scrollbar-hide h-full">
                        {routine.days.map((day) => (
                            <button
                                key={day.id}
                                onClick={() => setActiveDayId(day.id)}
                                className={cn(
                                    "flex flex-col items-start p-4 rounded-2xl text-left transition-all duration-300 min-w-[160px] md:min-w-0 md:w-full group relative overflow-hidden border",
                                    activeDayId === day.id
                                        ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25 scale-[1.02]"
                                        : "bg-muted/30 border-transparent hover:bg-muted/60 hover:border-border/50 text-muted-foreground hover:text-foreground hover:scale-[1.01]"
                                )}
                            >
                                <div className="flex justify-between items-start w-full z-10">
                                    <span className={cn("font-bold text-sm line-clamp-2 leading-tight", activeDayId === day.id ? "text-primary-foreground" : "text-foreground")}>
                                        {day.name}
                                    </span>
                                    {activeDayId === day.id && (
                                        <div className="h-2 w-2 bg-white rounded-full animate-pulse shrink-0 ml-2 mt-1" />
                                    )}
                                </div>
                                <span className={cn("text-[10px] font-medium mt-3 uppercase tracking-wider z-10", activeDayId === day.id ? "text-primary-foreground/80" : "text-muted-foreground/70")}>
                                    {day.exercises.length} exercises
                                </span>

                                {/* Decorative background element for active state */}
                                {activeDayId === day.id && (
                                    <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
                                )}
                            </button>
                        ))}

                        {/* Smart Checklist Section */}
                        {routine.tasks && routine.tasks.length > 0 && (
                            <div className="mt-auto pt-6 pb-2 px-1 hidden md:block animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                                    <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-2">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Smart Checklist
                                    </h3>
                                    <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-amber-500/20 scrollbar-track-transparent">
                                        {routine.tasks.map((task, idx) => (
                                            <div key={idx} className="flex gap-3 text-xs text-muted-foreground leading-relaxed group items-start">
                                                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500/50 group-hover:bg-amber-500 transition-colors shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.3)]" />
                                                <span className="group-hover:text-foreground transition-colors">{task.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

                {/* Exercises Area */}
                <div className="flex-1 bg-background relative overflow-y-auto">
                    <div className="max-w-4xl mx-auto p-4 sm:p-8 pb-40 space-y-8">
                        {activeDay.exercises.map((exercise, exIdx) => (
                            <div key={exercise.id} className="group animate-in fade-in-50 slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${exIdx * 50}ms` }}>
                                {/* Exercise Header */}
                                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4 px-1">
                                    <div className="space-y-1">
                                        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground/90">
                                            {exercise.name}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                            <Badge variant="secondary" className="rounded-md px-2 py-0.5 font-mono text-xs bg-secondary/50 text-secondary-foreground/80 border-0">
                                                {exercise.muscleGroup}
                                            </Badge>
                                            {exercise.tempo && (
                                                <span className="flex items-center gap-1.5 text-xs font-mono bg-muted/30 px-2 py-0.5 rounded-md">
                                                    <Timer className="h-3 w-3" /> {exercise.tempo}
                                                </span>
                                            )}
                                        </div>
                                        {exercise.notes && (
                                            <p className="text-sm text-muted-foreground/80 italic mt-1 max-w-2xl leading-relaxed">
                                                {exercise.notes}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Sets Table */}
                                <div className="bg-card/30 rounded-2xl border border-border/40 overflow-hidden shadow-sm">
                                    {/* Table Header */}
                                    <div className="grid grid-cols-12 gap-2 p-3 bg-muted/20 border-b border-border/40 text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center select-none">
                                        <div className="col-span-2 sm:col-span-1">Set</div>
                                        <div className="col-span-2 sm:col-span-2 hidden sm:block">Previous</div>
                                        <div className="col-span-4 sm:col-span-3">kg</div>
                                        <div className="col-span-4 sm:col-span-3">Reps</div>
                                        <div className="col-span-2 sm:col-span-2 hidden sm:block">RIR</div>
                                        <div className="col-span-2 sm:col-span-1">Done</div>
                                    </div>

                                    <div className="divide-y divide-border/30">
                                        {Array.from({ length: exercise.sets }).map((_, idx) => {
                                            const setNum = idx + 1
                                            const log = logs[exercise.id]?.[idx] || { completed: false, weight: '', reps: '', notes: '' }
                                            const isCompleted = log.completed

                                            return (
                                                <div
                                                    key={idx}
                                                    className={cn(
                                                        "grid grid-cols-12 gap-2 p-3 sm:p-4 items-center transition-all duration-300",
                                                        isCompleted ? "bg-primary/5" : "hover:bg-muted/20"
                                                    )}
                                                >
                                                    {/* Set Number */}
                                                    <div className="col-span-2 sm:col-span-1 flex justify-center">
                                                        <div className={cn(
                                                            "h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-300",
                                                            isCompleted
                                                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-110"
                                                                : "bg-muted/50 text-muted-foreground"
                                                        )}>
                                                            {setNum}
                                                        </div>
                                                    </div>

                                                    {/* Previous Stats (Placeholder) */}
                                                    <div className="col-span-2 sm:col-span-2 hidden sm:block text-center text-xs text-muted-foreground/40 font-mono">
                                                        —
                                                    </div>

                                                    {/* Weight Input */}
                                                    <div className="col-span-4 sm:col-span-3">
                                                        <div className="relative">
                                                            <Input
                                                                type="number"
                                                                placeholder="-"
                                                                className={cn(
                                                                    "h-10 text-center font-mono text-base border-0 bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:bg-background transition-all rounded-xl",
                                                                    isCompleted && "text-primary font-semibold bg-transparent"
                                                                )}
                                                                value={log.weight}
                                                                onChange={(e) => handleLogChange(exercise.id, idx, 'weight', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Reps Input */}
                                                    <div className="col-span-4 sm:col-span-3">
                                                        <div className="relative">
                                                            <Input
                                                                type="text"
                                                                placeholder={exercise.reps}
                                                                className={cn(
                                                                    "h-10 text-center font-mono text-base border-0 bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:bg-background transition-all rounded-xl",
                                                                    isCompleted && "text-primary font-semibold bg-transparent"
                                                                )}
                                                                value={log.reps}
                                                                onChange={(e) => handleLogChange(exercise.id, idx, 'reps', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* RIR Input (Hidden on mobile for space) */}
                                                    <div className="col-span-2 sm:col-span-2 hidden sm:block">
                                                        <Input
                                                            type="text"
                                                            placeholder="-"
                                                            className="h-10 text-center font-mono text-sm border-0 bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:bg-background transition-all rounded-xl"
                                                            value={log.notes || ''}
                                                            onChange={(e) => handleLogChange(exercise.id, idx, 'notes', e.target.value)}
                                                        />
                                                    </div>

                                                    {/* Checkbox */}
                                                    <div className="col-span-2 sm:col-span-1 flex justify-center">
                                                        <button
                                                            onClick={() => handleLogChange(exercise.id, idx, 'completed', !log.completed)}
                                                            className={cn(
                                                                "h-9 w-9 sm:h-8 sm:w-8 rounded-xl flex items-center justify-center transition-all duration-300 border-2",
                                                                isCompleted
                                                                    ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105"
                                                                    : "border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 text-transparent"
                                                            )}
                                                        >
                                                            <CheckCircle2 className={cn("h-5 w-5 sm:h-4 sm:w-4 transition-transform duration-300", isCompleted ? "scale-100" : "scale-50")} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Floating Rest Timer */}
            {
                isResting && (
                    <div className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 w-[95%] sm:w-[90%] max-w-sm z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
                        <div
                            className="bg-background/90 border border-primary/20 shadow-2xl shadow-primary/10 rounded-2xl p-3 sm:p-4 flex items-center justify-between ring-1 ring-white/10 overflow-hidden"
                            style={{ backdropFilter: 'blur(var(--glass-blur-px))', WebkitBackdropFilter: 'blur(var(--glass-blur-px))' }}
                        >
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="relative shrink-0">
                                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full border-2 border-primary/20 flex items-center justify-center">
                                        <Timer className="h-4 w-4 sm:h-5 sm:w-5 text-primary animate-pulse" />
                                    </div>
                                    <svg className="absolute inset-0 h-10 w-10 sm:h-12 sm:w-12 -rotate-90 pointer-events-none">
                                        <circle
                                            className={cn(
                                                "transition-colors duration-500",
                                                (restTime >= 55 && restTime < 60) || (restTime >= 85 && restTime < 90)
                                                    ? "text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                                                    : "text-primary"
                                            )}
                                            strokeWidth="2"
                                            stroke="currentColor"
                                            fill="transparent"
                                            r="18"
                                            cx="20"
                                            cy="20"
                                            strokeDasharray="113"
                                            strokeDashoffset={113 - (Math.min(restTime, 120) / 120) * 113}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <p className={cn(
                                        "text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-colors truncate",
                                        (restTime >= 55 && restTime < 60) || (restTime >= 85 && restTime < 90) ? "text-amber-500" : "text-primary"
                                    )}>
                                        {(restTime >= 55 && restTime < 60) || (restTime >= 85 && restTime < 90) ? "Get Ready!" : "Resting"}
                                    </p>
                                    <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums leading-none">{formatTime(restTime)}</p>
                                </div>
                            </div>
                            <Button onClick={skipRest} variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary rounded-full px-3 sm:px-4 h-8 sm:h-9 font-medium transition-colors ml-2">
                                Skip
                                <SkipForward className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1.5" />
                            </Button>
                        </div>
                </div>
            )
        }
        </motion.div>
    )
}
