'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, RefreshCw, Zap, Clock, AlertCircle, CheckCircle2, Sparkles, Mic } from 'lucide-react';
import { FocusScoreRing } from '@/components/cognitive/focus-score-ring';
import { EnergyTimelineChart } from '@/components/cognitive/energy-timeline-chart';
import { CognitiveInsights } from '@/components/cognitive/cognitive-insights';
import { BurnoutRiskMeter } from '@/components/cognitive/burnout-risk-meter';
import { ReorganizedDay } from '@/components/cognitive/reorganized-day';
import { VoiceCommandHub } from '@/components/ai/VoiceCommandHub';
import type { CognitiveEngineResponse } from '@/components/cognitive/types';
import { cn } from '@/lib/utils';
import { useCognitiveEngine } from '@/lib/cognitive-context';

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, sub, color = '#6366f1' }: {
  label: string; value: number | string; unit?: string; sub?: string; color?: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -2 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-1.5 px-4 py-3.5 rounded-2xl border border-white/[0.07] hover:border-white/[0.14] transition-all duration-400 cursor-default group"
      style={{
        background: 'rgba(255,255,255,0.015)',
        backdropFilter: 'blur(12px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.2)',
      }}
    >
      <span className="text-[9px] font-black tracking-[0.25em] uppercase text-white/30 group-hover:text-white/45 transition-colors">{label}</span>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-black tabular-nums leading-none" style={{ color, textShadow: `0 0 16px ${color}60` }}>{value}</span>
        {unit && <span className="text-[10px] text-white/30 font-bold mb-0.5">{unit}</span>}
      </div>
      {sub && <span className="text-[9px] text-white/20 font-medium mt-0.5">{sub}</span>}
    </motion.div>
  );
}

