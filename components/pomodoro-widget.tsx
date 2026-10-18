'use client'

import { forwardRef } from 'react'
import { useFocus, useFocusControls } from '@/lib/focus-context'
import { HubGlassMaterial } from '@/components/ui/hub-glass-material'
import { Pause, Play, RotateCcw, Timer, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type PomodoroWidgetProps = {
  open: boolean
  animating: boolean
  onClose: (keyboardActivated: boolean) => void
}

export const PomodoroWidget = forwardRef<HTMLDivElement, PomodoroWidgetProps>(
  function PomodoroWidget({ open, animating, onClose }, ref) {
    const { mode, time, formatTime, isActive, progress, selectedTaskId, tasks } = useFocus()
    const { toggleTimer, resetTimer } = useFocusControls()
    const modeLabel = mode === 'work' ? 'Trabajo' : mode === 'shortBreak' ? 'Descanso' : 'Descanso largo'
    const selectedTask = tasks.find(task => task.id === selectedTaskId && !task.completed)
    const progressValue = Math.min(100, Math.max(0, Math.round(progress)))

    return (
      <div
        ref={ref}
        data-pomodoro-surface
        className="novo-hub-pomodoro fixed right-16 top-6 z-[63] h-[148px] w-40 overflow-hidden rounded-[24px] bg-transparent text-white shadow-[0_16px_40px_rgba(0,0,0,0.3)]"
        aria-hidden={!open || animating}
        inert={!open || animating}
        style={{ opacity: 0, clipPath: 'circle(0px at 50% 50%)', pointerEvents: 'none' }}
      >
        <HubGlassMaterial radius={24} active={open || animating} priority="interactive" />

        <div data-pomodoro-content role="region" aria-label="Temporizador Pomodoro" className="relative z-[1] flex h-full flex-col items-center justify-between px-3 py-0.5">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Timer aria-hidden="true" className="h-3 w-3 text-white/60" />
              <span className="text-[10px] font-medium text-white/80">
                {modeLabel}
              </span>
            </div>
            <button
              type="button"
              aria-label="Cerrar Pomodoro y volver al Hub"
              onClick={(event) => onClose(event.detail === 0)}
              className="-mr-2 grid h-11 w-11 place-items-center rounded-lg text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>

          <div role="timer" aria-label="Tiempo restante" className="text-[30px] font-normal leading-none tracking-[-0.03em] tabular-nums text-white">
            {formatTime(time)}
          </div>

          <div className="w-full min-w-0 space-y-1">
            <div className="flex min-w-0 items-center justify-between gap-2 text-[9px] text-white/85">
              <span title={selectedTask?.text ?? 'Sin tarea seleccionada'} className="min-w-0 truncate">
                {selectedTask?.text ?? 'Sin tarea seleccionada'}
              </span>
              <span className="shrink-0 font-mono tabular-nums">{progressValue}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Progreso del intervalo"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressValue}
              className="h-1 w-full overflow-hidden rounded-full bg-white/20"
            >
              <div aria-hidden="true" className="h-full rounded-full bg-white/80 transition-[width] duration-300" style={{ width: `${progressValue}%` }} />
            </div>
            <span role="status" aria-live="polite" className="sr-only">
              Temporizador {isActive ? 'en marcha' : 'en pausa'} · {modeLabel}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              data-pomodoro-primary
              onClick={toggleTimer}
              aria-label={isActive ? 'Pausar temporizador' : 'Continuar temporizador'}
              className="grid h-11 w-11 place-items-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {isActive ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="ml-0.5 h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={resetTimer}
              aria-label="Reiniciar temporizador"
              className="grid h-11 w-11 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  },
)

PomodoroWidget.displayName = 'PomodoroWidget'
