'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Routine } from '@/types/routine'
import { RoutineDetailView } from './routine-detail-view'
import { ActiveWorkoutSession } from './active-workout-session'
import { useState } from 'react'
import { createPortal } from 'react-dom'

interface RoutineDetailDialogProps {
  open: boolean
  onClose: () => void
  routine: Routine | null
  onUpdateProgress: (routineId: string, taskId: string, completed: boolean) => void
}

export function RoutineDetailDialog({ open, onClose, routine, onUpdateProgress }: RoutineDetailDialogProps) {
  const [isWorkoutActive, setIsWorkoutActive] = useState(false)

  if (!routine) return null

  const handleStartWorkout = () => {
    setIsWorkoutActive(true)
  }

  const handleCompleteWorkout = () => {
    setIsWorkoutActive(false)
    onClose()
  }

  const handleCancelWorkout = () => {
    setIsWorkoutActive(false)
  }

  if (isWorkoutActive) {
    if (typeof document === 'undefined') return null

    return createPortal(
      <ActiveWorkoutSession
        routine={routine}
        onComplete={handleCompleteWorkout}
        onCancel={handleCancelWorkout}
      />,
      document.body
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl w-full max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="sr-only">
          <DialogTitle>{routine.name}</DialogTitle>
          <DialogDescription>Detailed view of {routine.name}</DialogDescription>
        </DialogHeader>
        <RoutineDetailView
          routine={routine}
          onStartWorkout={handleStartWorkout}
        />
      </DialogContent>
    </Dialog>
  )
}
