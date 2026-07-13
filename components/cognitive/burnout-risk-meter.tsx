'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BurnoutRiskMeterProps {
  risk: number; // 0-100
  workloadDensity: number;
  focusFragmentation: number;
  overduePressure: number;
}

function getRiskLevel(risk: number) {
  if (risk >= 75) return {
    label: 'CRITICAL', color: '#ef4444', bg: 'bg-red-500', textColor: 'text-red-400',
    glow: 'rgba(239,68,68,0.5)', border: 'border-red-500/30',
    shadow: '0_0_30px_rgba(239,68,68,0.25)', track: 'rgba(239,68,68,0.08)',
  };
  if (risk >= 50) return {
    label: 'WARNING', color: '#f59e0b', bg: 'bg-amber-500', textColor: 'text-amber-400',
    glow: 'rgba(245,158,11,0.5)', border: 'border-amber-500/30',
    shadow: '0_0_30px_rgba(245,158,11,0.2)', track: 'rgba(245,158,11,0.06)',
  };
  if (risk >= 25) return {
    label: 'MODERATE', color: '#f97316', bg: 'bg-orange-500', textColor: 'text-orange-400',
    glow: 'rgba(249,115,22,0.4)', border: 'border-orange-500/20',
    shadow: '0_0_30px_rgba(249,115,22,0.15)', track: 'rgba(249,115,22,0.06)',
  };
  return {
    label: 'SAFE', color: '#22c55e', bg: 'bg-green-500', textColor: 'text-green-400',
    glow: 'rgba(34,197,94,0.4)', border: 'border-green-500/20',
    shadow: '0_0_30px_rgba(34,197,94,0.15)', track: 'rgba(34,197,94,0.06)',
  };
}

const FACTORS = [
  { key: 'workloadDensity', label: 'Workload Density', desc: 'Overdue + today task pressure' },
  { key: 'focusFragmentation', label: 'Focus Fragmentation', desc: 'Interrupted session ratio' },
  { key: 'overduePressure', label: 'Overdue Pressure', desc: 'Unresolved deadline count' },
];

const clampPct = (n: number) => Math.min(100, Math.max(0, n));

export function BurnoutRiskMeter({ risk, workloadDensity, focusFragmentation, overduePressure }: BurnoutRiskMeterProps) {
  risk = clampPct(risk);
  const level = getRiskLevel(risk);
  const factors = {
    workloadDensity: clampPct(workloadDensity),
    focusFragmentation: clampPct(focusFragmentation),
    overduePressure: clampPct(overduePressure),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.6 }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs font-black tracking-[0.25em] uppercase text-foreground/50">Burnout Risk</h3>
          <p className="text-[10px] text-foreground/25 mt-0.5 tracking-wide">workload · fragmentation · pressure</p>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className="text-3xl font-black tabular-nums leading-none"
            style={{ color: level.color, textShadow: `0 0 20px ${level.glow}` }}
          >
            {risk}
          </span>
          <div
            className={cn('text-[9px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full border', level.border)}
            style={{ color: level.color, background: level.track, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04)` }}
          >
            {level.label}
          </div>
        </div>
      </div>

      {/* Main gauge bar — glass panel with neon fill */}
      <div
        className="relative h-3.5 rounded-full overflow-hidden mb-1.5 border border-foreground/[0.06]"
        style={{ background: 'rgba(255,255,255,0.02)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}
      >
        {/* Zone gradient track */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, rgba(34,197,94,0.06) 0%, rgba(249,115,22,0.06) 25%, rgba(245,158,11,0.08) 50%, rgba(239,68,68,0.10) 75%)'
          }}
        />

        {/* Animated neon fill — scaleX (GPU-only) instead of width (layout) */}
        <motion.div
          className={cn('absolute inset-y-0 left-0 w-full rounded-full', level.bg)}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: risk / 100 }}
          transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.6 }}
          style={{ transformOrigin: 'left', boxShadow: `0 0 12px ${level.glow}, 0 0 20px ${level.glow}` }}
        />

        {/* Glowing tip marker — translateX (GPU-only) instead of left (layout).
            y stays inside Framer's own transform (not the Tailwind -translate-y-1/2
            class) because Framer's inline transform would otherwise clobber it. */}
        <motion.div
          className="absolute top-1/2 left-0 w-4 h-4 rounded-full bg-white border-2 shadow-lg"
          style={{ borderColor: level.color, boxShadow: `0 0 10px ${level.glow}` }}
          initial={{ x: 0, y: '-50%' }}
          animate={{ x: `calc(${risk}% - 8px)`, y: '-50%' }}
          transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.6 }}
        />
      </div>

      {/* Zone labels */}
      <div className="flex justify-between text-[8px] text-foreground/20 font-bold tracking-wider mb-5 px-0.5">
        <span>SAFE</span><span>MODERATE</span><span>WARNING</span><span>CRITICAL</span>
      </div>

      {/* Factor breakdown with glass bars */}
      <div className="space-y-3">
        {FACTORS.map(({ key, label }) => {
          const val = factors[key as keyof typeof factors];
          const fl = getRiskLevel(val);
          return (
            <div key={key} className="flex items-center gap-3 group">
              <div className="w-28 flex-shrink-0">
                <p className="text-[9px] font-bold text-foreground/40 uppercase tracking-wide truncate group-hover:text-foreground/60 transition-colors">
                  {label}
                </p>
              </div>

              {/* Glass bar track */}
              <div
                className="flex-1 h-2 rounded-full overflow-hidden border border-foreground/[0.05]"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <motion.div
                  className={cn('h-full rounded-full', fl.bg)}
                  initial={{ width: 0 }}
                  animate={{ width: `${val}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.8 }}
                  style={{ boxShadow: `0 0 8px ${fl.glow}` }}
                />
              </div>

              <span className={cn('text-[9px] font-black tabular-nums w-8 text-right', fl.textColor)}>
                {val}%
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
