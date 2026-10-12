'use client'

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Routine } from '@/types/routine'
import { RoutineDetailView } from './routine-detail-view'
import { ActiveWorkoutSession } from './active-workout-session'
import { useState } from 'react'

interface RoutineDetailDialogProps {
  open: boolean
  onClose: () => void
  routine: Routine | null
  onUpdateProgress: (routineId: string, taskId: string, completed: boolean) => void
}

export function RoutineDetailDialog({ open, onClose, routine, onUpdateProgress }: RoutineDetailDialogProps) {
  const [isWorkoutActive, setIsWorkoutActive] = useState(false)

  const handleClose = onClose

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

  return (
    <>
      {isWorkoutActive && (
        <ActiveWorkoutSession
          routine={routine}
          onComplete={handleCompleteWorkout}
          onCancel={handleCancelWorkout}
        />
      )}
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent
          motionId={`routine-${routine.id}`}
          data-testid="routine-detail-dialog"
          className="max-w-7xl w-[calc(100vw-1.5rem)] h-[min(88dvh,900px)] p-0 shadow-none [&>button]:text-foreground [&>button]:z-20 z-[5001] rounded-[24px] md:w-[95vw] md:h-[90dvh] md:rounded-[32px] overflow-hidden !bg-popover/95 dark:!bg-black/90 backdrop-blur-2xl border border-border/40 dark:border-white/10 liquid-glass-premium"
        >
          {/* Content Viewport — overflow-y-auto directly on this div */}
          <DialogTitle className="sr-only">{routine.name}</DialogTitle>
          <DialogDescription className="sr-only">Detalle y ejercicios de la rutina.</DialogDescription>
          <div data-testid="routine-detail-scroll" className="relative z-10 h-full w-full overflow-y-auto custom-scrollbar">
            <div className="p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:p-8 lg:p-10">
              <RoutineDetailView
                routine={routine}
                onStartWorkout={handleStartWorkout}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
