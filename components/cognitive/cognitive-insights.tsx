'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Moon, AlertTriangle, Brain, Zap, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springConfig } from '@/lib/design-tokens';
import type { CognitiveInsight } from './types';

const ICONS = {
  recovery: Moon,
  procrastination: TrendingDown,
  cognitive_load: Brain,
  focus_window: Zap,
  pattern: AlertTriangle,
};

const SEVERITY_STYLES = {
  info: {
    border: 'border-indigo-500/20 hover:border-indigo-500/40',
    bg: 'bg-indigo-950/10 backdrop-blur-md',
    icon: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]',
    badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    glow: 'hover:bloom-soft',
  },
  warning: {
    border: 'border-amber-500/25 hover:border-amber-500/45',
    bg: 'bg-amber-950/10 backdrop-blur-md',
    icon: 'text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    glow: 'hover:bloom-medium',
  },
  critical: {
    border: 'border-red-500/30 hover:border-red-500/50',
    bg: 'bg-red-950/10 backdrop-blur-md',
    icon: 'text-red-400 bg-red-500/10 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    glow: 'hover:bloom-strong',
  },
};

const SEVERITY_LABELS = { info: 'DETECTED', warning: 'WARNING', critical: 'CRITICAL' };

interface CognitiveInsightsProps {
  insights: CognitiveInsight[];
}

export function CognitiveInsights({ insights }: CognitiveInsightsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-xs font-black tracking-[0.25em] uppercase text-foreground/50">
          Detected Signals
        </h3>
        <span 
          className="text-[9px] font-black px-2 py-0.5 rounded-full border text-foreground/40 tracking-widest bg-foreground/[0.02] border-foreground/10"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}
        >
          {insights.length} ACTIVE
        </span>
      </div>

      {insights.map((insight, i) => {
        const Icon = ICONS[insight.type] ?? Brain;
        const styles = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.info;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springConfig.smooth, delay: 0.1 + i * 0.08 }}
            className={cn(
              'flex items-start gap-4 p-4 rounded-2xl border transition-all duration-500 cursor-default relative overflow-hidden',
              'glass-card-list group hover:scale-[1.02]',
              styles.border, styles.bg, styles.glow
            )}
            style={{
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
            }}
          >
            {/* Grain noise overlay inside individual cards */}
            <div 
              className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
              }}
            />

            {/* Icon */}
            <div className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 mt-0.5 transition-transform duration-500 group-hover:scale-110',
              styles.icon
            )}>
              <Icon className="w-4 h-4" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[13px] font-bold text-foreground/90 truncate transition-colors group-hover:text-foreground">
                  {insight.headline}
                </span>
                <span className={cn(
                  'text-[8px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full border flex-shrink-0',
                  styles.badge
                )}>
                  {SEVERITY_LABELS[insight.severity]}
                </span>
              </div>
              <p className="text-[11px] text-foreground/45 leading-relaxed font-normal">{insight.detail}</p>
              {insight.action && (
                <div className="mt-3 flex">
                  <span className={cn(
                    'text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full border transition-all duration-300',
                    styles.badge,
                    'bg-foreground/[0.02] hover:bg-foreground/[0.08] cursor-pointer'
                  )}>
                    → {insight.action}
                  </span>
                </div>
              )}
            </div>

            {/* Pulse dot for critical */}
            {insight.severity === 'critical' && (
              <motion.div
                className="w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0 mt-2 shadow-[0_0_8px_#f87171]"
                animate={{ opacity: [1, 0.3, 1], scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </motion.div>
        );
      })}

      {insights.length === 0 && (
        <div className="text-center py-8 text-foreground/25 text-xs font-medium border border-dashed border-foreground/10 rounded-2xl bg-foreground/[0.01]">
          No active cognitive alerts detected · All channels nominal
        </div>
      )}
    </div>
  );
}

