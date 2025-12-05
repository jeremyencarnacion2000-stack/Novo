'use client'

import { usePomodoro } from '@/lib/pomodoro-context'
import { Timer, Play, Pause, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

export function PomodoroWidget() {
    const { mode, timeLeft, isRunning, startTimer, pauseTimer } = usePomodoro()

    // Don't show widget if timer hasn't been started yet
    if (timeLeft === 25 * 60 && !isRunning) {
        return null
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const getModeLabel = () => {
        switch (mode) {
            case 'work': return 'Trabajo'
            case 'shortBreak': return 'Descanso'
            case 'longBreak': return 'Descanso Largo'
        }
    }

    const getModeColor = () => {
        switch (mode) {
            case 'work': return 'bg-red-500'
            case 'shortBreak': return 'bg-green-500'
            case 'longBreak': return 'bg-blue-500'
        }
    }

    return (
        <Card className="fixed top-4 right-4 z-50 p-3 shadow-lg border-2 min-w-[140px]">
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        <Badge variant="outline" className={`${getModeColor()} text-white text-[10px] px-1 py-0`}>
                            {getModeLabel()}
                        </Badge>
                    </div>
                </div>

                <div className="text-center">
                    <div className="text-2xl font-bold tabular-nums">
                        {formatTime(timeLeft)}
                    </div>
                </div>

                <div className="flex items-center justify-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={isRunning ? pauseTimer : startTimer}
                        className="h-6 w-6 p-0"
                    >
                        {isRunning ? (
                            <Pause className="h-3 w-3" />
                        ) : (
                            <Play className="h-3 w-3" />
                        )}
                    </Button>
                </div>
            </div>
        </Card>
    )
}
