'use client'

import { useFocus } from '@/lib/focus-context'
import { Timer, Play, Pause, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export function PomodoroWidget() {
    const { mode, time, isActive, toggleTimer, resetTimer, formatTime } = useFocus()
    const pathname = usePathname()
    const isFocusPage = pathname === '/focus'

    const isDefaultTime = time === (mode === 'work' ? 25 * 60 : mode === 'shortBreak' ? 5 * 60 : 15 * 60)
    const isModified = time > 0 && !isDefaultTime

    if (!isActive && !isModified) {
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
        <AnimatePresence mode="wait">
            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={cn(
                    // z-[55]: above other floating z-50 surfaces — an active
                    // countdown stays visible instead of getting covered.
                    "fixed z-[55] shadow-2xl border-white/10",
                    isFocusPage
                        ? "bottom-20 left-1/2 -translate-x-1/2 w-[calc(100vw-1.5rem)] max-w-[400px] h-16 rounded-full flex items-center px-6 justify-between bg-black/40 border border-white/20"
                        // right-16 keeps clearance from ContextHub capsule (46px) on the right edge
                        : "top-6 right-16 w-[160px] p-4 rounded-3xl bg-black/40 border-white/10 flex flex-col items-center gap-3"
                )}
            >
                <GlassSurface
                    radius={isFocusPage ? 9999 : 24}
                    depth={4}
                    blur={1}
                    strength={35}
                    chromaticAberration={5}
                    backgroundColor="transparent"
                    elevation="low"
                    aria-hidden
                    className="pointer-events-none"
                    style={{ position: 'absolute', inset: '-3px', zIndex: 0, borderRadius: 'inherit' }}
                />
                {/* Left Section: Badge */}
                <motion.div layout className="flex items-center gap-2">
                    {!isFocusPage && <Timer className="h-3 w-3 text-muted-foreground" />}
                    <Badge variant="outline" className={cn(
                        "border-0 text-white font-medium transition-colors duration-500",
                        getModeColor(),
                        isFocusPage ? "px-3 py-1 text-xs" : "text-[10px] px-2 py-0.5"
                    )}>
                        {getModeLabel()}
                    </Badge>
                </motion.div>

                {/* Center Section: Time */}
                <motion.div
                    layout
                    className={cn(
                        "font-mono font-bold tabular-nums text-white",
                        isFocusPage ? "text-2xl" : "text-3xl"
                    )}
                >
                    {formatTime(time)}
                </motion.div>

                {/* Right Section: Controls */}
                <motion.div layout className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleTimer}
                        aria-label={isActive ? "Pause timer" : "Play timer"}
                        className={cn(
                            "rounded-full hover:bg-white/10 text-white transition-all",
                            isFocusPage ? "h-10 w-10 p-0" : "h-8 w-8 p-0"
                        )}
                    >
                        {isActive ? (
                            <Pause className={cn(isFocusPage ? "h-5 w-5" : "h-4 w-4")} />
                        ) : (
                            <Play className={cn(isFocusPage ? "h-5 w-5 ml-1" : "h-4 w-4 ml-0.5")} />
                        )}
                    </Button>
                    {!isFocusPage && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetTimer}
                            aria-label="Reset timer"
                            className="h-10 w-10 p-0 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
