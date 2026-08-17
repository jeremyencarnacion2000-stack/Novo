import { useState } from 'react'
import { Routine, RoutineDay, RoutineExercise } from '@/types/routine'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Play, Clock, Activity, Dumbbell, Calendar, CheckCircle2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface RoutineDetailViewProps {
    routine: Routine
    onStartWorkout: () => void
}

export function RoutineDetailView({ routine, onStartWorkout }: RoutineDetailViewProps) {
    const [activeDayId, setActiveDayId] = useState<string>(() => {
        if (!routine.days || routine.days.length === 0) return ''

        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        const todayWeekday = days[new Date().getDay()]

        const todayDay = routine.days.find(d => d.weekday?.toLowerCase() === todayWeekday)
        return todayDay ? todayDay.id : routine.days[0].id
    })

    // This state is initialized from the routine data
    const [dayWeekdays, setDayWeekdays] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {}
        routine.days?.forEach(day => {
            if (day.weekday) initial[day.id] = day.weekday
        })
        return initial
    })

    const handleWeekdayChange = async (dayId: string, weekday: string) => {
        const newWeekdays = { ...dayWeekdays, [dayId]: weekday }
        setDayWeekdays(newWeekdays)

        // Persist to backend 
        try {
            const updatedDays = routine.days?.map(d => ({
                ...d,
                weekday: d.id === dayId ? weekday : (dayWeekdays[d.id] || d.weekday)
            }))

            await fetch(`/api/routines/${routine.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...routine,
                    days: updatedDays
                })
            })
        } catch (e) {
            console.error('[RoutineDetail] Failed to update weekday:', e)
        }
    }

    if (!routine.days || routine.days.length === 0) {
        return <div className="p-4 text-center text-muted-foreground">No structured days found in this routine.</div>
    }

    const weekdays = [
        { value: 'monday', label: 'Monday' },
        { value: 'tuesday', label: 'Tuesday' },
        { value: 'wednesday', label: 'Wednesday' },
        { value: 'thursday', label: 'Thursday' },
        { value: 'friday', label: 'Friday' },
        { value: 'saturday', label: 'Saturday' },
        { value: 'sunday', label: 'Sunday' },
    ]

    return (
        <div className="flex flex-col space-y-6">
            {/* Header Info */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
                <div className="space-y-3 md:space-y-4 w-full md:w-auto">
                    <div>
                        <h2 className="text-xl md:text-3xl font-bold break-words pr-4 md:pr-8 leading-tight">{routine.name}</h2>
                        {routine.description && (
                            <p className="text-muted-foreground whitespace-pre-line text-xs md:text-sm mt-1 md:mt-2 break-words leading-relaxed max-w-2xl opacity-80">
                                {routine.description}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {routine.duration} min
                        </Badge>
                        {routine.frequency && (
                            <Badge variant="outline">{routine.frequency}</Badge>
                        )}
                        {routine.level && (
                            <Badge variant="outline" className="flex items-center gap-1">
                                <Activity className="h-3 w-3" /> {routine.level}
                            </Badge>
                        )}
                        {routine.tempo && (
                            <Badge variant="outline" className="flex items-center gap-1">
                                <span className="font-bold text-xs">Tempo:</span> {routine.tempo}
                            </Badge>
                        )}
                        {routine.method && (
                            <Badge variant="outline" className="flex items-center gap-1">
                                <Dumbbell className="h-3 w-3" /> {routine.method}
                            </Badge>
                        )}
                    </div>
                </div>
                <Button size="lg" onClick={onStartWorkout} className="w-full sm:w-auto">
                    <Play className="h-4 w-4 mr-2" />
                    Start Workout
                </Button>
            </div>

            {/* Days Tabs */}
            <Tabs defaultValue={routine.days[0]?.id} className="w-full flex flex-col">
                <div className="w-full overflow-x-auto mb-4 custom-scrollbar border-b">
                    <TabsList className="flex w-max min-w-full justify-start bg-transparent rounded-none h-auto p-0 space-x-6 shrink-0">
                        {routine.days.map((day) => (
                            <TabsTrigger
                                key={day.id}
                                value={day.id}
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-2 text-muted-foreground data-[state=active]:text-foreground transition-none whitespace-nowrap shrink-0 flex-none"
                            >
                                {day.name}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>
                {routine.days.map((day) => {
                    // Group exercises by muscleGroup (Section)
                    const sections: { [key: string]: typeof day.exercises } = {};
                    day.exercises.forEach(ex => {
                        const group = ex.muscleGroup || 'General';
                        if (!sections[group]) sections[group] = [];
                        sections[group].push(ex);
                    });

                    return (
                        <TabsContent key={day.id} value={day.id} className="space-y-6 animate-in fade-in-50">

                            {/* Weekday Selector */}
                            <div className="flex flex-col gap-3 bg-muted/30 p-3 rounded-lg border sm:flex-row sm:items-center sm:justify-between">
                                <span className="text-sm font-medium text-muted-foreground">Assigned Day:</span>
                                <div className="flex w-full items-center gap-2 sm:w-auto">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <Select
                                        value={dayWeekdays[day.id] || ''}
                                        onValueChange={(val) => handleWeekdayChange(day.id, val)}
                                    >
                                        <SelectTrigger className="h-9 w-full text-xs sm:w-[140px]">
                                            <SelectValue placeholder="Select Day" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {weekdays.map(wd => (
                                                <SelectItem key={wd.value} value={wd.value}>{wd.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {Object.entries(sections).map(([sectionName, exercises]) => (
                                <div key={sectionName} className="space-y-3">
                                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider pl-1 border-l-2 border-primary/50">
                                        {sectionName}
                                    </h3>
                                    <div className="grid gap-2 sm:grid-cols-1">
                                        {exercises.map((exercise, index) => (
                                            <Card
                                                key={index}
                                                className="!p-3 !md:p-4 !gap-2 !py-3 !rounded-2xl border-l-4 border-l-primary/20 hover:border-l-primary transition-colors bg-card/50 overflow-hidden"
                                            >
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
                                                        <h4 className="min-w-0 font-bold text-sm md:text-base leading-tight break-words">
                                                            {exercise.name}
                                                        </h4>
                                                        <div className="flex flex-wrap gap-1.5 sm:shrink-0 sm:justify-end">
                                                            <Badge variant="secondary" className="font-bold text-[10px] md:text-xs">
                                                                {exercise.sets} Sets
                                                            </Badge>
                                                            <Badge variant="secondary" className="font-bold text-[10px] md:text-xs">
                                                                {exercise.reps} Reps
                                                            </Badge>
                                                        </div>
                                                    </div>

                                                    {exercise.tempo && (
                                                        <div className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-1.5">
                                                            <span className="font-bold text-primary italic uppercase tracking-wider">Tempo:</span>
                                                            {exercise.tempo}
                                                        </div>
                                                    )}

                                                    {exercise.notes && (
                                                        <p className="text-xs text-muted-foreground/80 italic border-l-2 pl-2 border-primary/20 break-words leading-relaxed">
                                                            {exercise.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </TabsContent>
                    );
                })
                }
            </Tabs >

            {/* Checklist & Reminders */}
            {
                routine.tasks && routine.tasks.length > 0 && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 sm:p-5 space-y-3 mb-12">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium pb-2 border-b border-amber-500/10">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Checklist & Reminders</span>
                        </div>
                        <div className="space-y-2">
                            {routine.tasks.map((task, idx) => (
                                <div key={task.id || idx} className="flex items-start gap-3 group">
                                    <div className="mt-0.5 h-4 w-4 rounded border border-amber-500/30 flex items-center justify-center shrink-0 group-hover:border-amber-500/60 transition-colors">
                                        {task.completed && <div className="h-2.5 w-2.5 bg-amber-500 rounded-sm" />}
                                    </div>
                                    <span className="text-sm text-muted-foreground leading-relaxed break-words">{task.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }
        </div >
    )
}
