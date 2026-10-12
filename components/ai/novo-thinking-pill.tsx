'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RotateCw, Square } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { useNovoActivityRun } from '@/hooks/use-novo-activity-run'
import { useNovoMotionPolicy } from '@/hooks/use-novo-motion-policy'
import { useTranslation } from '@/lib/i18n'
import type { NovoActivityPhase } from '@/lib/ai/activity-contract'

export type ThinkingPillVisualState =
  | 'thinking'
  | 'searching'
  | 'planning'
  | 'acting'
  | 'confirmation'
  | 'learning'
  | 'drafting'
  | 'reconnecting'
  | 'completed'
  | 'error'

const phaseFamily: Partial<Record<NovoActivityPhase, ThinkingPillVisualState>> = {
  initializing: 'thinking',
  retrieving_context: 'searching',
  interpreting_signals: 'thinking',
  evaluating_constraints: 'thinking',
  prioritizing: 'thinking',
  planning: 'planning',
  calling_tool: 'acting',
  awaiting_confirmation: 'confirmation',
  executing_action: 'acting',
  verifying_result: 'acting',
  learning: 'learning',
  adapting: 'learning',
  composing_response: 'drafting',
  completed: 'completed',
  failed: 'error',
  cancelled: 'error',
}

const labels = {
  en: {
    thinking: 'Thinking', searching: 'Searching context', planning: 'Planning', acting: 'Acting',
    confirmation: 'Waiting for confirmation', learning: 'Learning', drafting: 'Writing',
    reconnecting: 'Reconnecting', completed: 'Ready', error: 'Needs attention', cancelled: 'Run stopped',
    detail: 'Activity details', hide: 'Hide details', stop: 'Stop run', retry: 'Retry connection',
    engine: 'Twin intelligence', model: 'Model', intent: 'Intent', fallback: 'Recovery route',
  },
  es: {
    thinking: 'Pensando', searching: 'Buscando contexto', planning: 'Planificando', acting: 'Actuando',
    confirmation: 'Esperando confirmación', learning: 'Aprendiendo', drafting: 'Redactando',
    reconnecting: 'Reconectando', completed: 'Listo', error: 'Necesita atención', cancelled: 'Ejecución detenida',
    detail: 'Detalles de actividad', hide: 'Ocultar detalles', stop: 'Detener ejecución', retry: 'Reintentar conexión',
    engine: 'Inteligencia del Twin', model: 'Modelo', intent: 'Intención', fallback: 'Ruta de respaldo',
  },
  fr: {
    thinking: 'Réflexion', searching: 'Recherche du contexte', planning: 'Planification', acting: 'Action',
    confirmation: 'En attente de confirmation', learning: 'Apprentissage', drafting: 'Rédaction',
    reconnecting: 'Reconnexion', completed: 'Prêt', error: 'Attention requise', cancelled: 'Exécution arrêtée',
    detail: "Détails de l’activité", hide: 'Masquer les détails', stop: "Arrêter l’exécution", retry: 'Réessayer la connexion',
    engine: 'Intelligence du Twin', model: 'Modèle', intent: 'Intention', fallback: 'Route de secours',
  },
  de: {
    thinking: 'Denken', searching: 'Kontext durchsuchen', planning: 'Planen', acting: 'Ausführen',
    confirmation: 'Warten auf Bestätigung', learning: 'Lernen', drafting: 'Verfassen',
    reconnecting: 'Neu verbinden', completed: 'Bereit', error: 'Aufmerksamkeit nötig', cancelled: 'Ausführung beendet',
    detail: 'Aktivitätsdetails', hide: 'Details ausblenden', stop: 'Ausführung stoppen', retry: 'Verbindung erneut versuchen',
    engine: 'Twin-Intelligenz', model: 'Modell', intent: 'Absicht', fallback: 'Ausweichroute',
  },
} as const

type Props = {
  runId: string | null
  modelLabel: string | null
  intent: string | null
  fallback: boolean
  onCancel?: () => void
}

