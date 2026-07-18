'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FocusScoreRingProps {
  score: number;
  energyLevel: 'high' | 'medium' | 'low' | 'critical';
  animated?: boolean;
}

const COLORS = {
  high: { stroke: '#22c55e', glow: 'rgba(34,197,94,0.35)', text: '#22c55e', label: 'OPTIMAL' },
  medium: { stroke: '#f59e0b', glow: 'rgba(245,158,11,0.35)', text: '#f59e0b', label: 'MODERATE' },
  low: { stroke: '#f97316', glow: 'rgba(249,115,22,0.35)', text: '#f97316', label: 'LOW' },
  critical: { stroke: '#ef4444', glow: 'rgba(239,68,68,0.4)', text: '#ef4444', label: 'CRITICAL' },
};

export function FocusScoreRing({ score, energyLevel, animated = true }: FocusScoreRingProps) {
  const color = COLORS[energyLevel] ?? COLORS.medium;
  const radius = 82;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const dashOffset = circumference - progress;

  return (
    <motion.div 
      className={cn(
        "relative flex items-center justify-center w-60 h-60 rounded-full transition-all duration-500",
        "border border-foreground/10 bg-foreground/[0.01] backdrop-blur-xl",
        "shadow-[inset_0_1px_2px_rgba(255,255,255,0.08),0_20px_50px_rgba(0,0,0,0.4)]",
        "hover:border-foreground/20 hover:bg-foreground/[0.02]"
      )}
      whileHover={{ scale: 1.02 }}
    >
      {/* High-frequency grain noise overlay for crystalline texture */}
      <div 
        className="absolute inset-0 rounded-full opacity-[0.03] pointer-events-none mix-blend-overlay z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Ambient neon backdrop glow */}
      <div
        className="absolute inset-4 rounded-full opacity-15 blur-2xl transition-all duration-500 z-0"
        style={{ background: `radial-gradient(circle, ${color.stroke} 0%, transparent 70%)` }}
      />

      {/* Cockpit instrument bezel scale ticks */}
      <div className="absolute inset-0 rounded-full border border-foreground/[0.04] scale-[0.9] pointer-events-none z-0" />
      
      {/* SVG gauge overlay */}
      <svg width="240" height="240" viewBox="0 0 240 240" className="absolute inset-0 -rotate-90 z-10">
        <defs>
          <linearGradient id={`glowGrad-${energyLevel}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color.stroke} />
            <stop offset="100%" stopColor={color.stroke === '#ef4444' ? '#7f1d1d' : color.stroke === '#22c55e' ? '#14532d' : '#9a3412'} />
          </linearGradient>
          <filter id="neonBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Circular tracks */}
        <circle
          cx="120" cy="120" r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.03)"
          strokeWidth="10"
        />
        <circle
          cx="120" cy="120" r={radius + 6}
          fill="none"
          stroke="rgba(255,255,255,0.01)"
          strokeWidth="1"
          strokeDasharray="4 8"
        />

        {/* Active dynamic progress glow path */}
        <motion.circle
          cx="120" cy="120" r={radius}
          fill="none"
          stroke={`url(#glowGrad-${energyLevel})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
          filter="url(#neonBlur)"
        />

        {/* Mechanical measurement tick marks */}
        {Array.from({ length: 40 }).map((_, i) => {
          const angle = (i / 40) * 360;
          const rad = (angle * Math.PI) / 180;
          const isMajor = i % 10 === 0;
          const tickLen = isMajor ? 12 : 6;
          const x1 = 120 + (radius - 16) * Math.cos(rad);
          const y1 = 120 + (radius - 16) * Math.sin(rad);
          const x2 = 120 + (radius - 16 + tickLen) * Math.cos(rad);
          const y2 = 120 + (radius - 16 + tickLen) * Math.sin(rad);
          return (
            <line 
              key={i} 
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isMajor ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'} 
              strokeWidth={isMajor ? '1.5' : '1'} 
            />
          );
        })}
      </svg>

      {/* Center readout overlay */}
      <div className="relative z-20 flex flex-col items-center select-none text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex items-baseline justify-center"
        >
          <span 
            className="text-6xl font-black tracking-tighter text-glow font-sans leading-none"
            style={{ 
              color: color.text,
              textShadow: `0 0 20px ${color.glow}`
            }}
          >
            {score}
          </span>
        </motion.div>
        
        <span className="text-[9px] font-black tracking-[0.35em] uppercase text-foreground/30 mt-2 leading-none">
          FOCUS VALUE
        </span>

        {/* Crystalline dynamic recovery pill */}
        <motion.div
          className="mt-3.5 px-3 py-1 rounded-full border flex items-center justify-center transition-all duration-300"
          style={{ 
            color: color.text, 
            borderColor: color.stroke + '35', 
            background: color.glow + '12',
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 12px ${color.glow}08`
          }}
          whileHover={{ scale: 1.05 }}
        >
          <span className="text-[8px] font-black tracking-[0.25em] uppercase leading-none">
            {color.label}
          </span>
        </motion.div>
      </div>

      {/* Subtle orbit pulse for hyper-focus aesthetic */}
      {(energyLevel === 'critical' || energyLevel === 'low') && (
        <motion.div
          className="absolute inset-[-4px] rounded-full border border-dashed opacity-40"
          style={{ borderColor: color.stroke }}
          animate={{ rotate: 360 }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </motion.div>
  );
}