// ── Loading state ────────────────────────────────────────────────────────────
function CognitiveLoader() {
  const steps = [
    'Scanning task patterns…',
    'Analyzing focus sessions…',
    'Computing circadian model…',
    'Estimating recovery state…',
    'Generating cognitive report…',
  ];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setStep(s => (s + 1) % steps.length), 900);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-[#060608]/80 backdrop-blur-sm z-20">
      <motion.div
        className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      >
        <Brain className="w-7 h-7 text-primary" />
      </motion.div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-black tracking-[0.3em] uppercase text-white/50">
          Cognitive Engine
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="text-[11px] text-white/30 font-medium"
          >
            {steps[step]}
          </motion.span>
        </AnimatePresence>
      </div>
      {/* Progress dots */}
      <div className="flex gap-1.5">
        {steps.map((_, i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            animate={{ backgroundColor: i === step ? '#6366f1' : 'rgba(255,255,255,0.1)' }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CognitivePage() {
  const { bioState } = useCognitiveEngine();
  const [data, setData] = useState<CognitiveEngineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const isFatigue = bioState.phase === 'SYNAPTIC_FATIGUE';

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/cognitive-engine');
      if (!res.ok) throw new Error('Engine failed to respond');
      const json: CognitiveEngineResponse = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const report = data?.report;
  const signals = data?.signals;

  return (
    <div className="absolute inset-0 p-4 lg:p-6 flex flex-col bg-transparent">
      <div
        className="w-full h-full rounded-[2rem] flex flex-col overflow-hidden relative"
        style={{
          background: 'rgba(6,6,8,0.92)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(48px) saturate(160%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 40px 120px rgba(0,0,0,0.6)',
        }}
      >
        {/* Ambient glow orbs — layered for depth */}
        <div className="absolute top-[-15%] left-[-5%] w-[50%] h-[50%] rounded-full opacity-60 blur-[140px] pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-15%] right-[-5%] w-[45%] h-[45%] rounded-full opacity-50 blur-[120px] pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)' }} />
        <div className="absolute top-[40%] right-[20%] w-[20%] h-[20%] rounded-full opacity-30 blur-[80px] pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)' }} />

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b z-10"
          style={{
            borderColor: 'rgba(255,255,255,0.06)',
            background: 'rgba(6,6,8,0.7)',
            backdropFilter: 'blur(24px)',
            boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.03)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl border border-primary/25 flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.1)', boxShadow: '0 0 16px rgba(99,102,241,0.15)' }}
            >
              <Brain className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-[0.2em] uppercase text-white/90">
                AI Cognitive Engine
              </h1>
              <p className="text-[9px] text-white/30 font-medium tracking-widest uppercase">
                Adaptive Performance Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-[9px] text-white/25 font-medium">
                Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {report && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-green-500/5 border border-green-500/15">
                <CheckCircle2 className="w-3 h-3 text-green-400" />
                <span className="text-[9px] font-bold text-green-400 tracking-widest uppercase">Live</span>
              </div>
            )}
            <button
              onClick={fetchReport}
              disabled={loading}
              className="h-8 w-8 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-40"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative z-10 min-h-0">

          {/* Loading overlay */}
          {loading && <CognitiveLoader />}

          {/* Error state */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
              <AlertCircle className="w-10 h-10 text-red-400/60" />
              <div className="text-center">
                <p className="text-sm font-bold text-white/60">Engine Error</p>
                <p className="text-xs text-white/30 mt-1">{error}</p>
              </div>
              <button
                onClick={fetchReport}
                className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl text-xs font-bold text-primary hover:bg-primary/20 transition-all"
              >
                Retry Analysis
              </button>
            </div>
          )}

          {/* Main content */}
          {report && signals && !loading && (
            <div className="p-4 lg:p-6 space-y-6">

              {/* ── Row 1: Hero Focus Score + Stat Cards ──────────────────── */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col lg:flex-row gap-6 items-start"
              >
                {/* Focus Score Ring */}
                <div className="flex flex-col items-center gap-4 flex-shrink-0">
                  <FocusScoreRing
                    score={report.focusScore}
                    energyLevel={report.energyLevel}
                  />
                  {/* Cognitive Memory badge */}
                  {report.cognitiveMemory && (
                    <div className="max-w-[220px] px-3 py-2 bg-indigo-500/5 border border-indigo-500/15 rounded-xl">
                      <p className="text-[9px] text-indigo-400/70 text-center leading-relaxed">
                        <span className="font-black">MEMORY · </span>{report.cognitiveMemory}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right: Stats grid + Recommendation */}
                <div className="flex-1 space-y-4">
                  {/* Stat cards grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <StatCard
                      label="Cognitive Load"
                      value={report.cognitiveLoad}
                      unit="%"
                      sub="mental capacity used"
                      color={report.cognitiveLoad > 70 ? '#ef4444' : report.cognitiveLoad > 40 ? '#f59e0b' : '#22c55e'}
                    />
                    <StatCard
                      label="Burnout Risk"
                      value={report.burnoutRisk}
                      unit="%"
                      sub="workload pressure"
                      color={report.burnoutRisk > 70 ? '#ef4444' : report.burnoutRisk > 40 ? '#f59e0b' : '#22c55e'}
                    />
                    <StatCard
                      label="Focus Minutes"
                      value={signals.totalFocusMinutesToday}
                      unit="min"
                      sub="deep work today"
                      color="#6366f1"
                    />
                    <StatCard
                      label="Overdue Tasks"
                      value={signals.overdueTasks}
                      sub={`${signals.completionRate}% completion rate`}
                      color={signals.overdueTasks > 3 ? '#ef4444' : signals.overdueTasks > 0 ? '#f59e0b' : '#22c55e'}
                    />
                  </div>

                  {/* Recovery state */}
                  <div className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-2xl border',
                    report.recoveryState === 'optimal' ? 'bg-green-500/5 border-green-500/15' :
                    report.recoveryState === 'moderate' ? 'bg-amber-500/5 border-amber-500/15' :
                    'bg-red-500/5 border-red-500/15'
                  )}>
                    <div className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center border',
                      report.recoveryState === 'optimal' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                      report.recoveryState === 'moderate' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                      'bg-red-500/10 border-red-500/20 text-red-400'
                    )}>
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] font-black tracking-[0.2em] uppercase text-white/40">
                        Estimated Recovery State
                      </p>
                      <p className="text-sm font-bold text-white/80 capitalize mt-0.5">
                        {report.recoveryState === 'optimal' ? 'Fully Recovered — Peak performance capacity' :
                         report.recoveryState === 'moderate' ? 'Moderate Recovery — Some fatigue detected' :
                         report.recoveryState === 'impaired' ? 'Impaired Recovery — Elevated fatigue signals' :
                         'Critical — Recovery deficit detected'}
                      </p>
                    </div>
                  </div>

                  {/* Recommendation */}
                  {report.recommendation && (
                    <div className="flex items-start gap-3 px-4 py-3 bg-primary/5 border border-primary/15 rounded-2xl">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black tracking-[0.2em] uppercase text-primary/60 mb-1">
                          AI Recommendation · Now
                        </p>
                        <p className="text-sm text-white/75 font-medium leading-relaxed">
                          {report.recommendation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* ── Row 2: Energy Timeline ─────────────────────────────────── */}
              <div
                className="rounded-2xl p-5 border border-white/[0.07] hover:border-white/[0.11] transition-colors duration-400 relative overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.015)', backdropFilter: 'blur(12px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
              >
                <EnergyTimelineChart
                  timeline={signals.energyTimeline}
                  currentHour={signals.currentHour}
                  peakStart={report.peakWindowStart}
                  peakEnd={report.peakWindowEnd}
                />
                {isFatigue && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-xl z-20 flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-700">
                    <Brain className="w-8 h-8 text-amber-400/80 mb-2.5 animate-pulse" strokeWidth={1.2} />
                    <p className="text-[11px] font-bold tracking-widest text-zinc-300 uppercase">Energy Timeline Suspended</p>
                    <p className="text-[10px] text-zinc-500 max-w-[280px] mt-1 leading-relaxed">
                      Circadian chart collapsed to minimize visual clutter during critical fatigue recovery.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Row 3: Insights + Burnout (2 col) ─────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div
                  className="rounded-2xl p-5 border border-white/[0.07] hover:border-white/[0.11] transition-all duration-400"
                  style={{ background: 'rgba(255,255,255,0.015)', backdropFilter: 'blur(12px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
                >
                  <CognitiveInsights insights={report.insights} />
                </div>
                <div
                  className="rounded-2xl p-5 border border-white/[0.07] hover:border-white/[0.11] transition-all duration-400 relative overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.015)', backdropFilter: 'blur(12px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
                >
                  <BurnoutRiskMeter
                    risk={report.burnoutRisk}
                    workloadDensity={signals.workloadDensity}
                    focusFragmentation={report.focusFragmentation}
                    overduePressure={Math.min(100, signals.overdueTasks * 15)}
                  />
                  {isFatigue && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-xl z-20 flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-700">
                      <Brain className="w-8 h-8 text-amber-400/80 mb-2.5 animate-pulse" strokeWidth={1.2} />
                      <p className="text-[11px] font-bold tracking-widest text-zinc-300 uppercase">Focus Lock Active</p>
                      <p className="text-[10px] text-zinc-500 max-w-[200px] mt-1 leading-relaxed">
                        Secondary metrics collapsed to eliminate fatigue and cognitive distraction.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Row 4: Reorganized Day ──────────────────────────────────── */}
              {report.reorganizedDay?.length > 0 && (
                <div
                  className="rounded-2xl p-5 border border-white/[0.07] hover:border-white/[0.11] transition-all duration-400"
                  style={{ background: 'rgba(255,255,255,0.015)', backdropFilter: 'blur(12px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
                >
                  <ReorganizedDay tasks={report.reorganizedDay} />
                </div>
              )}

              {/* ── Row 5: Voice Command Hub ────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="rounded-2xl p-5 border border-white/[0.07] hover:border-white/[0.11] transition-all duration-400 relative overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.015)', backdropFilter: 'blur(12px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
              >
                {/* Ambient voice glow */}
                <div
                  className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-15 blur-3xl pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.5) 0%, transparent 70%)' }}
                />

                <div className="flex items-center gap-2.5 mb-5 relative z-10">
                  <div
                    className="w-8 h-8 rounded-xl border border-primary/25 flex items-center justify-center"
                    style={{ background: 'rgba(99,102,241,0.1)', boxShadow: '0 0 16px rgba(99,102,241,0.15)' }}
                  >
                    <Mic className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black tracking-[0.25em] uppercase text-white/35">Voice OS</p>
                    <p className="text-xs font-bold text-white/70">Cognitive Voice Interface</p>
                  </div>
                </div>

                <VoiceCommandHub className="relative z-10" />
              </motion.div>

              {/* Footer */}
              <div className="flex items-center justify-center gap-2 pb-2">
                <Clock className="w-3 h-3 text-white/15" />
                <span className="text-[9px] text-white/15 font-medium">
                  Powered by Gemini · Adaptive Cognitive Operating System · {data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : '—'}
                </span>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
