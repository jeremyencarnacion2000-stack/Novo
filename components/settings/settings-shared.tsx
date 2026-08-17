'use client'

import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Disabled module metadata ────────────────────────────────────────────────
export interface DisabledModule {
  id: string
  title: string
  icon: React.ElementType
  reason: string
  confidence: number
  timestamp: string
}

// ─── Tab type ────────────────────────────────────────────────────────────────
export type Tab = 'twin' | 'personalization' | 'modules' | 'preferences' | 'ai_models' | 'advanced' | 'integrations' | 'billing' | 'mcp'

// ─── All available modules ───────────────────────────────────────────────────
import {
  Sun, Bot, Brain, Timer, GraduationCap, Briefcase, BookOpen, Sparkles,
  Heart, Music, ListChecks, CheckSquare, KanbanSquare, TrendingUp
} from 'lucide-react'

export const ALL_MODULES = [
  { id: 'today',     title: 'Daily Dashboard',  icon: Sun,          desc: 'Central workspace view.' },
  { id: 'ai',        title: 'AI Assistant',      icon: Bot,          desc: 'Interact with your cognitive AI.' },
  { id: 'cognitive', title: 'Cognitive Engine',  icon: Brain,        desc: 'View twin cognitive analytics.' },
  { id: 'focus',     title: 'Focus & Pomodoro',  icon: Timer,        desc: 'Deep work focus timers.' },
  { id: 'school',    title: 'School',            icon: GraduationCap,desc: 'Track academic courses and grades.' },
  { id: 'business',  title: 'Business',          icon: Briefcase,    desc: 'Manage clients, deals, and projects.' },
  { id: 'library',   title: 'Library',           icon: BookOpen,     desc: 'Track reading lists and page logs.' },
  { id: 'spiritual', title: 'Spiritual',         icon: Sparkles,     desc: 'Record gratitude and affirmations.' },
  { id: 'appearance',title: 'Fitness',           icon: Heart,        desc: 'Log fitness workouts and routines.' },
  { id: 'music',     title: 'Music Player',      icon: Music,        desc: 'Play ambient background music.' },
  { id: 'routines',  title: 'Routines',          icon: ListChecks,   desc: 'Habits and daily repeaters.' },
  { id: 'checklist', title: 'Checklist',         icon: CheckSquare,  desc: 'Rapid tasks and checklists.' },
  { id: 'projects',  title: 'Projects',          icon: KanbanSquare, desc: 'Goal-based project pipelines.' },
  { id: 'trackers',  title: 'Trackers',          icon: TrendingUp,   desc: 'Track numeric metrics and stats.' },
]

// ─── Sub-section wrapper ──────────────────────────────────────────────────────
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/30">{title}</p>
      {children}
    </div>
  )
}

// ─── Row wrapper ──────────────────────────────────────────────────────────────
export function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-foreground/[0.04] last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground/85">{label}</p>
        {description && <p className="text-xs text-foreground/35 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

// ─── Danger Action button ─────────────────────────────────────────────────────
export function DangerAction({ icon: Icon, label, description, onClick, loading }: {
  icon: React.ElementType; label: string; description: string; onClick: () => void; loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-3 p-4 rounded-2xl border border-red-500/15 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/25 transition-all duration-300 text-left group"
    >
      <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/15 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/20 transition-colors">
        <Icon className="w-4 h-4 text-red-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-red-300">{loading ? 'Processing...' : label}</p>
        <p className="text-xs text-foreground/35 mt-0.5">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-foreground/20 group-hover:text-red-400 transition-colors" />
    </button>
  )
}

// ─── Safe Action button ───────────────────────────────────────────────────────
export function SafeAction({ icon: Icon, label, description, onClick, loading }: {
  icon: React.ElementType; label: string; description: string; onClick: () => void; loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-3 p-4 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] hover:bg-foreground/[0.05] hover:border-foreground/10 transition-all duration-300 text-left group"
    >
      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground/80">{loading ? 'Processing...' : label}</p>
        <p className="text-xs text-foreground/35 mt-0.5">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-foreground/20 group-hover:text-primary transition-colors" />
    </button>
  )
}

// ─── Adaptation option button ─────────────────────────────────────────────────
export function OptionButton({ label, description, selected, onClick }: {
  label: string; description: string; selected: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex flex-col items-start gap-1 p-3.5 rounded-2xl border transition-all duration-300 text-left',
        selected
          ? 'bg-primary/10 border-primary/30 shadow-[0_0_20px_rgba(99,102,241,0.08)]'
          : 'bg-foreground/[0.02] border-foreground/[0.06] hover:bg-foreground/[0.04] hover:border-foreground/10',
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn('w-2 h-2 rounded-full transition-colors', selected ? 'bg-primary' : 'bg-foreground/20')} />
        <span className={cn('text-sm font-semibold', selected ? 'text-primary' : 'text-foreground/70')}>{label}</span>
      </div>
      <p className="text-[11px] text-foreground/35 pl-4">{description}</p>
    </button>
  )
}
