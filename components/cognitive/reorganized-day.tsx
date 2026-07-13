'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronDown, ChevronUp, Zap, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReorganizedTask } from './types';

const PRIORITY_STYLES = {
  high: {
    dot: 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]',
    badge: 'text-red-400 bg-red-500/10 border-red-500/25',
    accent: 'rgba(239,68,68,0.35)',
    bar: 'border-l-red-500/50',
    label: 'HIGH',
  },
  medium: {
    dot: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]',
    badge: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
    accent: 'rgba(245,158,11,0.35)',
    bar: 'border-l-amber-500/50',
    label: 'MED',
  },
  low: {
    dot: 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]',
    badge: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
    accent: 'rgba(59,130,246,0.35)',
    bar: 'border-l-blue-500/50',
    label: 'LOW',
  },
};

const TIME_OF_DAY = (hour: number) => {
  if (hour < 6) return { label: 'Early Morning', color: '#818cf8', bg: 'rgba(129,140,248,0.1)' };
  if (hour < 12) return { label: 'Morning', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' };
  if (hour < 14) return { label: 'Midday', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
  if (hour < 17) return { label: 'Afternoon', color: '#f97316', bg: 'rgba(249,115,22,0.1)' };
  return { label: 'Evening', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' };
};

interface ReorganizedDayProps {
  tasks: ReorganizedTask[];
}

export function ReorganizedDay({ tasks }: ReorganizedDayProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [applyState, setApplyState] = useState<'idle' | 'applying' | 'applied'>('idle');

  const handleApply = async () => {
    setApplyState('applying');
    try {
      const res = await fetch('/api/ai/cognitive-engine/apply-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorganizedDay: tasks }),
      });
      if (!res.ok) throw new Error();
      setApplyState('applied');
    } catch {
      setApplyState('idle');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-5">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center border border-primary/25"
          style={{ background: 'rgba(99,102,241,0.1)', boxShadow: '0 0 12px rgba(99,102,241,0.12)' }}
        >
          <Zap className="w-3 h-3 text-primary" />
        </div>
        <h3 className="text-xs font-black tracking-[0.25em] uppercase text-foreground/50">
          AI-Reorganized Day
        </h3>
        <span
          className="text-[9px] font-black px-2 py-0.5 rounded-full text-primary tracking-widest border border-primary/25"
          style={{ background: 'rgba(99,102,241,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
        >
          AUTO
        </span>
        <span className="ml-auto text-[10px] text-foreground/20 font-medium mr-1">{tasks.length} tasks</span>
        <button
          onClick={handleApply}
          disabled={applyState !== 'idle'}
          className={cn(
            'flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border transition-all',
            applyState === 'applied'
              ? 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10'
              : 'text-primary border-primary/25 hover:bg-primary/10'
          )}
          style={{ background: applyState === 'idle' ? 'rgba(99,102,241,0.08)' : undefined }}
        >
          {applyState === 'applying' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
          {applyState === 'applied' && <Check className="w-2.5 h-2.5" />}
          {applyState === 'idle' ? 'Aplicar a Hoy' : applyState === 'applying' ? 'Aplicando…' : 'Aplicado'}
        </button>
      </div>

      <div className="space-y-2">
        {tasks.map((task, i) => {
          const priority = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium;
          const timeOfDay = TIME_OF_DAY(task.scheduledHour);
          const isExpanded = expandedId === task.id;

          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : task.id)}
                className={cn(
                  'w-full text-left group relative overflow-hidden',
                  'flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all duration-400',
                  'border-foreground/[0.06] hover:border-foreground/[0.14] hover:scale-[1.01]',
                  isExpanded
                    ? 'bg-primary/[0.04] border-primary/20 rounded-b-none hover:border-primary/30'
                    : 'bg-foreground/[0.015] hover:bg-foreground/[0.03]'
                )}
                style={{
                  boxShadow: isExpanded
                    ? '0 8px 30px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                }}
              >
                {/* Left priority accent bar */}
                <div
                  className={cn('absolute left-0 top-3 bottom-3 w-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300', priority.bar)}
                />

                {/* Index badge */}
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-foreground/30 flex-shrink-0 border border-foreground/[0.08]"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  {i + 1}
                </span>

                {/* Priority dot */}
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', priority.dot)} />

                {/* Time block */}
                <div
                  className="flex flex-col items-center justify-center flex-shrink-0 w-12 py-1 rounded-lg border border-transparent group-hover:border-foreground/[0.06] transition-all duration-300"
                  style={{ background: isExpanded ? timeOfDay.bg : 'transparent' }}
                >
                  <span className="text-[11px] font-black tabular-nums leading-none" style={{ color: timeOfDay.color }}>
                    {task.scheduledTime}
                  </span>
                  <span className="text-[7px] text-foreground/25 font-semibold tracking-wide leading-none mt-1">
                    {timeOfDay.label.split(' ')[0].toUpperCase()}
                  </span>
                </div>

                {/* Arrow divider */}
                <ArrowRight className="w-3 h-3 text-foreground/15 flex-shrink-0" />

                {/* Task title */}
                <span className="flex-1 text-[13px] font-semibold text-foreground/80 truncate group-hover:text-foreground/90 transition-colors">
                  {task.title}
                </span>

                {/* Priority badge */}
                <span className={cn(
                  'text-[8px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full border flex-shrink-0',
                  priority.badge
                )}>
                  {priority.label}
                </span>

                {/* Expand chevron */}
                {isExpanded
                  ? <ChevronUp className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
                  : <ChevronDown className="w-3.5 h-3.5 text-foreground/20 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                }
              </button>

              {/* Expanded AI reason panel */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <div
                      className="mx-0 px-4 py-3 rounded-b-2xl border border-t-0 border-primary/20"
                      style={{
                        background: 'rgba(99,102,241,0.04)',
                        boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.02)'
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[9px] font-black tracking-widest uppercase text-primary/60 whitespace-nowrap pt-0.5">
                          AI Reason ·
                        </span>
                        <p className="text-[11px] text-foreground/45 leading-relaxed">{task.reason}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
