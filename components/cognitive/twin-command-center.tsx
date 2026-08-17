'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Brain, CalendarClock, ChevronDown, Clock3, Focus, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { CognitiveReport, CognitiveSignals } from './types'

type SupportedLanguage = 'en' | 'es' | 'fr' | 'de'

const COPY: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    eyebrow: 'YOUR COGNITIVE TWIN', ready: 'Ready to help', recovery: 'Recovery is the priority',
    focus: 'Your best window is open', steady: 'A steady next step is best',
    focusDetail: 'Protect a short block for the task that needs the most thought.', recoveryDetail: 'Your workload can wait. A lighter next step protects tomorrow’s focus.', steadyDetail: 'Choose one meaningful task and keep the plan deliberately small.',
    startFocus: 'Start a focus block', openRecovery: 'Open recovery', askTwin: 'Ask the Twin', refresh: 'Refresh signals',
    sources: 'What the Twin is using', sourcesDetail: 'It only uses your Novo activity, preferences and connected sources you have approved. It never acts without showing the change first.',
    confidence: 'Confidence', tasks: 'tasks pending', overdue: 'overdue', focusMinutes: 'focus min today', update: 'Updated', minutes: 'min ago', now: 'now',
    transparent: 'Transparent by design', transparentDetail: 'Recommendations are based on the signals below, not hidden assumptions.',
  },
  es: {
    eyebrow: 'TU GEMELO COGNITIVO', ready: 'Listo para ayudarte', recovery: 'La recuperación es prioridad',
    focus: 'Tu mejor ventana está abierta', steady: 'Conviene un siguiente paso sereno',
    focusDetail: 'Protege un bloque corto para la tarea que requiere más atención.', recoveryDetail: 'Tu carga puede esperar. Un siguiente paso ligero protege tu foco de mañana.', steadyDetail: 'Elige una tarea importante y mantén el plan deliberadamente pequeño.',
    startFocus: 'Iniciar bloque de foco', openRecovery: 'Abrir recuperación', askTwin: 'Preguntar al Gemelo', refresh: 'Actualizar señales',
    sources: 'Qué está usando el Gemelo', sourcesDetail: 'Solo usa tu actividad en Novo, tus preferencias y las fuentes conectadas que aprobaste. Nunca actúa sin mostrarte antes el cambio.',
    confidence: 'Confianza', tasks: 'tareas pendientes', overdue: 'vencidas', focusMinutes: 'min de foco hoy', update: 'Actualizado', minutes: 'min atrás', now: 'ahora',
    transparent: 'Transparente por diseño', transparentDetail: 'Las recomendaciones se basan en estas señales, no en supuestos ocultos.',
  },
  fr: {
    eyebrow: 'VOTRE JUMEAU COGNITIF', ready: 'Prêt à vous aider', recovery: 'La récupération est prioritaire',
    focus: 'Votre meilleure fenêtre est ouverte', steady: 'Un prochain pas calme est préférable',
    focusDetail: 'Protégez un court bloc pour la tâche qui demande le plus d’attention.', recoveryDetail: 'Votre charge peut attendre. Un prochain pas plus léger protège votre concentration de demain.', steadyDetail: 'Choisissez une tâche importante et gardez le plan volontairement simple.',
    startFocus: 'Démarrer un bloc de concentration', openRecovery: 'Ouvrir la récupération', askTwin: 'Demander au Jumeau', refresh: 'Actualiser les signaux',
    sources: 'Ce que le Jumeau utilise', sourcesDetail: 'Il utilise seulement votre activité Novo, vos préférences et les sources connectées que vous avez approuvées. Il n’agit jamais sans vous montrer le changement.',
    confidence: 'Confiance', tasks: 'tâches en attente', overdue: 'en retard', focusMinutes: 'min de concentration aujourd’hui', update: 'Mis à jour', minutes: 'min plus tôt', now: 'maintenant',
    transparent: 'Transparent par conception', transparentDetail: 'Les recommandations se fondent sur ces signaux, jamais sur des hypothèses cachées.',
  },
  de: {
    eyebrow: 'DEIN KOGNITIVER ZWILLING', ready: 'Bereit, dir zu helfen', recovery: 'Erholung hat jetzt Vorrang',
    focus: 'Dein bestes Zeitfenster ist offen', steady: 'Ein ruhiger nächster Schritt ist sinnvoll',
    focusDetail: 'Schütze einen kurzen Block für die Aufgabe mit dem höchsten Denkaufwand.', recoveryDetail: 'Deine Last kann warten. Ein leichterer nächster Schritt schützt den Fokus von morgen.', steadyDetail: 'Wähle eine wichtige Aufgabe und halte den Plan bewusst klein.',
    startFocus: 'Fokusblock starten', openRecovery: 'Erholung öffnen', askTwin: 'Zwilling fragen', refresh: 'Signale aktualisieren',
    sources: 'Was der Zwilling nutzt', sourcesDetail: 'Er nutzt nur deine Novo-Aktivität, Präferenzen und von dir genehmigte verbundene Quellen. Er handelt nie, ohne dir die Änderung vorher zu zeigen.',
    confidence: 'Vertrauen', tasks: 'offene Aufgaben', overdue: 'überfällig', focusMinutes: 'Fokusminuten heute', update: 'Aktualisiert', minutes: 'Min. zuvor', now: 'jetzt',
    transparent: 'Transparent gestaltet', transparentDetail: 'Empfehlungen beruhen auf diesen Signalen, nicht auf verborgenen Annahmen.',
  },
}

function relativeUpdate(date: Date | null, copy: Record<string, string>) {
  if (!date) return copy.now
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000))
  return minutes === 0 ? copy.now : `${minutes} ${copy.minutes}`
}

