'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useCognitiveTwin } from '@/lib/cognitive-twin-context'
import { useCognitivePhase } from '@/lib/cognitive-context'
import { springConfig } from '@/lib/design-tokens'

interface TaskLite {
  id: string
  title: string
  priority: string
  dueDate: string | null
}

const PHASE_COPY: Record<string, string> = {
  PEAK_FOCUS: 'Tu ventana de máximo enfoque está abierta.',
  LINEAR_EXECUTION: 'Buen momento para ejecutar con constancia.',
  SYNAPTIC_FATIGUE: 'Tu energía está baja ahora mismo — ve con calma.',
  REDUCED_CAPACITY_MODE: 'Capacidad reducida ahora mismo — un paso pequeño basta.',
}

const FRICTION_TIP: Record<string, string> = {
  procrastination: 'Empieza con el paso más pequeño posible — solo 2 minutos.',
  context_switching: 'Cierra todo lo demás y quédate en una sola cosa.',
  overcommitment: 'Elige solo UNA cosa. Lo demás espera.',
  lack_of_structure: 'Bloquea 25 minutos ahora mismo, sin más planeación.',
}

// The single decision that replaces the old cold-start card, which fabricated
// clinical-sounding claims ("Impaired Sleep Debt Detected") for brand-new
// accounts with zero real signal. This pulls only things that are actually
// true: a real pending task if one exists, or — if not — the user's own
// onboarding answers (chronotype, peak window, stated friction point),
// framed honestly as "según lo que nos dijiste", never as a "detected" pattern.
export function NowHero() {
  const { twin } = useCognitiveTwin()
  const phase = useCognitivePhase()
  const [task, setTask] = useState<TaskLite | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tasks?status=todo')
      .then((r) => (r.ok ? r.json() : []))
      .then((tasks: TaskLite[]) => {
        const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
        const now = Date.now()
        const sorted = [...tasks].sort((a, b) => {
          const overdueA = a.dueDate && new Date(a.dueDate).getTime() < now ? 0 : 1
          const overdueB = b.dueDate && new Date(b.dueDate).getTime() < now ? 0 : 1
          if (overdueA !== overdueB) return overdueA - overdueB
          return (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3)
        })
        setTask(sorted[0] ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const phaseCopy = PHASE_COPY[phase] ?? PHASE_COPY.LINEAR_EXECUTION
  const isOverdue = !!task?.dueDate && new Date(task.dueDate).getTime() < Date.now()
  const frictionTip = twin.bottlenecks.mainFrictionPoint
    ? FRICTION_TIP[twin.bottlenecks.mainFrictionPoint]
    : null

  if (loading) {
    return <div className="h-48 rounded-[28px] bg-foreground/[0.03] animate-pulse" />
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={springConfig.smooth}>
      <Link href={task ? '/checklist' : twin.energyCurve.chronotype ? '/checklist' : '/onboarding'} className="block group">
        <div className="relative rounded-[28px] p-8 md:p-10 border border-primary/25 bg-gradient-to-br from-primary/[0.10] via-primary/[0.03] to-transparent overflow-hidden transition-all duration-300 hover:border-primary/40">
          <div
            className="absolute -top-10 -right-10 w-56 h-56 rounded-full opacity-20 blur-3xl pointer-events-none transition-opacity duration-500 group-hover:opacity-30"
            style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
          />
          <p className="relative text-[11px] font-black tracking-[0.25em] uppercase text-primary/70 mb-3">Ahora →</p>

          {task ? (
            <>
              <h2 className="relative text-2xl md:text-4xl font-semibold tracking-tight mb-2 max-w-2xl">{task.title}</h2>
              <p className="relative text-sm md:text-base text-foreground/60">
                {phaseCopy}
                {isOverdue && <span className="text-red-400 font-medium"> · vencida</span>}
              </p>
            </>
          ) : twin.energyCurve.chronotype ? (
            <>
              <h2 className="relative text-2xl md:text-4xl font-semibold tracking-tight mb-2 max-w-2xl">
                {frictionTip ?? 'Agrega tu primera tarea para que el Twin empiece a aprender.'}
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

          <div className="relative mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:gap-2.5 transition-all duration-300">
            {task ? 'Ir a la tarea' : 'Agregar tarea'} <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
