import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, Clock, CalendarDays, Dumbbell, Activity, Play } from 'lucide-react'
import { Routine } from '@/types/routine'
import { cn } from '@/lib/utils'

interface RoutineCardProps {
    routine: Routine
    onEdit: (routine: Routine) => void
    onDelete: (id: string) => void
    onView: (routine: Routine) => void
    isActiveTransition?: boolean
}

export function RoutineCard({ routine, onEdit, onDelete, onView, isActiveTransition }: RoutineCardProps) {
    const [isCardHovered, setIsCardHovered] = useState(false)
    const isStructured = routine.days && routine.days.length > 0

    const handleViewClick = () => {
        onView(routine)
    }

    return (
        <Card
            className="liquid-glass-hover transition-all hover:shadow-md cursor-pointer flex flex-col h-full"
            onClick={handleViewClick}
            onMouseEnter={() => setIsCardHovered(true)}
            onMouseLeave={() => setIsCardHovered(false)}
            data-flip-from={`routine-${routine.id}`}
        >
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 space-y-1">
                        <CardTitle data-shared-item="text" className="text-lg leading-tight line-clamp-2" title={routine.name}>
                            {routine.name}
                        </CardTitle>
                        <CardDescription className="text-xs line-clamp-2 break-words">
                            {routine.description}
                        </CardDescription>
                    </div>
                    <Badge variant={routine.isActive ? 'default' : 'secondary'} className="shrink-0">
                        {routine.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="flex-1 pb-3">
                <div className="space-y-4">
                    {/* Meta Info */}
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                            <Clock className="h-3 w-3" />
                            <span>{routine.duration} min</span>
                        </div>
                        {routine.frequency && (
                            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                                <CalendarDays className="h-3 w-3" />
                                <span className="truncate max-w-[100px]">{routine.frequency}</span>
                            </div>
                        )}
                        {routine.level && (
                            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                                <Activity className="h-3 w-3" />
                                <span>{routine.level}</span>
                            </div>
                        )}
                        {routine.method && (
                            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                                <Dumbbell className="h-3 w-3" />
                                <span className="truncate max-w-[100px]">{routine.method}</span>
                            </div>
                        )}
                    </div>

                    {routine.objective && (
                        <p className="text-xs text-muted-foreground italic">
                            Goal: {routine.objective}
                        </p>
                    )}

                    {/* Structured Content Preview */}
                    {isStructured ? (
                        <div className="space-y-3">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/50 pb-1">
                                Schedule Preview
                            </div>
                            <div className="grid gap-2">
                                {routine.days!.slice(0, 3).map((day) => {
                                    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
                                    const todayWeekday = days[new Date().getDay()]
                                    const isToday = day.weekday?.toLowerCase() === todayWeekday

                                    return (
                                        <div key={day.id} className={cn(
                                            "group relative overflow-hidden rounded-lg border transition-all",
                                            isToday
                                                ? "bg-primary/10 border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.1)] scale-[1.02]"
                                                : "bg-secondary/20 border-border/50 hover:border-primary/30"
                                        )}>
                                            <div className={cn(
                                                "px-3 py-2 flex items-center justify-between",
                                                isToday ? "bg-primary/20" : "bg-secondary/30"
                                            )}>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm truncate" title={day.name}>{day.name}</span>
                                                    {isToday && (
                                                        <Badge className="h-4 px-1 text-[8px] uppercase bg-primary text-primary-foreground border-0">Today</Badge>
                                                    )}
                                                </div>
                                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-background/50 border-0">
                                                    {day.exercises.length} Exercises
                                                </Badge>
                                            </div>
                                            <div className="px-3 py-2 space-y-1">
                                                {day.exercises.slice(0, 2).map((ex, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <div className={cn("h-1 w-1 rounded-full", isToday ? "bg-primary" : "bg-primary/50")} />
                                                        <span className="truncate">{ex.name}</span>
                                                        <span className="ml-auto font-mono text-[10px] opacity-50">{ex.sets}x{ex.reps}</span>
                                                    </div>
                                                ))}
                                                {day.exercises.length > 2 && (
                                                    <div className="text-[10px] text-muted-foreground/50 pl-3">
                                                        +{day.exercises.length - 2} more...
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                                {routine.days!.length > 3 && (
                                    <div className="text-xs text-center text-muted-foreground pt-1 font-medium">
                                        +{routine.days!.length - 3} more days
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Legacy Task List */
                        <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Tasks
                            </div>
                            {routine.tasks.slice(0, 3).map((task) => (
                                <div key={task.id} className="flex items-center gap-2 text-sm">
                                    <div className={cn("h-2 w-2 rounded-full", task.completed ? "bg-primary" : "bg-muted-foreground/30")} />
                                    <span className={cn("truncate", task.completed && "line-through text-muted-foreground")}>
                                        {task.text}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
            <CardFooter className="pt-0 gap-2">
                <Button
                    className="flex-1"
                    variant="default"
                    onClick={(e) => {
                        e.stopPropagation()
                        handleViewClick()
                    }}
                >
                    <Play className="h-3 w-3 mr-2" />
                    Start
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={(e) => {
                        e.stopPropagation()
                        onEdit(routine)
                    }}
                >
                    <Edit className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={(e) => {
                        e.stopPropagation()
                        onDelete(routine.id)
                    }}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </CardFooter>
        </Card >
    )
}
