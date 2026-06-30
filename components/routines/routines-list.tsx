import { motion } from 'framer-motion'
import { Repeat2, ArrowRight } from 'lucide-react'
import { Routine } from '@/types/routine'
import { RoutineCard } from './routine-card'
import { springConfig } from '@/lib/design-tokens'

interface RoutinesListProps {
  routines: Routine[]
  onEdit: (routine: Routine) => void
  onDelete: (id: string) => void
  onView: (routine: Routine) => void
  activeTransitionId?: string
}

export function RoutinesList({ routines, onEdit, onDelete, onView, activeTransitionId }: RoutinesListProps) {
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
          <p className="text-base font-bold text-white/80">
            Your consistency layer is empty
          </p>
          <p className="text-sm text-white/35 leading-relaxed">
            Routines let Novo predict your day, balance your workload, and protect
            your peak focus hours automatically.
          </p>
        </div>

        {/* Suggested first step */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/[0.08] text-xs font-semibold text-white/40"
          style={{ background: 'rgba(255,255,255,0.025)' }}
        >
          <ArrowRight className="w-3.5 h-3.5 text-primary/60" />
          Use the <span className="text-primary/80 font-black">+ New Routine</span> button above to begin
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
