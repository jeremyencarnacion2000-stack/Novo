import { motion } from 'framer-motion'
import { Repeat2, ArrowRight } from 'lucide-react'
import { Routine } from '@/types/routine'
import { RoutineCard } from './routine-card'
import { springConfig } from '@/lib/design-tokens'
import { useTranslation } from '@/lib/i18n'

interface RoutinesListProps {
  routines: Routine[]
  onEdit: (routine: Routine) => void
  onDelete: (id: string) => void
  onView: (routine: Routine) => void
  activeTransitionId?: string
}

export function RoutinesList({ routines, onEdit, onDelete, onView, activeTransitionId }: RoutinesListProps) {
  const { language } = useTranslation()
  const copy = language === 'es'
    ? { emptyTitle: 'Tu día todavía no tiene rutinas', emptyDescription: 'Crea una rutina sencilla y Novo aprenderá cuándo te resulta más fácil mantenerla.', hint: 'Empieza con el botón', action: 'Añadir rutina' }
    : { emptyTitle: 'Your day has no routines yet', emptyDescription: 'Create one simple routine and Novo will learn when it is easiest for you to keep it.', hint: 'Start with the', action: 'Add routine' }
  if (routines.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center justify-center py-20 gap-5 text-center"
      >
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl border border-primary/20 flex items-center justify-center"
          style={{ background: 'rgba(99,102,241,0.08)', boxShadow: '0 0 32px rgba(99,102,241,0.12)' }}
        >
          <Repeat2 className="w-7 h-7 text-primary/70" />
        </div>

        {/* Narrative — Cognitive Compression: not "no routines", but "what you gain" */}
        <div className="max-w-sm space-y-2">
          <p className="text-base font-bold text-foreground/80">
            {copy.emptyTitle}
          </p>
          <p className="text-sm text-foreground/35 leading-relaxed">
            {copy.emptyDescription}
          </p>
        </div>

        {/* Suggested first step */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-foreground/[0.08] text-xs font-semibold text-foreground/40"
          style={{ background: 'rgba(255,255,255,0.025)' }}
        >
          <ArrowRight className="w-3.5 h-3.5 text-primary/60" />
          {copy.hint} <span className="text-primary/80 font-black">+ {copy.action}</span>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {routines.map((routine, i) => (
        <motion.div
          key={routine.id}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig.gentle, delay: Math.min(i, 12) * 0.06 }}
        >
          <RoutineCard
            routine={routine}
            onEdit={onEdit}
            onDelete={onDelete}
            onView={onView}
            isActiveTransition={activeTransitionId === routine.id}
          />
        </motion.div>
      ))}
    </div>
  )
}
