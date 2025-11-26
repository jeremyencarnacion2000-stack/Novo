"use client"

import './focus-mode.css'
import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Timer, Play, Pause, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFocus } from "@/lib/focus-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function FocusMode() {
  const {
    setIsFocusModeActive,
    time,
    setTime,
    isActive,
    setIsActive,
    initialTime,
    setInitialTime,
    mode,
    setMode,
    selectedTask,
    setSelectedTask,
    tasks,
    setTasks,
    toggleTimer,
    resetTimer,
    setTimerMode,
    formatTime
  } = useFocus()
  const [isOpen, setIsOpen] = React.useState(false)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  React.useEffect(() => {
    // Initialize audio with a pleasant notification sound
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3")
    audioRef.current.volume = 0.5
  }, [])

  React.useEffect(() => {
    if (isOpen) {
      const checklistItems = JSON.parse(localStorage.getItem("checklist-items") || "[]")
      const activeTasks = checklistItems
        .filter((item: any) => !item.completed)
        .map((item: any) => ({ id: item.id, text: item.text }))
      setTasks(activeTasks)
    }
  }, [isOpen, setTasks])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" title="Focus Mode">
          <Timer className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Focus Mode</DialogTitle>
          <DialogDescription>Select a task and stay productive with the Pomodoro technique.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-4">
          {mode === "work" && (
            <div className="w-full max-w-xs">
              <Select value={selectedTask} onValueChange={setSelectedTask}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a task to focus on..." />
                </SelectTrigger>
                <SelectContent>
                  {tasks.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No active tasks
                    </SelectItem>
                  ) : (
                    tasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.text}
                      </SelectItem>
                    ))
                  )}
                  <SelectItem value="custom">Custom Task</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant={mode === "work" ? "default" : "outline"} size="sm" onClick={() => setTimerMode("work")}>
              Work
            </Button>
            <Button
              variant={mode === "shortBreak" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimerMode("shortBreak")}
            >
              Short Break
            </Button>
            <Button
              variant={mode === "longBreak" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimerMode("longBreak")}
            >
              Long Break
            </Button>
          </div>

          <div className="text-7xl font-bold tracking-tighter font-mono tabular-nums">{formatTime(time)}</div>

          <div className="flex gap-4">
            <Button
              size="lg"
              className={cn("w-32", isActive ? "bg-amber-500 hover:bg-amber-600" : "bg-green-500 hover:bg-green-600")}
              onClick={toggleTimer}
            >
              {isActive ? (
                <>
                  <Pause className="mr-2 h-5 w-5" /> Pause
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" /> Start
                </>
              )}
            </Button>
            <Button size="lg" variant="outline" onClick={resetTimer}>
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}