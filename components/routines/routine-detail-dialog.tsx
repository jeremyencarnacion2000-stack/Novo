'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Routine } from '@/types/routine'
import { RoutineDetailView } from './routine-detail-view'
import { ActiveWorkoutSession } from './active-workout-session'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AnimatePresence } from 'framer-motion'
import { safeViewTransition } from '@/hooks/use-view-transition'

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
    safeViewTransition(() => setIsWorkoutActive(true))
  }

  const handleCompleteWorkout = () => {
    safeViewTransition(() => {
      setIsWorkoutActive(false)
      onClose()
    })
  }

  const handleCancelWorkout = () => {
    safeViewTransition(() => setIsWorkoutActive(false))
  }

  const workoutPortal = typeof document !== 'undefined' ? createPortal(
    <AnimatePresence>
      {isWorkoutActive && (
        <ActiveWorkoutSession
          key="workout-session"
          routine={routine}
          onComplete={handleCompleteWorkout}
          onCancel={handleCancelWorkout}
        />
      )}
    </AnimatePresence>,
    document.body
  ) : null

  return (
    <>
      {workoutPortal}
      <Dialog open={open} onOpenChange={(o) => safeViewTransition(() => !o && onClose())}>
        <DialogContent
          style={{ viewTransitionName: 'routine-detail-modal' } as React.CSSProperties}
          className="max-w-7xl w-[95vw] h-[90vh] p-0 border-none bg-black/40 shadow-none [&>button]:text-white [&>button]:z-20 z-[5001] rounded-[24px] md:rounded-[32px] overflow-hidden glass-panel"
        >
          {/* Content Viewport — overflow-y-auto directly on this div */}
          <div className="relative z-10 overflow-y-auto h-full w-full custom-scrollbar">
            <div className="p-4 md:p-8 lg:p-10">
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
