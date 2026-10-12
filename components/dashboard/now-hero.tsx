'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2, Check } from 'lucide-react'
import { useCognitiveTwin } from '@/lib/cognitive-twin-context'
import { useCognitivePhase } from '@/lib/cognitive-context'
import { springConfig } from '@/lib/design-tokens'
import { useChecklist, useCognitiveEngine } from '@/hooks/use-swr'
import type { ChecklistItem } from '@/types/checklist'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { useNovoMotionPolicy } from '@/hooks/use-novo-motion-policy'

// Calendar-signal changeTypes that mean "your schedule is the problem" (as
// opposed to e.g. a Notion signal) — the only cases where offering to
// reorganize the day, right here, is the actual fix rather than just more
// information. Matches lib/cognitive/calendar-signal.ts's evaluateCalendarThresholds.
const CALENDAR_DISRUPTION_TYPES = ['calendar_meeting_overload', 'calendar_no_focus_window', 'calendar_peak_conflict']

interface TaskLite {
  id: string
  title: string
  priority: string
  dueDate?: string | null
}

const EMPTY_CHECKLIST: ChecklistItem[] = []

interface PlatformSignalEntry {
  id: string
  changeType: string
  description: string
  createdAt: string
  platform: 'notion' | 'todoist' | 'calendar' | 'gmail' | 'books'
}

// Where clicking the signal card should take you, and what the trailing
// action-row text should say — one lookup per platform instead of a chain
// of ternaries that quietly assumed only two platforms would ever exist.
const PLATFORM_LINK: Record<PlatformSignalEntry['platform'], string> = {
  notion: '/checklist',
  todoist: '/checklist',
  calendar: '/calendar',
  gmail: '/connectors',
  books: '/library',
}
const PLATFORM_ACTION_LABEL: Record<PlatformSignalEntry['platform'], string> = {
  notion: 'Ver tareas',
  todoist: 'Ver tareas',
  calendar: 'Ver calendario',
  gmail: 'Ver conectores',
  books: 'Ver biblioteca',
}

interface AmbientStateEntry {
  status: 'active' | 'paused' | 'insufficient_context'
  summary: string
  initiative: string
  recommendation: { title: string; nextStep: string } | null
  question?: string
}

// Signal descriptions are stored as operational logs and may have been
// produced by older integrations. Never render them verbatim in "Ahora": a
// raw enum, JSON fragment, or emoji is useful to developers but not to the
// person deciding what to do next.
const SIGNAL_HEADLINE: Record<string, string> = {
  calendar_meeting_overload: 'Tienes reuniones muy seguidas. Reserva un margen antes de tu siguiente bloque.',
  calendar_no_focus_window: 'Tu calendario no deja espacio para concentrarte. Protege un bloque corto hoy.',
  calendar_peak_conflict: 'Una reunión cae dentro de tu ventana de mayor enfoque. Considera mover el trabajo profundo.',
  notion_overdue_accumulation: 'Hay tareas vencidas que necesitan una decisión. Empieza por la más importante.',
  todoist_overdue_accumulation: 'Hay tareas vencidas que necesitan una decisión. Empieza por la más importante.',
  context_switching: 'Has cambiado de contexto varias veces. Elige una sola tarea para los próximos minutos.',
  switch_context: 'Has cambiado de contexto varias veces. Elige una sola tarea para los próximos minutos.',
}

const PLATFORM_FALLBACK_HEADLINE: Record<PlatformSignalEntry['platform'], string> = {
  notion: 'El Gemelo detectó tareas que conviene revisar ahora.',
  todoist: 'El Gemelo detectó tareas que conviene revisar ahora.',
  calendar: 'El Gemelo detectó un cambio relevante en tu calendario.',
  gmail: 'El Gemelo detectó información pendiente en tus conexiones.',
  books: 'El Gemelo detectó una recomendación relevante para ti.',
}

function getSignalHeadline(signal: PlatformSignalEntry): string {
  return SIGNAL_HEADLINE[signal.changeType] ?? PLATFORM_FALLBACK_HEADLINE[signal.platform]
}

function cleanTaskTitle(title: string, resumeCopy: string) {
  if (/twin\s*agent/i.test(title) && /retomar|resume/i.test(title)) return resumeCopy
  if (/context[_ -]?switching|switch[_ -]?context/i.test(title)) return resumeCopy
  return title.replace(/^\p{Extended_Pictographic}\s*/u, '').trim()
}

