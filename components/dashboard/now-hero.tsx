'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2, Check } from 'lucide-react'
import { useCognitiveTwin } from '@/lib/cognitive-twin-context'
import { useCognitivePhase } from '@/lib/cognitive-context'
import { springConfig } from '@/lib/design-tokens'
import { useCognitiveEngine } from '@/hooks/use-swr'
import { cn } from '@/lib/utils'

// Calendar-signal changeTypes that mean "your schedule is the problem" (as
// opposed to e.g. a Notion signal) — the only cases where offering to
// reorganize the day, right here, is the actual fix rather than just more
// information. Matches lib/cognitive/calendar-signal.ts's evaluateCalendarThresholds.
const CALENDAR_DISRUPTION_TYPES = ['calendar_meeting_overload', 'calendar_no_focus_window', 'calendar_peak_conflict']

interface TaskLite {
  id: string
  title: string
  priority: string
  dueDate: string | null
}

interface PlatformSignalEntry {
  id: string
  changeType: string
  description: string
  createdAt: string
  platform: 'notion' | 'calendar'
}

const PHASE_COPY: Record<string, string> = {
  PEAK_FOCUS: 'Tu ventana de máximo enfoque está abierta.',
  LINEAR_EXECUTION: 'Buen momento para ejecutar con constancia.',
  SYNAPTIC_FATIGUE: 'Tu energía está baja ahora mismo — ve con calma.',
  REDUCED_CAPACITY_MODE: 'Capacidad reducida ahora mismo — un paso pequeño basta.',
}

export const FRICTION_TIP: Record<string, string> = {
  procrastination: 'Empieza con el paso más pequeño posible — solo 2 minutos.',
  context_switching: 'Cierra todo lo demás y quédate en una sola cosa.',
  overcommitment: 'Elige solo UNA cosa. Lo demás espera.',
  lack_of_structure: 'Bloquea 25 minutos ahora mismo, sin más planeación.',
}

