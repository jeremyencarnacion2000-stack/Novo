"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Pause, RotateCcw } from "lucide-react"
import { useFocus } from "@/lib/focus-context"

export function FocusTimerWidget() {
  const { isFocusModeActive, time, toggleTimer, resetTimer, formatTime } = useFocus()

  if (!isFocusModeActive) {
    return null
  }

  return (
    <div className="fixed right-5 top-5 z-[1000] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-4 flex flex-col items-center transform scale-80">
      <div className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">{formatTime(time)}</div>
      <div className="flex gap-2 mt-2">
        <Button size="sm" variant="outline" onClick={toggleTimer} className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
          <Pause className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={resetTimer} className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}