const PHASE_COPY: Record<string, string> = {
  PEAK_FOCUS: 'Tu ventana de máximo enfoque está abierta.',
  LINEAR_EXECUTION: 'Buen momento para ejecutar con constancia.',
  SYNAPTIC_FATIGUE: 'Tu energía está baja ahora mismo — ve con calma.',
  REDUCED_CAPACITY_MODE: 'Capacidad reducida ahora mismo — un paso pequeño basta.',
}

const NOW_PHASE_PALETTE: Record<string, [string, string, string]> = {
  PEAK_FOCUS: ['#6366f1', '#2563eb', '#22d3ee'],
  LINEAR_EXECUTION: ['#10b981', '#34d399', '#2563eb'],
  SYNAPTIC_FATIGUE: ['#f59e0b', '#fb7185', '#8b5cf6'],
  REDUCED_CAPACITY_MODE: ['#86efac', '#1d4ed8', '#facc15'],
}

const NOW_THINKING_STATE: Record<string, 'thinking' | 'searching' | 'planning'> = {
  PEAK_FOCUS: 'thinking',
  LINEAR_EXECUTION: 'planning',
  SYNAPTIC_FATIGUE: 'searching',
  REDUCED_CAPACITY_MODE: 'thinking',
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
  // Real clustering-verified pattern from FocusSession history (see
  // lib/cognitive/focus-abandonment.ts) — only non-null when there's an
  // actual consistent early-stop point, never a guess from scattered data.
  if (typeof report.abandonmentPatternMinutes === 'number') {
    return `Sueles interrumpir tus sesiones de foco cerca del minuto ${report.abandonmentPatternMinutes} — prueba una pausa corta justo antes de esa marca.`
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
  const { t } = useTranslation()
  const phase = useCognitivePhase()
  const motionMode = useNovoMotionPolicy()
  const nowCardRef = useRef<HTMLDivElement>(null)
  const [nowVisible, setNowVisible] = useState(true)
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden')
  const [taskRows, setTaskRows] = useState<TaskLite[] | null>(null)
  const [platformSignal, setPlatformSignal] = useState<PlatformSignalEntry | null>(null)
  const [ambientState, setAmbientState] = useState<AmbientStateEntry | null>(null)
  const { data: checklistData, error: checklistError, mutate: mutateChecklist } = useChecklist()
  const checklistRows = Array.isArray(checklistData) ? checklistData : EMPTY_CHECKLIST
  const { task, hasAnyTask, isUrgentTask } = useMemo(() => {
    const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
    const now = Date.now()
    const taskRowsValue = taskRows ?? []
    const checklistTasks: TaskLite[] = checklistRows
      .filter((item) => !item.completed)
      .map((item) => ({
        id: 'checklist:' + item.id,
        title: item.text,
        priority: item.priority,
        dueDate: item.dueDate,
      }))
    const sorted = [...taskRowsValue, ...checklistTasks].sort((a, b) => {
      const overdueA = a.dueDate && new Date(a.dueDate).getTime() < now ? 0 : 1
      const overdueB = b.dueDate && new Date(b.dueDate).getTime() < now ? 0 : 1
      if (overdueA !== overdueB) return overdueA - overdueB
      return (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3)
    })
    const task = sorted[0] ?? null
    const isUrgentTask = !!task && (
      (!!task.dueDate && new Date(task.dueDate).getTime() < now) || task.priority === 'high'
    )
    return {
      task,
      isUrgentTask,
      hasAnyTask: taskRowsValue.length > 0 || checklistRows.length > 0,
    }
  }, [checklistRows, taskRows])
  // Progressive enhancement, not a load-blocking dependency: NowHero renders
  // immediately from local signals, then re-renders with the real read once
  // this (LLM-backed, slower) request resolves. Shares its SWR key with
  // CognitiveEngineWidget so the two don't double the LLM call.
  const { data: engineJson } = useCognitiveEngine()
  const engineReport = engineJson?.success ? engineJson.report : null
  const [applyState, setApplyState] = useState<'idle' | 'applying' | 'applied'>('idle')

  useEffect(() => {
    const element = nowCardRef.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setNowVisible(entry.isIntersecting), { threshold: 0.05 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const updatePageVisibility = () => setPageVisible(document.visibilityState !== 'hidden')
    updatePageVisibility()
    document.addEventListener('visibilitychange', updatePageVisibility)
    return () => document.removeEventListener('visibilitychange', updatePageVisibility)
  }, [])


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
    let disposed = false
    let requestController: AbortController | null = null
    const loadWorkspaceContext = (refreshChecklist = false) => {
      if (disposed || document.visibilityState === 'hidden') return Promise.resolve()
      requestController?.abort()
      const controller = new AbortController()
      requestController = controller
      const { signal } = controller
      if (refreshChecklist) void mutateChecklist().catch(() => undefined)

      const tasksRequest = fetch('/api/tasks?status=todo', { cache: 'no-store', signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((tasks: unknown) => {
          if (!disposed) setTaskRows(Array.isArray(tasks) ? tasks : [])
        })
        .catch((error: unknown) => {
          if (!disposed && (error as { name?: string })?.name !== 'AbortError') setTaskRows([])
        })

      const recommendationsRequest = Promise.all([
        fetch('/api/cognitive/active-signal', { cache: 'no-store', signal }).then((r) => (r.ok ? r.json() : { signal: null })),
        fetch('/api/cognitive/ambient', { cache: 'no-store', signal }).then((r) => (r.ok ? r.json() : { state: null })),
      ])
        .then(([activeSignalResponse, ambientResponse]: [{ signal: PlatformSignalEntry | null }, { state: AmbientStateEntry | null }]) => {
          if (disposed) return
          setPlatformSignal(activeSignalResponse.signal)
          setAmbientState(ambientResponse.state)
        })
        .catch((error: unknown) => {
          if ((error as { name?: string })?.name !== 'AbortError') return
        })

      return Promise.all([tasksRequest, recommendationsRequest]).then(() => undefined)
    }
    void loadWorkspaceContext()
    let interval: number | null = window.setInterval(() => void loadWorkspaceContext(true), 15 * 60 * 1000)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadWorkspaceContext(true)
        if (interval === null) interval = window.setInterval(() => void loadWorkspaceContext(true), 15 * 60 * 1000)
      } else if (interval !== null) {
        window.clearInterval(interval)
        interval = null
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      disposed = true
      requestController?.abort()
      if (interval !== null) window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [mutateChecklist])

  const phaseCopy = PHASE_COPY[phase] ?? PHASE_COPY.LINEAR_EXECUTION
  const now = Date.now()
  const isOverdue = !!task?.dueDate && new Date(task.dueDate).getTime() < now
  const frictionTip = twin.bottlenecks.mainFrictionPoint
    ? FRICTION_TIP[twin.bottlenecks.mainFrictionPoint]
    : null

  const checklistResolved = checklistData !== undefined || !!checklistError
  if (!isUrgentTask && (taskRows === null || !checklistResolved)) {
    return <div className="h-48 rounded-[28px] bg-foreground/[0.03] animate-pulse" />
  }

  // A platform signal only preempts a task when that task isn't urgent — a non-urgent
  // task with no competing signal still beats onboarding/generic fallback copy.
  const showPlatformSignal = !isUrgentTask && !!platformSignal
  const showAmbient = !isUrgentTask && !showPlatformSignal && !!ambientState && (!!ambientState.recommendation || !!ambientState.question) && ['PROACTIVE_SUGGESTION', 'UPDATE_RECOMMENDATION', 'ASK_USER'].includes(ambientState.initiative)
  const contextInsufficient = ambientState?.status === 'insufficient_context'
  const showTask = !!task && !showPlatformSignal && !showAmbient
  const taskTitle = task ? cleanTaskTitle(task.title, t('dashboard.twinResume')) : ''
  const signalHeadline = showPlatformSignal ? getSignalHeadline(platformSignal!) : null
  const linkHref = showTask
    ? '/checklist'
    : showAmbient
      ? '/cognitive'
    : showPlatformSignal
      ? PLATFORM_LINK[platformSignal!.platform]
      : '/checklist'

  // The engine already computed how to fix this in the same response that
  // produced the signal's headline — offer it right here instead of only
  // pointing at /calendar. Notion signals and non-disruption calendar
  // signals still just navigate, since there's nothing to "apply" for them.
  const canReorganize = showPlatformSignal && platformSignal!.platform === 'calendar' &&
    CALENDAR_DISRUPTION_TYPES.includes(platformSignal!.changeType) &&
    Array.isArray(engineReport?.reorganizedDay) && engineReport.reorganizedDay.length > 0

  const [phaseA, phaseB, phaseC] = NOW_PHASE_PALETTE[phase] ?? NOW_PHASE_PALETTE.LINEAR_EXECUTION
  const proceduralActive = motionMode === 'full' && nowVisible && pageVisible
  const cardInner = (
    <div
      ref={nowCardRef}
      data-now-visible={nowVisible ? 'true' : 'false'}
      data-novo-motion={motionMode}
      data-now-phase={phase}
      data-thinking-pill-state={NOW_THINKING_STATE[phase] ?? 'thinking'}
      style={{ '--now-primary': phaseA, '--now-secondary': phaseB, '--now-tertiary': phaseC } as CSSProperties}
      className="novo-now-panel group relative rounded-[28px] p-8 md:p-10 border border-primary/25 bg-background/20 overflow-hidden transition-[border-color,box-shadow] duration-300 hover:border-primary/40"
    >
      <div aria-hidden className="novo-thinking-pill__fields novo-now-procedural-fields" data-active={proceduralActive ? 'true' : 'false'}>
        <span className="novo-thinking-pill__field novo-thinking-pill__field--one" />
        <span className="novo-thinking-pill__field novo-thinking-pill__field--two" />
        <span className="novo-thinking-pill__field novo-thinking-pill__field--three" />
      </div>
      <div aria-hidden className="novo-now-contrast-scrim" />
      <div aria-hidden className="novo-now-noise" />
      <div className="relative z-10 flex items-center justify-between mb-3">
        <p className="text-[11px] font-black tracking-[0.25em] uppercase text-primary/70">
          Ahora →
        </p>
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary">
          {typeof twin?.confidenceScore === 'number' && twin.confidenceScore > 0
            ? `Twin activo · ${Math.round(twin.confidenceScore)}% de confianza`
            : 'Twin sin calibrar'}
        </span>
      </div>

      <div className="relative z-10">
      {showTask ? (
            <>
              <h2 className="relative text-2xl md:text-4xl font-semibold tracking-tight mb-2 max-w-2xl">{taskTitle}</h2>
              <p className="relative text-sm md:text-base text-foreground/60">
                {phaseCopy}
                {isOverdue && <span className="text-red-400 font-medium"> · vencida</span>}
              </p>
            </>
          ) : showAmbient ? (
            <>
              <h2 className="relative text-2xl md:text-4xl font-semibold tracking-tight mb-2 max-w-2xl">{ambientState?.initiative === 'ASK_USER' ? ambientState.question : ambientState?.recommendation?.title ?? ambientState?.question}</h2>
              <p className="relative text-sm md:text-base text-foreground/60">{ambientState?.recommendation?.nextStep ?? ambientState?.summary}</p>
            </>
          ) : showPlatformSignal ? (
            <>
              <h2 className="relative text-2xl md:text-4xl font-semibold tracking-tight mb-2 max-w-2xl">
                {signalHeadline}
              </h2>
              <p className="relative text-sm md:text-base text-foreground/60">{phaseCopy}</p>
            </>
          ) : twin.energyCurve.chronotype ? (
            <>
              <h2 className="relative text-2xl md:text-4xl font-semibold tracking-tight mb-2 max-w-2xl">
                {contextInsufficient ? 'Novo todavía está reuniendo contexto suficiente para priorizar con confianza.' : buildEngineHeadline(engineReport) ?? frictionTip ?? (hasAnyTask ? 'No hay tareas pendientes visibles. Revisa el contexto del Twin.' : 'Agrega tu primera tarea para que el Twin empiece a aprender.')}
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
                {contextInsufficient ? 'Novo todavía está reuniendo contexto suficiente para priorizar con confianza.' : hasAnyTask ? 'No hay tareas pendientes visibles. Revisa el contexto del Twin.' : 'Agrega tu primera tarea para que el Twin empiece a aprender.'}
              </h2>
              <p className="relative text-sm md:text-base text-foreground/60">{phaseCopy}</p>
            </>
          )}

      </div>

      {canReorganize ? (
        <div className="relative z-10 mt-5 flex flex-wrap items-center gap-3">
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
        <div className="relative z-10 mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:gap-2.5 transition-all duration-300">
          {showTask ? 'Ir a la tarea' : showAmbient ? 'Ver por qué' : showPlatformSignal ? PLATFORM_ACTION_LABEL[platformSignal!.platform] : 'Agregar tarea'} <ArrowRight className="w-3.5 h-3.5" />
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
