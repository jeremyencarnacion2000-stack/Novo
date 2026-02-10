import { useState, useEffect } from 'react'
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
                setRestTime((prev) => prev + 1)
            }, 1000)
        } else {
            setRestTime(0)
        }
        return () => clearInterval(interval)
    }, [isResting])

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

        // Track completion if user is logged in
        if (session?.user?.id) {
            await trackActivity('routine', true, { id: routine.id, name: routine.name, module: 'routines' })
        }

        // Here we would save the log to the database
        // For MVP, we just simulate success
        mutate(ROUTINE_STATS_KEY)
        toast({
            title: "Workout Completed!",
            description: `Great job! You finished in ${formatTime(elapsedTime)}.`,
        })
        onComplete()
    }

    // Reset timer when active day changes
    useEffect(() => {
        setElapsedTime(0)
        setIsTimerRunning(true)
        setIsResting(false)
    }, [activeDayId])

    if (!routine.days || routine.days.length === 0) return null

    const activeDay = routine.days.find(d => d.id === activeDayId) || routine.days[0]

    return (
        <div className="fixed inset-0 bg-[#09090b] z-[100] flex flex-col font-sans">
            {/* Glassmorphic Header */}
            <div className="absolute top-0 left-0 right-0 h-16 bg-[#09090b]/90 backdrop-blur-md border-b border-white/5 z-20 flex items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onCancel} className="hover:bg-white/10 rounded-full text-muted-foreground hover:text-white">
                        <X className="h-5 w-5" />
                    </Button>
                    <div className="flex flex-col">
                        <h2 className="font-bold text-base sm:text-lg tracking-tight leading-none text-white">{routine.name}</h2>
                        <p className="text-xs text-muted-foreground font-medium mt-1">{activeDay.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-6">
                    <div className="hidden sm:flex items-center gap-2 font-mono text-sm font-medium text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20 shadow-[0_0_10px_rgba(52,211,153,0.2)]">
                        <Timer className="h-4 w-4" />
                        {formatTime(elapsedTime)}
                    </div>
                    <Button onClick={handleFinish} size="sm" className="rounded-full px-6 font-medium bg-white text-black hover:bg-white/90 shadow-lg shadow-white/10 transition-all hover:scale-105 active:scale-95">
                        Finish Workout
                    </Button>
                </div>
            </div>

            {/* Main Layout */}
            <div className="flex-1 flex flex-col md:flex-row pt-16 h-full overflow-hidden">

                {/* Sidebar (Desktop) / Top Bar (Mobile) */}
                <div className="w-full md:w-72 bg-card/30 backdrop-blur-xl border-b md:border-b-0 md:border-r border-border/40 flex flex-col z-10 shrink-0">
                    <div className="p-5 border-b border-border/40 hidden md:block">
                        <h2 className="font-bold text-xl tracking-tight text-foreground/90">Schedule</h2>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Select a day to view exercises</p>
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

                {/* Exercises Area */}
                <ScrollArea className="flex-1 bg-background relative">
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
                                                                "h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-300 border-2",
                                                                isCompleted
                                                                    ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105"
                                                                    : "border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 text-transparent"
                                                            )}
                                                        >
                                                            <CheckCircle2 className={cn("h-5 w-5 transition-transform duration-300", isCompleted ? "scale-100" : "scale-50")} />
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
                </ScrollArea>
            </div>

            {/* Floating Rest Timer */}
            {
                isResting && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
                        <div className="bg-background/90 backdrop-blur-xl border border-primary/20 shadow-2xl shadow-primary/10 rounded-2xl p-4 flex items-center justify-between ring-1 ring-white/10">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="h-12 w-12 rounded-full border-2 border-primary/20 flex items-center justify-center">
                                        <Timer className="h-5 w-5 text-primary animate-pulse" />
                                    </div>
                                    <svg className="absolute inset-0 h-12 w-12 -rotate-90 pointer-events-none">
                                        <circle
                                            className="text-primary"
                                            strokeWidth="2"
                                            stroke="currentColor"
                                            fill="transparent"
                                            r="22"
                                            cx="24"
                                            cy="24"
                                            strokeDasharray="138"
                                            strokeDashoffset={138 - (Math.min(restTime, 120) / 120) * 138}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Resting</p>
                                    <p className="text-2xl font-bold font-mono tabular-nums leading-none">{formatTime(restTime)}</p>
                                </div>
                            </div>
                            <Button onClick={skipRest} variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary rounded-full px-4 h-9 font-medium transition-colors">
                                Skip
                                <SkipForward className="h-4 w-4 ml-1.5" />
                            </Button>
                        </div>
                    </div>
                )
            }
        </div >
    )
}