export function NovoThinkingPill({ runId, modelLabel, intent, fallback, onCancel }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [cancelError, setCancelError] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  )
  const pillRef = useRef<HTMLDivElement>(null)
  const { language } = useTranslation()
  const motionMode = useNovoMotionPolicy()
  const activity = useNovoActivityRun(runId)
  const copy = labels[language as keyof typeof labels] ?? labels.en
  // A terminal run returned by cancellation/completion is authoritative over a
  // preceding activity event. Otherwise a just-cancelled search briefly reads
  // “Searching context” even though the action is already stopped.
  const phase = ((activity.terminal ? activity.run?.phase : undefined) ?? activity.current?.phase ?? activity.run?.phase ?? 'initializing') as NovoActivityPhase
  const state: ThinkingPillVisualState = activity.disconnected
    ? 'reconnecting'
    : phaseFamily[phase] ?? 'thinking'
  const label = activity.terminal && (activity.run?.status === 'cancelled' || phase === 'cancelled')
    ? copy.cancelled
    : copy[state]
  const showThinkingDots = !activity.terminal && state !== 'completed' && state !== 'error'
  const ambientActive = motionMode === 'full' && !activity.terminal && !activity.disconnected && isVisible && pageVisible
  const transition = motionMode === 'off'
    ? { duration: 0 }
    : motionMode === 'reduced'
      ? { duration: 0.16, ease: 'easeOut' as const }
      : { type: 'spring' as const, stiffness: 330, damping: 34, mass: 0.82 }

  const detailsId = `novo-thinking-details-${runId ?? 'pending'}`
  const localizeTimelineLabel = (item: { phase: string; label: string }) => {
    const itemState = phaseFamily[item.phase as NovoActivityPhase]
    return itemState ? copy[itemState] : item.label
  }

  useEffect(() => {
    const element = pillRef.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry?.isIntersecting ?? true),
      { rootMargin: '96px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  return (
    <motion.div
      ref={pillRef}
      layout
      initial={motionMode === 'off' ? false : { opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={motionMode === 'off' ? { opacity: 0 } : { opacity: 0, y: -5, scale: 0.985 }}
      transition={transition}
      className={expanded ? 'w-full max-w-2xl px-2 sm:px-6' : 'w-fit max-w-[calc(100%-1rem)] px-2 sm:px-6'}
      data-thinking-pill-state={state}
    >
      <GlassSurface
        preset="status"
        refractive
        radius={expanded ? 28 : undefined}
        refractivePriority="critical"
        refractiveActive={!activity.terminal}
        webComponent
        elevation="high"
        className="novo-thinking-pill overflow-hidden text-foreground"
      >
        <div aria-hidden className="novo-thinking-pill__fields" data-active={ambientActive ? 'true' : 'false'}>
          <span className="novo-thinking-pill__field novo-thinking-pill__field--one" />
          <span className="novo-thinking-pill__field novo-thinking-pill__field--two" />
          <span className="novo-thinking-pill__field novo-thinking-pill__field--three" />
        </div>

        <button
          type="button"
          className="relative flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={label}
          onClick={() => setExpanded((value) => !value)}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[8px] font-semibold uppercase tracking-[0.2em] text-foreground/55">{copy.engine}</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={state}
                className="block truncate text-sm font-medium"
                initial={motionMode === 'full' ? { opacity: 0, y: 5 } : { opacity: 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={motionMode === 'full' ? { opacity: 0, y: -4 } : { opacity: 0 }}
                transition={{ duration: motionMode === 'full' ? 0.42 : 0.14, ease: [0.16, 1, 0.3, 1] }}
                aria-live="polite"
                aria-atomic="true"
              >
                {label}
                {showThinkingDots ? (
                  <span className="novo-thinking-pill__dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : null}
              </motion.span>
            </AnimatePresence>
          </span>
        </button>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              id={detailsId}
              key="details"
              initial={motionMode === 'full' ? { opacity: 0, y: -8 } : { opacity: 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={motionMode === 'full' ? { opacity: 0, y: -6 } : { opacity: 0 }}
              transition={{ duration: motionMode === 'full' ? 0.4 : 0.14, ease: [0.16, 1, 0.3, 1] }}
              className="relative border-t border-white/10 px-4 pb-4 pt-3"
            >
              {(modelLabel || intent || fallback) && (
                <div className="mb-3 flex flex-wrap gap-2 text-[10px] text-foreground/65">
                  {modelLabel ? <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">{copy.model}: {modelLabel}</span> : null}
                  {intent ? <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">{copy.intent}: {intent}</span> : null}
                  {fallback ? <span className="rounded-full border border-amber-400/20 bg-amber-300/10 px-2.5 py-1">{copy.fallback}</span> : null}
                </div>
              )}

              {activity.timeline.length > 0 ? (
                <ol className="space-y-2" aria-label={copy.detail}>
                  {activity.timeline.map((item) => (
                    <li key={`${item.runId}-${item.sequence}`} className="flex items-start gap-2 text-xs">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
                      <span className="text-foreground/75">
                        {localizeTimelineLabel(item)}
                        {item.detail ? <span className="block text-[11px] text-muted-foreground">{item.detail}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-foreground/55">{label}</p>
              )}

              {cancelError ? <p role="alert" className="mt-3 text-xs text-destructive">{copy.error}</p> : null}
              <div className="mt-4 flex items-center justify-end gap-2">
                {activity.disconnected ? (
                  <button type="button" onClick={activity.retry} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs hover:bg-white/10" aria-label={copy.retry}>
                    <RotateCw className="size-3" aria-hidden /> {copy.retry}
                  </button>
                ) : null}
                {runId && !activity.terminal ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCancelError(false)
                      void activity.cancel().then(onCancel).catch(() => setCancelError(true))
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs hover:bg-white/10"
                    aria-label={copy.stop}
                  >
                    <Square className="size-3" aria-hidden /> {copy.stop}
                  </button>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </GlassSurface>
    </motion.div>
  )
}
