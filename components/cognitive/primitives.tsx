'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { springConfig } from '@/lib/design-tokens'
import { ShieldCheck, ShieldAlert, Shield, ShieldX, Brain, Zap, Battery, Activity, ArrowRight, Sparkles, Clock } from 'lucide-react'
import type { TrustLevel } from '@/lib/cognitive-twin-context'

// ─────────────────────────────────────────────────────────────────────────────
// ConfidenceGauge
// A circular arc gauge that visually represents a 0-100 confidence score.
// Pure visual — receives score as a prop.
// ─────────────────────────────────────────────────────────────────────────────

interface ConfidenceGaugeProps {
  score: number         // 0-100
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export function ConfidenceGauge({ score, size = 'md', showLabel = true, className }: ConfidenceGaugeProps) {
  const dims = { sm: 64, md: 88, lg: 120 }
  const strokes = { sm: 5, md: 6, lg: 8 }
  const dim = dims[size]
  const stroke = strokes[size]

  // Arc math — 3/4 circle starting from bottom-left
  const radius = (dim - stroke * 2) / 2
  const cx = dim / 2
  const cy = dim / 2
  const circumference = 2 * Math.PI * radius
  const arcFraction = 0.75 // 270 degrees
  const arcLen = circumference * arcFraction
  const fillLen = (score / 100) * arcLen

  // Color stops based on score
  const color = score >= 80 ? '#6366f1' : score >= 60 ? '#8b5cf6' : score >= 40 ? '#a78bfa' : '#d946ef'
  const glowColor = score >= 80 ? 'rgba(99,102,241,0.4)' : 'rgba(139,92,246,0.3)'

  // Rotation so arc starts at ~225deg (bottom-left)
  const rotateAngle = 135

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <svg width={dim} height={dim} style={{ transform: `rotate(${rotateAngle}deg)` }}>
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
          strokeDasharray={`${arcLen} ${circumference}`}
          strokeLinecap="round"
        />
        {/* Fill */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${fillLen} ${circumference}`}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px ${glowColor})`,
            transition: 'stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: `rotate(${-rotateAngle}deg)` }}>
          <span className={cn(
            'font-black tabular-nums',
            size === 'sm' && 'text-[13px]',
            size === 'md' && 'text-lg',
            size === 'lg' && 'text-2xl',
          )} style={{ color }}>
            {score}
          </span>
          {size !== 'sm' && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/40 mt-0.5">Score</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TrustBadge
// A pill badge that displays the current trust level with appropriate icon.
// ─────────────────────────────────────────────────────────────────────────────

interface TrustBadgeProps {
  level: TrustLevel
  showIcon?: boolean
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

const TRUST_CONFIG: Record<TrustLevel, {
  label: string
  description: string
  Icon: React.ElementType
  color: string
  bg: string
  border: string
}> = {
  initial: {
    label: 'Initial',
    description: 'Just getting started',
    Icon: ShieldX,
    color: '#a1a1aa',
    bg: 'rgba(161,161,170,0.08)',
    border: 'rgba(161,161,170,0.15)',
  },
  learning: {
    label: 'Learning',
    description: 'Building understanding',
    Icon: ShieldAlert,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
  },
  adapted: {
    label: 'Adapted',
    description: 'Calibrated to your patterns',
    Icon: Shield,
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.1)',
    border: 'rgba(99,102,241,0.25)',
  },
  validated: {
    label: 'Validated',
    description: 'High confidence in your profile',
    Icon: ShieldCheck,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.2)',
  },
}

export function TrustBadge({ level, showIcon = true, showLabel = true, size = 'md', className }: TrustBadgeProps) {
  const cfg = TRUST_CONFIG[level]
  const { Icon } = cfg

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
        className,
      )}
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
    >
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      {showLabel && <span>{cfg.label}</span>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OrbPrimitive
// Animated ambient orb — the core visual identity element of the Cognitive OS.
// Pure CSS animation, no logic.
// ─────────────────────────────────────────────────────────────────────────────

interface OrbPrimitiveProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'active' | 'thinking' | 'dormant'
  pulse?: boolean
  glow?: boolean
  className?: string
}

export function OrbPrimitive({
  size = 'md',
  variant = 'default',
  pulse = true,
  glow = true,
  className,
}: OrbPrimitiveProps) {
  const dims = { xs: 24, sm: 40, md: 64, lg: 96, xl: 128 }
  const dim = dims[size]

  const variantStyles: Record<string, { core: string; glow: string; ring: string; bloom: string }> = {
    default: {
      core: 'from-primary to-primary/60',
      glow: 'bg-primary/20',
      ring: 'border-primary/25',
      bloom: '',
    },
    active: {
      core: 'from-indigo-400 to-violet-500',
      glow: 'bg-indigo-500/30',
      ring: 'border-indigo-400/30',
      bloom: 'bloom-soft',
    },
    thinking: {
      core: 'from-violet-400 to-purple-600',
      glow: 'bg-violet-500/25',
      ring: 'border-violet-400/25',
      bloom: 'bloom-soft',
    },
    dormant: {
      core: 'from-zinc-600 to-zinc-700',
      glow: 'bg-zinc-600/10',
      ring: 'border-zinc-600/15',
      bloom: '',
    },
  }

  const v = variantStyles[variant]

  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: dim, height: dim }}
    >
      {/* Outer ambient glow */}
      {glow && (
        <div
          className={cn(
            'absolute inset-0 rounded-full blur-xl',
            v.glow,
            pulse && 'animate-pulse',
          )}
          style={{ animationDuration: '4s' }}
        />
      )}
      {/* Dashed orbit ring */}
      <div
        className={cn(
          'absolute rounded-full border border-dashed animate-spin',
          v.ring,
        )}
        style={{
          width: dim * 0.9,
          height: dim * 0.9,
          animationDuration: '30s',
        }}
      />
      {/* Dotted inner ring */}
      <div
        className={cn(
          'absolute rounded-full border border-dotted animate-spin',
          v.ring,
        )}
        style={{
          width: dim * 0.75,
          height: dim * 0.75,
          animationDuration: '15s',
          animationDirection: 'reverse',
          opacity: 0.5,
        }}
      />
      {/* Core sphere */}
      <div
        className={cn(
          'relative rounded-full bg-gradient-to-tr shadow-lg flex items-center justify-center',
          v.core,
          v.bloom,
          pulse && 'animate-pulse',
        )}
        style={{
          width: dim * 0.45,
          height: dim * 0.45,
          animationDuration: '3s',
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TelemetryPill
// A compact read-only metric display used in the twin overview grid.
// ─────────────────────────────────────────────────────────────────────────────

interface TelemetryPillProps {
  label: string
  value: string | number
  unit?: string
  status?: 'normal' | 'warning' | 'critical' | 'good'
  icon?: React.ElementType
  className?: string
}

const STATUS_COLORS = {
  normal: { text: 'text-foreground/80', accent: 'bg-indigo-500/10 border-indigo-500/15' },
  good:   { text: 'text-emerald-400', accent: 'bg-emerald-500/10 border-emerald-500/15' },
  warning: { text: 'text-amber-400', accent: 'bg-amber-500/10 border-amber-500/15' },
  critical: { text: 'text-red-400', accent: 'bg-red-500/10 border-red-500/15' },
}

export function TelemetryPill({ label, value, unit, status = 'normal', icon: Icon, className }: TelemetryPillProps) {
  const s = STATUS_COLORS[status]
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border p-3', s.accent, className)}>
      {Icon && (
        <div className="w-7 h-7 rounded-xl bg-foreground/5 flex items-center justify-center flex-shrink-0">
          <Icon className={cn('w-3.5 h-3.5', s.text)} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        {/* Wraps instead of truncating: these are the product's canonical
            metric names (Cognitive Clarity, Recovery Reserve, etc.) — losing
            characters to "COGNITI…" reads as broken, not just tight. */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 leading-tight">{label}</p>
        <p className={cn('text-sm font-bold mt-0.5 truncate', s.text)}>
          {value}{unit && <span className="text-[10px] font-normal ml-0.5 opacity-60">{unit}</span>}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CognitiveStateHero
// Displays primary biological phase and live attention metrics with the Orb.
// ─────────────────────────────────────────────────────────────────────────────

interface CognitiveStateHeroProps {
  phase: string
  label: string
  attentionScore: number
  fatigueScore: number
  minutesToNextPhase: number
  chronotype: string
  twinConfidence?: number
  onActionClick?: () => void
}

export function CognitiveStateHero({
  phase,
  label,
  attentionScore,
  fatigueScore,
  minutesToNextPhase,
  chronotype,
  twinConfidence,
  onActionClick,
}: CognitiveStateHeroProps) {
  const isPeak = phase === 'PEAK_FOCUS'
  const isLinear = phase === 'LINEAR_EXECUTION'
  const isFatigue = phase === 'SYNAPTIC_FATIGUE'
  const isReduced = phase === 'REDUCED_CAPACITY_MODE'

  const phaseTitle = 
    isPeak ? 'Peak Execution Mode' : 
    isLinear ? 'Execution Momentum: Active' : 
    isFatigue ? 'Synaptic Recovery Protocol' : 
    isReduced ? 'Cognitive Friction: Elevated' : 
    'System Equilibrium'

  const phaseLabel = 
    isPeak ? 'Cognitive Clarity: Maximum' : 
    isLinear ? 'Execution Baseline: Active' : 
    isFatigue ? 'Recovery Reserve: Critical' : 
    isReduced ? 'Cognitive Friction: Elevated' : 
    'System Equilibrium'

  const phaseDesc = isPeak 
    ? 'Cognitive Clarity is at maximum efficiency. High-intensity analytical and synthesis pathways are fully clear. Prioritize critical logic blocks.' 
    : isFatigue 
      ? `Synaptic reserve depletion detected. Critical threshold reached. Recovery protocols active. Next recovery window in ${minutesToNextPhase}m.` 
      : isReduced
        ? 'Elevated cognitive friction detected. Systemic reserve safeguards are active. Focus duration is compressed.'
        : isLinear
          ? 'Sustained execution momentum detected. Linear task progression and procedural workflows are optimal now. Maintain steady throughput.'
          : 'Cognitive baseline calibrated. Adaptive performance protocols are monitoring your state in real-time.'

  const orbVariant = isPeak ? 'active' : (isFatigue || isReduced) ? 'dormant' : 'default'

  // Per-phase border + background accent for distinct visual identity
  const phaseAccentStyle = isPeak
    ? { borderColor: 'rgba(99,102,241,0.25)', background: 'linear-gradient(135deg, rgba(99,102,241,0.04) 0%, rgba(6,6,8,0.015) 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 60px rgba(99,102,241,0.08)' }
    : isFatigue
      ? { borderColor: 'rgba(245,158,11,0.22)', background: 'linear-gradient(135deg, rgba(245,158,11,0.03) 0%, rgba(6,6,8,0.015) 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 60px rgba(245,158,11,0.06)' }
      : isReduced
        ? { borderColor: 'rgba(239,68,68,0.22)', background: 'linear-gradient(135deg, rgba(239,68,68,0.03) 0%, rgba(6,6,8,0.015) 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 60px rgba(239,68,68,0.06)' }
        : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.015)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }

  const phaseColor = isPeak ? '#818cf8' : isFatigue ? '#fb923c' : isReduced ? '#ef4444' : '#34d399'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springConfig.smooth }}
      className="relative overflow-hidden rounded-3xl border p-6 md:p-10 backdrop-blur-xl"
      style={phaseAccentStyle}
    >
      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Ambient phase glow — continuous slow breathing, so the panel reads
          as a live system even between data refreshes, not just a static card */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: phaseColor }}
        animate={{ opacity: [0.06, 0.11, 0.06] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10">
        {/* Top bar: phase label + chronotype */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color: phaseColor }}>
            {phaseLabel}
          </span>
          <span className="text-[10px] text-foreground/30 font-medium capitalize tracking-wider">
            {chronotype} · updates in {minutesToNextPhase}m
          </span>
        </div>

        {/* Center: Orb + Score + Title — the hero moment */}
        <div className="flex flex-col items-center text-center gap-6 mb-10">
          <div className="relative">
            <OrbPrimitive size="xl" variant={orbVariant} pulse={true} glow={true} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-5xl md:text-7xl font-extralight tabular-nums"
                style={{ color: phaseColor, textShadow: `0 0 40px ${phaseColor}40` }}
              >
                {attentionScore}
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tight uppercase italic leading-none">
              {phaseTitle}
            </h2>
            <p className="text-sm text-foreground/40 mt-3 leading-relaxed max-w-xl mx-auto">
              {phaseDesc}
            </p>
          </div>
        </div>

        {/* Telemetry bar — full width, prominent */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <TelemetryPill label="Cognitive Clarity" value={attentionScore} unit="%" status={attentionScore >= 70 ? 'good' : attentionScore >= 50 ? 'warning' : 'critical'} icon={Brain} />
          <TelemetryPill label="Burnout Risk" value={fatigueScore} unit="%" status={fatigueScore < 40 ? 'good' : fatigueScore < 75 ? 'warning' : 'critical'} icon={Activity} />
          <TelemetryPill label="Recovery Reserve" value={100 - fatigueScore} unit="%" status={100 - fatigueScore >= 60 ? 'good' : 'warning'} icon={Battery} />
          {typeof twinConfidence === 'number' && (
            <TelemetryPill label="Twin Confidence" value={twinConfidence} unit="%" status={twinConfidence >= 70 ? 'good' : twinConfidence >= 40 ? 'warning' : 'critical'} icon={Zap} />
          )}
          <TelemetryPill label="Biological Clock" value={minutesToNextPhase} unit=" min" status="normal" icon={Clock} />
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RecommendationHero
// Actionable premium prompt showcasing a critical proposed intervention.
// ─────────────────────────────────────────────────────────────────────────────

interface RecommendationHeroProps {
  headline: string
  detail: string
  actionLabel?: string
  onActionClick?: () => void
  impact?: 'high' | 'medium' | 'low'
  estGain?: string
}

export function RecommendationHero({
  headline,
  detail,
  actionLabel = 'Acknowledge recommendation',
  onActionClick,
  impact = 'high',
  estGain,
}: RecommendationHeroProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springConfig.smooth, delay: 0.1 }}
      whileHover={{ scale: 1.012, y: -3, transition: { ...springConfig.snappy } }}
      className="relative overflow-hidden rounded-3xl border p-6 md:p-8 cursor-default group"
      style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.03) 0%, rgba(139,92,246,0.01) 100%)',
        borderColor: 'rgba(99,102,241,0.15)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 40px rgba(0,0,0,0.15)',
      }}
    >
      <div 
        className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />
      
      {/* Decorative gradient corner glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-indigo-500/15 transition-all duration-700" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-black tracking-widest uppercase text-emerald-400">
              Active Intervention Proposal
            </span>
            {impact && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                IMPACT: {impact.toUpperCase()}
              </span>
            )}
            {estGain && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                {estGain}
              </span>
            )}
          </div>

          <h3 className="text-xl md:text-2xl font-black text-foreground tracking-tight uppercase italic">
            {headline}
          </h3>

          <p className="text-xs md:text-sm text-foreground/60 mt-2.5 leading-relaxed max-w-3xl">
            {detail}
          </p>
        </div>

        <button
          onClick={onActionClick}
          className="w-full md:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-xs font-black tracking-widest uppercase text-white bg-indigo-600 hover:bg-indigo-500 transition-all duration-300 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/35 hover:scale-[1.03]"
        >
          {actionLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// InsightCard
// An interactive, standalone cognitive alert component for specific details.
// ─────────────────────────────────────────────────────────────────────────────

interface InsightCardProps {
  insight: {
    type: string
    headline: string
    detail: string
    severity: 'info' | 'warning' | 'critical'
    action?: string
  }
  onActionClick?: (action: string) => void
  className?: string
}

export function InsightCard({ insight, onActionClick, className }: InsightCardProps) {
  const SEVERITY_STYLES = {
    info: {
      border: 'border-indigo-500/20 hover:border-indigo-500/40',
      bg: 'bg-indigo-950/10 backdrop-blur-md',
      icon: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]',
      badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      glow: 'hover:shadow-[0_20px_50px_rgba(99,102,241,0.18)]',
    },
    warning: {
      border: 'border-amber-500/25 hover:border-amber-500/45',
      bg: 'bg-amber-950/10 backdrop-blur-md',
      icon: 'text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]',
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      glow: 'hover:shadow-[0_20px_50px_rgba(245,158,11,0.18)]',
    },
    critical: {
      border: 'border-red-500/30 hover:border-red-500/50',
      bg: 'bg-red-950/10 backdrop-blur-md',
      icon: 'text-red-400 bg-red-500/10 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]',
      badge: 'bg-red-500/10 text-red-400 border-red-500/20',
      glow: 'hover:shadow-[0_20px_50px_rgba(239,68,68,0.22)]',
    },
  }

  const SEVERITY_LABELS = { info: 'DETECTED', warning: 'WARNING', critical: 'CRITICAL' }
  const styles = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.info

  return (
    <div
      className={cn(
        'flex items-start gap-4 p-5 rounded-2xl border transition-all duration-500 cursor-default relative overflow-hidden',
        'group hover:scale-[1.015]',
        styles.border, styles.bg, styles.glow,
        className
      )}
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
      }}
    >
      <div 
        className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Icon */}
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 mt-0.5 transition-transform duration-500 group-hover:scale-110',
        styles.icon
      )}>
        <Brain className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1.5">
          <span className="text-[14px] font-bold text-foreground/95 truncate transition-colors group-hover:text-foreground">
            {insight.headline}
          </span>
          <span className={cn(
            'text-[8px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full border flex-shrink-0',
            styles.badge
          )}>
            {SEVERITY_LABELS[insight.severity]}
          </span>
        </div>
        <p className="text-xs text-foreground/45 leading-relaxed font-normal">{insight.detail}</p>
        {insight.action && (
          <div className="mt-3 flex">
            <button
              onClick={() => onActionClick?.(insight.action!)}
              className={cn(
                'text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full border transition-all duration-350 cursor-pointer',
                styles.badge,
                'bg-foreground/[0.02] hover:bg-foreground/[0.08]'
              )}
            >
              → {insight.action}
            </button>
          </div>
        )}
      </div>

      {/* Pulse dot for critical */}
      {insight.severity === 'critical' && (
        <div className="w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0 mt-2 shadow-[0_0_8px_#f87171] animate-pulse" />
      )}
    </div>
  )
}

