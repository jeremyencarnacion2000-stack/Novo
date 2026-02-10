"use client"

import { usePathname } from "next/navigation"
import { useFocus } from "@/lib/focus-context"
import { Button } from "@/components/ui/button"
import { Pause, Play, RotateCcw } from "lucide-react"

export function FocusTimerWidget() {
  const { isActive, time, mode, toggleTimer, resetTimer, formatTime } = useFocus()
  const pathname = usePathname()

  if (pathname === "/focus") {
    return null
  }

  const isDefaultTime = time === (mode === 'work' ? 25 * 60 : mode === 'shortBreak' ? 5 * 60 : 15 * 60)
  const isModified = time > 0 && !isDefaultTime

  if (!isActive && !isModified) {
    return null
  }

  return (
    <div className="fixed right-6 top-6 z-[1000] bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-4 flex flex-col items-center justify-center w-32 h-32 animate-in fade-in zoom-in duration-300">
      <div className="text-2xl font-bold font-mono text-white mb-2 tabular-nums">
        {formatTime(time)}
      </div>
      <div className="flex gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleTimer}
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border-none"
        >
          {isActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={resetTimer}
          className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 text-white/70 border-none"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}