'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, RefreshCw, Clock, AlertCircle, CheckCircle2, Mic, ChevronDown, ChevronUp } from 'lucide-react';
import { FocusScoreRing } from '@/components/cognitive/focus-score-ring';
import { EnergyTimelineChart } from '@/components/cognitive/energy-timeline-chart';
import { CognitiveStateHero, RecommendationHero, InsightCard } from '@/components/cognitive/primitives';
import { BurnoutRiskMeter } from '@/components/cognitive/burnout-risk-meter';
import { ReorganizedDay } from '@/components/cognitive/reorganized-day';
import { VoiceCommandHub } from '@/components/ai/VoiceCommandHub';
import type { CognitiveEngineResponse } from '@/components/cognitive/types';
import { cn } from '@/lib/utils';
import { useCognitiveEngine } from '@/lib/cognitive-context';


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

// ── Signal Stream Component ───────────────────────────────────────────────────
function SignalStream({ insights }: { insights: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const visibleInsights = expanded ? insights : insights.slice(0, 2);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleInsights.map((insight, idx) => (
          <InsightCard
            key={idx}
            insight={insight}
            onActionClick={(action) => {
              if (action.toLowerCase().includes('break') || action.toLowerCase().includes('ambient') || action.toLowerCase().includes('music')) {
                const btn = document.querySelector('[data-slot="sidebar-menu-button"][href="/music"]');
                if (btn) (btn as HTMLButtonElement).click();
              } else {
                const btn = document.querySelector('[data-slot="sidebar-menu-button"][href="/focus"]');
                if (btn) (btn as HTMLButtonElement).click();
              }
            }}
          />
        ))}
      </div>
      {insights.length > 2 && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.15] text-[11px] font-bold text-white/60 hover:text-white transition-all"
          >
            {expanded ? (
              <>
                Show Less Signals <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                See All Signals ({insights.length}) <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CognitivePage() {
  const { bioState, chronotype, phaseOverride, setChronotype, setPhaseOverride } = useCognitiveEngine();
  const [data, setData] = useState<CognitiveEngineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);

  const isFatigue = bioState.phase === 'SYNAPTIC_FATIGUE';

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/ai/cognitive-engine', window.location.origin);
      if (phaseOverride) url.searchParams.set('phase', phaseOverride);
      if (chronotype) url.searchParams.set('chronotype', chronotype);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Engine failed to respond');
      const json: CognitiveEngineResponse = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [phaseOverride, chronotype]);

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
                COGNITIVE TWIN
              </h1>
              <p className="text-[9px] text-white/30 font-medium tracking-widest uppercase">
                Neural Operating System · Adaptive Performance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Phase Override Select */}
            <select
              value={phaseOverride || ''}
              onChange={(e) => {
                const val = e.target.value;
                setPhaseOverride(val ? (val as any) : null);
              }}
              className="text-[9px] font-black tracking-widest uppercase bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.14] rounded-xl px-3 py-2 text-white/70 hover:text-white outline-none transition-all cursor-pointer"
            >
              <option value="" className="bg-[#060608] text-white/60">AUTO PHASE</option>
              <option value="PEAK_FOCUS" className="bg-[#060608] text-indigo-400">PEAK FOCUS</option>
              <option value="LINEAR_EXECUTION" className="bg-[#060608] text-indigo-300">LINEAR WORK</option>
              <option value="SYNAPTIC_FATIGUE" className="bg-[#060608] text-amber-400">FATIGUE CYCLE</option>
              <option value="REDUCED_CAPACITY_MODE" className="bg-[#060608] text-red-400">REDUCED CAPACITY</option>
            </select>

            {/* Chronotype Select */}
            <select
              value={chronotype}
              onChange={(e) => {
                setChronotype(e.target.value as any);
              }}
              className="text-[9px] font-black tracking-widest uppercase bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.14] rounded-xl px-3 py-2 text-white/70 hover:text-white outline-none transition-all cursor-pointer"
            >
              <option value="morning" className="bg-[#060608] text-white/60">MORNING LARK</option>
              <option value="intermediate" className="bg-[#060608] text-white/60">INTERMEDIATE</option>
              <option value="evening" className="bg-[#060608] text-white/60">NIGHT OWL</option>
            </select>

            {lastRefresh && (
              <span className="hidden sm:inline text-[9px] text-white/25 font-medium">
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

              {/* Twin Identity Core */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <CognitiveStateHero
                  phase={bioState.phase}
                  label={bioState.label}
                  attentionScore={bioState.attentionScore}
                  fatigueScore={bioState.fatigueScore}
                  minutesToNextPhase={bioState.minutesToNextPhase}
                  chronotype={chronotype}
                />
              </motion.div>

              {/* Primary Directive */}
              {report.recommendation && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="space-y-4"
                >
                  
                  <RecommendationHero
                    headline={
                      bioState.phase === 'PEAK_FOCUS' ? 'Initiate Peak Work Focus Block' :
                      bioState.phase === 'SYNAPTIC_FATIGUE' ? 'Activate Cognitive Recovery Routine' :
                      'Execute Standard High-Value Routine'
                    }
                    detail={report.recommendation}
                    actionLabel={bioState.phase === 'PEAK_FOCUS' ? 'Start Focus Block →' : bioState.phase === 'SYNAPTIC_FATIGUE' ? 'Launch Ambient Player →' : 'Review Routines →'}
                    onActionClick={() => {
                      if (bioState.phase === 'PEAK_FOCUS') {
                        const btn = document.querySelector('[data-slot="sidebar-menu-button"][href="/focus"]');
                        if (btn) (btn as HTMLButtonElement).click();
                      } else if (bioState.phase === 'SYNAPTIC_FATIGUE') {
                        const btn = document.querySelector('[data-slot="sidebar-menu-button"][href="/music"]');
                        if (btn) (btn as HTMLButtonElement).click();
                      } else {
                        const btn = document.querySelector('[data-slot="sidebar-menu-button"][href="/routines"]');
                        if (btn) (btn as HTMLButtonElement).click();
                      }
                    }}
                    impact={bioState.phase === 'PEAK_FOCUS' || bioState.phase === 'SYNAPTIC_FATIGUE' ? 'high' : 'medium'}
                    estGain={bioState.phase === 'PEAK_FOCUS' ? '+35% Efficiency' : bioState.phase === 'SYNAPTIC_FATIGUE' ? '+25% Recovery' : undefined}
                  />

                  {/* Signal Stream — max 2 visible */}
                  {report.insights && report.insights.length > 0 && (
                    <SignalStream insights={report.insights} />
                  )}
                </motion.div>
              )}

              {/* Grid for Layer 3 (Why) & Layer 4 (Prediction) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Twin Vitals — left column */}
                <div className="lg:col-span-5 space-y-6">
                  <div>
                    <p className="text-[10px] font-black tracking-[0.25em] uppercase text-white/30 mb-3">Twin Vitals</p>
                    <div className="card--secondary rounded-3xl p-6 space-y-6 flex flex-col items-center [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <FocusScoreRing
                        score={report.focusScore}
                        energyLevel={report.energyLevel}
                      />
                      {report.cognitiveMemory && (
                        <div className="w-full px-4 py-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                          <p className="text-[10px] text-indigo-400/80 leading-relaxed text-center">
                            <span className="font-black uppercase tracking-widest text-[9px] block mb-1 text-indigo-300">Adaptation Confidence</span>
                            {report.cognitiveMemory}
                          </p>
                        </div>
                      )}
                      <div className="w-full border-t border-white/[0.05] pt-4">
                        <BurnoutRiskMeter
                          risk={report.burnoutRisk}
                          workloadDensity={signals.workloadDensity}
                          focusFragmentation={report.focusFragmentation}
                          overduePressure={Math.min(100, signals.overdueTasks * 15)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Time Intelligence — right column */}
                <div className="lg:col-span-7 space-y-6">
                  <div>
                    <p className="text-[10px] font-black tracking-[0.25em] uppercase text-white/30 mb-3">Time Intelligence</p>
                    <div className="card--secondary rounded-3xl p-5 relative overflow-hidden [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <EnergyTimelineChart
                        timeline={signals.energyTimeline}
                        currentHour={signals.currentHour}
                        peakStart={report.peakWindowStart}
                        peakEnd={report.peakWindowEnd}
                      />
                      {isFatigue && (
                        <div className="absolute inset-0 bg-black/85 backdrop-blur-xl z-20 flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-700">
                          <Brain className="w-8 h-8 text-amber-400/80 mb-2.5 animate-pulse" strokeWidth={1.2} />
                          <p className="text-[11px] font-bold tracking-widest text-zinc-300 uppercase">Recovery Reserve Active</p>
                          <p className="text-[10px] text-zinc-500 max-w-[280px] mt-1 leading-relaxed">
                            Execution Momentum paused. Timeline suspended during Synaptic Recovery Protocol.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {report.reorganizedDay?.length > 0 && (
                    <div className="card--secondary rounded-3xl p-5 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <ReorganizedDay tasks={report.reorganizedDay} />
                    </div>
                  )}
                </div>

              </div>

              {/* Floating Voice Trigger */}
              <div className="fixed bottom-6 right-6 z-50">
                <button
                  className="w-12 h-12 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/10 hover:bg-primary/25 hover:scale-105 transition-all duration-300"
                  title="Cognitive Voice Interface"
                  onClick={() => setIsVoiceOpen(true)}
                >
                  <Mic className="w-5 h-5 text-primary" />
                </button>
              </div>

              {/* Voice Command Popover/Drawer */}
              <AnimatePresence>
                {isVoiceOpen && (
                  <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsVoiceOpen(false)}
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 50, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 50, scale: 0.95 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="relative w-full max-w-lg bg-black/80 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 shadow-2xl overflow-hidden z-10"
                    >
                      <div className="absolute top-4 right-4">
                        <button
                          onClick={() => setIsVoiceOpen(false)}
                          className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/45 hover:text-white hover:bg-white/10 transition-all text-xs font-semibold"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="flex items-center gap-2.5 mb-5">
                        <div className="w-8 h-8 rounded-xl border border-primary/25 flex items-center justify-center bg-primary/10 shadow-[0_0_16px_rgba(99,102,241,0.15)]">
                          <Mic className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black tracking-[0.25em] uppercase text-white/35">Voice OS</p>
                          <p className="text-xs font-bold text-white/70">Cognitive Voice Interface</p>
                        </div>
                      </div>

                      <VoiceCommandHub />
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

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
