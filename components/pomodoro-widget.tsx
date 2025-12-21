'use client'

import { useFocus } from '@/lib/focus-context'
import { Timer, Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function PomodoroWidget() {
    const { mode, time, isActive, toggleTimer, formatTime } = useFocus()
    const pathname = usePathname()
    const isFocusPage = pathname === '/focus'

    if (!isActive) {
        return null
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
        <Card className={cn(
            "fixed z-50 transition-all duration-700 ease-in-out shadow-2xl border-white/10 backdrop-blur-xl",
            isFocusPage
                ? "bottom-8 left-1/2 -translate-x-1/2 w-[500px] h-16 rounded-full flex items-center px-6 justify-between bg-black/60"
                : "top-6 right-6 w-[160px] p-3 rounded-2xl bg-black/40 border-white/5"
        )}>
            {/* Left Section: Badge */}
            <div className="flex items-center gap-2">
                {!isFocusPage && <Timer className="h-3 w-3 text-muted-foreground" />}
                <Badge variant="outline" className={cn(
                    "border-0 text-white font-medium",
                    getModeColor(),
                    isFocusPage ? "px-3 py-1 text-xs" : "text-[10px] px-1.5 py-0.5"
                )}>
                    {getModeLabel()}
                </Badge>
            </div>

            {/* Center Section: Time */}
            <div className={cn(
                "font-mono font-bold tabular-nums text-white",
                isFocusPage ? "text-2xl absolute left-1/2 -translate-x-1/2" : "text-xl text-center my-1"
            )}>
                {formatTime(time)}
            </div>

            {/* Right Section: Controls */}
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleTimer}
                    className={cn(
                        "rounded-full hover:bg-white/10 text-white",
                        isFocusPage ? "h-10 w-10 p-0" : "h-7 w-7 p-0 mx-auto"
                    )}
                >
                    {isActive ? (
                        <Pause className={cn(isFocusPage ? "h-5 w-5" : "h-3.5 w-3.5")} />
                    ) : (
                        <Play className={cn(isFocusPage ? "h-5 w-5 ml-1" : "h-3.5 w-3.5 ml-0.5")} />
                    )}
                </Button>
            </div>
        </Card>
    )
}