const formatHour12 = (hour: number): string => {
  const period = hour < 12 ? 'am' : 'pm'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}${period}`
}

// The cognitive-engine route already computes a real procrastination read,
// recovery state, and a chronotype-adjusted peak window for every user — but
// that only ever surfaced on /cognitive, a page most people never open. This
// builds real Spanish copy directly from the report's NUMERIC/enum fields
// (never its free-text headline/detail/recommendation strings, which the
// LLM prompt doesn't constrain to Spanish and could come back in English).
// Only used in the branch where NowHero has nothing more concrete to show
// (no urgent task, no platform signal) — that's exactly where a static,
// generic friction tip was the weakest part of the hero.
function buildEngineHeadline(report: any): string | null {
  if (!report) return null
  if (report.recoveryState === 'critical') {
    return 'Tu energía estimada está muy baja ahora mismo — prioriza algo ligero.'
  }
  if (report.procrastinationAlert) {
    return 'Sueles posponer tareas como esta — el paso más pequeño posible cuenta.'
  }
  if (typeof report.peakWindowStart === 'number' && typeof report.peakWindowEnd === 'number') {
    return `Tu ventana de máximo enfoque hoy es de ${formatHour12(report.peakWindowStart)} a ${formatHour12(report.peakWindowEnd)}.`
  }
  return null
}

// The single decision that replaces the old cold-start card, which fabricated
// clinical-sounding claims ("Impaired Sleep Debt Detected") for brand-new
// accounts with zero real signal. Priority order: an overdue or high-priority
// task wins (most concrete and actionable); otherwise a real calendar signal
// logged today (e.g. meeting overload) takes over; otherwise a real
// cognitive-engine read (recovery state, procrastination, peak window) when
// it's loaded; otherwise the user's own onboarding answers, framed honestly
// as "según nos dijiste" — never a "detected" pattern.
export function NowHero() {
  const { twin } = useCognitiveTwin()
  const phase = useCognitivePhase()
  const [task, setTask] = useState<TaskLite | null>(null)
  const [platformSignal, setPlatformSignal] = useState<PlatformSignalEntry | null>(null)
  const [loading, setLoading] = useState(true)
  // Progressive enhancement, not a load-blocking dependency: NowHero renders
  // immediately from local signals, then re-renders with the real read once
  // this (LLM-backed, slower) request resolves. Shares its SWR key with
  // CognitiveEngineWidget so the two don't double the LLM call.
  const { data: engineJson } = useCognitiveEngine()
  const engineReport = engineJson?.success ? engineJson.report : null
  const [applyState, setApplyState] = useState<'idle' | 'applying' | 'applied'>('idle')

  // Same endpoint ReorganizedDay (/cognitive) already uses to persist the
  // engine's suggested hours onto real Task records — reused here so a
  // calendar-disruption signal can be fixed right where it's shown instead
  // of requiring a trip to /cognitive first.
  const handleReorganize = async (reorganizedDay: unknown) => {
    setApplyState('applying')
    try {
      const res = await fetch('/api/ai/cognitive-engine/apply-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorganizedDay }),
      })
      if (!res.ok) throw new Error()
      setApplyState('applied')
    } catch {
      setApplyState('idle')
    }
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks?status=todo').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/cognitive/active-signal').then((r) => (r.ok ? r.json() : { signal: null })),
    ])
      .then(([tasks, activeSignalResponse]: [TaskLite[], { signal: PlatformSignalEntry | null }]) => {
        const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
        const now = Date.now()
        const sorted = [...tasks].sort((a, b) => {
          const overdueA = a.dueDate && new Date(a.dueDate).getTime() < now ? 0 : 1
          const overdueB = b.dueDate && new Date(b.dueDate).getTime() < now ? 0 : 1
          if (overdueA !== overdueB) return overdueA - overdueB
          return (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3)
        })
        const topTask = sorted[0] ?? null
        setTask(topTask)

        const isUrgentTask = !!topTask && (
          (!!topTask.dueDate && new Date(topTask.dueDate).getTime() < now) || topTask.priority === 'high'
        )
        if (!isUrgentTask) {
          setPlatformSignal(activeSignalResponse.signal)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const phaseCopy = PHASE_COPY[phase] ?? PHASE_COPY.LINEAR_EXECUTION
  const now = Date.now()
  const isUrgentTask = !!task && ((!!task.dueDate && new Date(task.dueDate).getTime() < now) || task.priority === 'high')
  const isOverdue = !!task?.dueDate && new Date(task.dueDate).getTime() < now
  const frictionTip = twin.bottlenecks.mainFrictionPoint
    ? FRICTION_TIP[twin.bottlenecks.mainFrictionPoint]
    : null

  if (loading) {
    return <div className="h-48 rounded-[28px] bg-foreground/[0.03] animate-pulse" />
  }

  // A platform signal only preempts a task when that task isn't urgent — a non-urgent
  // task with no competing signal still beats onboarding/generic fallback copy.
  const showPlatformSignal = !isUrgentTask && !!platformSignal
  const showTask = !!task && !showPlatformSignal
  const linkHref = showTask
    ? '/checklist'
    : showPlatformSignal
      ? (platformSignal!.platform === 'notion' ? '/checklist' : '/calendar')
      : twin.energyCurve.chronotype ? '/checklist' : '/onboarding'

  // The engine already computed how to fix this in the same response that
  // produced the signal's headline — offer it right here instead of only
  // pointing at /calendar. Notion signals and non-disruption calendar
  // signals still just navigate, since there's nothing to "apply" for them.
  const canReorganize = showPlatformSignal && platformSignal!.platform === 'calendar' &&
    CALENDAR_DISRUPTION_TYPES.includes(platformSignal!.changeType) &&
    Array.isArray(engineReport?.reorganizedDay) && engineReport.reorganizedDay.length > 0

  const cardInner = (
    <div className="relative rounded-[28px] p-8 md:p-10 border border-primary/25 bg-gradient-to-br from-primary/[0.10] via-primary/[0.03] to-transparent overflow-hidden transition-all duration-300 hover:border-primary/40">
      <div
        className="absolute -top-10 -right-10 w-56 h-56 rounded-full opacity-20 blur-3xl pointer-events-none transition-opacity duration-500 group-hover:opacity-30"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
      />
      <p className="relative text-[11px] font-black tracking-[0.25em] uppercase text-primary/70 mb-3">Ahora →</p>

      {showTask ? (
            <>
              <h2 className="relative text-2xl md:text-4xl font-semibold tracking-tight mb-2 max-w-2xl">{task!.title}</h2>
              <p className="relative text-sm md:text-base text-foreground/60">
                {phaseCopy}
                {isOverdue && <span className="text-red-400 font-medium"> · vencida</span>}
              </p>
            </>
          ) : showPlatformSignal ? (
            <>
              <h2 className="relative text-2xl md:text-4xl font-semibold tracking-tight mb-2 max-w-2xl">
                {platformSignal!.description}
              </h2>
              <p className="relative text-sm md:text-base text-foreground/60">{phaseCopy}</p>
            </>
          ) : twin.energyCurve.chronotype ? (
            <>
              <h2 className="relative text-2xl md:text-4xl font-semibold tracking-tight mb-2 max-w-2xl">
                {buildEngineHeadline(engineReport) ?? frictionTip ?? 'Agrega tu primera tarea para que el Twin empiece a aprender.'}
              </h2>
              <p className="relative text-sm md:text-base text-foreground/60">
                {phaseCopy}
                {twin.energyCurve.peakFocusStart && (
                  <> · tu ventana pico, según nos dijiste, es {twin.energyCurve.peakFocusStart}–{twin.energyCurve.peakFocusEnd}</>
                )}
              </p>
            </>
          ) : (
            <>
              <h2 className="relative text-2xl md:text-4xl font-semibold tracking-tight mb-2 max-w-2xl">
                Agrega tu primera tarea para que el Twin empiece a aprender.
              </h2>
              <p className="relative text-sm md:text-base text-foreground/60">{phaseCopy}</p>
            </>
          )}

      {canReorganize ? (
        <div className="relative mt-5 flex flex-wrap items-center gap-3">
          <Link
            href={linkHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/50 hover:text-foreground/80 transition-colors"
          >
            Ver calendario <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            disabled={applyState !== 'idle'}
            onClick={() => handleReorganize(engineReport.reorganizedDay)}
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full border transition-all duration-300',
              applyState === 'applied'
                ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                : 'text-primary border-primary/30 bg-primary/10 hover:bg-primary/15 disabled:opacity-70'
            )}
          >
            {applyState === 'applying' && <Loader2 className="w-3 h-3 animate-spin" />}
            {applyState === 'applied' && <Check className="w-3 h-3" />}
            {applyState === 'idle' ? 'Reorganizar mi día' : applyState === 'applying' ? 'Reorganizando…' : 'Día reorganizado'}
          </button>
        </div>
      ) : (
        <div className="relative mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:gap-2.5 transition-all duration-300">
          {showTask ? 'Ir a la tarea' : showPlatformSignal ? (platformSignal!.platform === 'notion' ? 'Ver tareas' : 'Ver calendario') : 'Agregar tarea'} <ArrowRight className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={springConfig.smooth}>
      {canReorganize ? (
        cardInner
      ) : (
        <Link href={linkHref} className="block group">
          {cardInner}
        </Link>
      )}
    </motion.div>
  )
}
