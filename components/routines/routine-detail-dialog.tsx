'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Clock, Calendar, CheckCircle2, Circle } from 'lucide-react'
import { Routine } from '@/types/routine'
import { ScrollArea } from '@/components/ui/scroll-area'

interface RoutineDetailDialogProps {
  open: boolean
  onClose: () => void
  routine: Routine | null
  onUpdateProgress?: (routineId: string, taskId: string, completed: boolean) => void
}

export function RoutineDetailDialog({ open, onClose, routine, onUpdateProgress }: RoutineDetailDialogProps) {
  if (!routine) return null

  const completedTasks = (routine.tasks || []).filter((t) => t && typeof t === 'object' && t.completed).length
  const totalTasks = (routine.tasks || []).length
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const handleTaskToggle = (taskId: string, completed: boolean) => {
    if (onUpdateProgress) {
      onUpdateProgress(routine.id, taskId, completed)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <div className="flex flex-col h-full">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-2xl mb-2 text-balance">{routine.name}</DialogTitle>
                <p className="text-sm text-muted-foreground">{routine.description}</p>
              </div>
              <Badge variant={routine.isActive ? 'default' : 'secondary'}>
                {routine.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{routine.duration} minutes</span>
              </div>
              <Badge variant="outline" className="capitalize">
                {routine.timeOfDay}
              </Badge>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span>
                  {completedTasks} of {totalTasks} completed ({progressPercentage}%)
                </span>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg mb-4">Tasks</h3>
              {routine.tasks.map((task, index) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    id={task.id}
                    checked={task.completed}
                    onCheckedChange={(checked) => handleTaskToggle(task.id, checked as boolean)}
                    className="mt-1"
                  />
                  <label
                    htmlFor={task.id}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className={task.completed ? 'line-through text-muted-foreground' : ''}>
                        {task.text}
                      </span>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="px-6 py-4 border-t bg-muted/20">
            <div className="flex gap-2">
              <Button onClick={onClose} className="flex-1">
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