export function TwinCommandCenter({
  report,
  signals,
  confidence,
  updatedAt,
  isRefreshing,
  onPrimaryAction,
  onAskTwin,
  onRefresh,
}: {
  report: CognitiveReport
  signals: CognitiveSignals
  confidence?: number
  updatedAt: Date | null
  isRefreshing: boolean
  onPrimaryAction: () => void
  onAskTwin: () => void
  onRefresh: () => void
}) {
  const { language } = useTranslation()
  const locale = (language in COPY ? language : 'en') as SupportedLanguage
  const copy = COPY[locale]
  const reduceMotion = useReducedMotion()
  const [showSources, setShowSources] = useState(false)
  // FocusScore is a planning estimate, not a diagnosis or fatigue measurement.
  const hasFocusWindow = report.focusScore >= 70
  const title = hasFocusWindow ? copy.focus : copy.steady
  const detail = hasFocusWindow ? copy.focusDetail : copy.steadyDetail
  const iconClass = hasFocusWindow ? 'border-indigo-300/20 bg-indigo-400/10 text-indigo-100' : 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.1] bg-[linear-gradient(135deg,rgba(99,102,241,0.16),rgba(255,255,255,0.035)_47%,rgba(16,185,129,0.06))] p-5 shadow-[0_28px_90px_-48px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.13)] backdrop-blur-2xl sm:p-7">
      <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-indigo-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 size-56 rounded-full bg-emerald-400/[0.07] blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-300/15 bg-indigo-400/[0.08] px-2.5 py-1 text-[10px] font-semibold tracking-[0.13em] text-indigo-100/90">
              <span className="size-1.5 rounded-full bg-indigo-300 shadow-[0_0_10px_rgba(165,180,252,0.9)]" />
              {copy.eyebrow}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-white/45"><Clock3 className="size-3" />{copy.update} {relativeUpdate(updatedAt, copy)}</span>
          </div>
          <div className="mt-5 flex gap-4 sm:items-center">
            <motion.div
              animate={reduceMotion ? { opacity: 1 } : { transform: ['scale(1)', 'scale(1.035)', 'scale(1)'] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
              className={cn('mt-0.5 flex size-12 shrink-0 items-center justify-center rounded-2xl border shadow-[0_0_26px_-8px_rgba(129,140,248,0.75)]', iconClass)}
            >
              <Brain className="size-5" strokeWidth={1.7} />
            </motion.div>
            <div>
              <p className="text-sm font-medium text-white/58">{copy.ready}</p>
              <h2 className="mt-1 max-w-2xl text-balance text-[1.7rem] font-medium leading-[1.08] tracking-[-0.045em] text-white sm:text-[2.2rem]">{title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/58">{detail}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <button onClick={onPrimaryAction} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-black shadow-[0_10px_30px_-16px_rgba(255,255,255,0.7)] transition-[transform,background] duration-150 hover:bg-white/90 active:scale-[0.97]">
              <Focus className="size-4" />
              {copy.startFocus}
            </button>
            <button onClick={onAskTwin} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.05] px-4 text-sm font-medium text-white/82 transition-[transform,background,border-color] duration-150 hover:border-white/[0.18] hover:bg-white/[0.09] active:scale-[0.97]">
              <Sparkles className="size-4 text-indigo-200" /> {copy.askTwin}
            </button>
            <button onClick={onRefresh} disabled={isRefreshing} aria-label={copy.refresh} className="inline-flex size-11 items-center justify-center rounded-2xl border border-white/[0.09] bg-black/10 text-white/52 transition-[transform,background,color] duration-150 hover:bg-white/[0.06] hover:text-white disabled:opacity-45 active:scale-[0.97]">
              <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
          <Metric value={confidence && confidence > 0 ? `${Math.round(confidence)}%` : '—'} label={copy.confidence} tone="indigo" />
          <Metric value={String(signals.pendingTasks)} label={copy.tasks} tone="slate" />
          <Metric value={String(signals.overdueTasks)} label={copy.overdue} tone={signals.overdueTasks > 0 ? 'amber' : 'slate'} />
          <Metric value={String(signals.totalFocusMinutesToday)} label={copy.focusMinutes} tone="emerald" />
        </div>
      </div>
      <div className="relative mt-5 border-t border-white/[0.08] pt-4">
        <button onClick={() => setShowSources((open) => !open)} aria-expanded={showSources} className="flex w-full items-center justify-between text-left text-xs text-white/52 transition-colors hover:text-white/80">
          <span className="inline-flex items-center gap-2"><ShieldCheck className="size-3.5 text-emerald-300" />{copy.transparent}</span>
          <ChevronDown className={cn('size-4 transition-transform duration-200', showSources && 'rotate-180')} />
        </button>
        {showSources && <p className="max-w-3xl pt-3 text-xs leading-relaxed text-white/48">{copy.sourcesDetail}</p>}
      </div>
    </section>
  )
}

function Metric({ value, label, tone }: { value: string; label: string; tone: 'indigo' | 'emerald' | 'amber' | 'slate' }) {
  const tones = { indigo: 'border-indigo-300/15 bg-indigo-400/[0.07] text-indigo-100', emerald: 'border-emerald-300/15 bg-emerald-400/[0.07] text-emerald-100', amber: 'border-amber-300/15 bg-amber-400/[0.07] text-amber-100', slate: 'border-white/[0.08] bg-black/10 text-white/86' }
  return <div className={cn('min-w-0 rounded-2xl border p-3.5', tones[tone])}><p className={cn('text-xl font-semibold tabular-nums tracking-[-0.04em]', tone === 'slate' && 'text-white/88')}>{value}</p><p className="mt-1 text-[10px] leading-tight text-white/48">{label}</p></div>
}
