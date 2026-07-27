'use client';

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, RefreshCw, Clock, AlertCircle, ChevronDown, ChevronUp, MessageCircle, Share2, Sparkles, Zap } from 'lucide-react';
import { FocusScoreRing } from '@/components/cognitive/focus-score-ring';
import { CognitiveStateHero, RecommendationHero, InsightCard, ConfidenceGauge, TrustBadge } from '@/components/cognitive/primitives';
import { BurnoutRiskMeter } from '@/components/cognitive/burnout-risk-meter';
import { ReorganizedDay } from '@/components/cognitive/reorganized-day';
import { CognitiveGraphView } from '@/components/cognitive/cognitive-graph-view';
import { CognitiveMetricsStrip } from '@/components/cognitive/cognitive-metrics-strip';
import { ActiveModulesStrip } from '@/components/cognitive/active-modules-strip';
import { IntegratedSystemsStrip } from '@/components/cognitive/integrated-systems-strip';
import { DecisionFeed } from '@/components/cognitive/decision-feed';
import { ShareCognitiveCard } from '@/components/cognitive/share-cognitive-card';
import type { CognitiveEngineResponse } from '@/components/cognitive/types';
import { cn } from '@/lib/utils';
import { useCognitiveEngine } from '@/lib/cognitive-context';
import { springConfig } from '@/lib/design-tokens';
import { ScrollReveal } from '@/components/ui/scroll-reveal';

const EnergyTimelineChart = dynamic(
  () => import('@/components/cognitive/energy-timeline-chart').then((mod) => mod.EnergyTimelineChart),
  { ssr: false }
);


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
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/80 backdrop-blur-sm z-20">
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 animate-ping" />
        <motion.div
          className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          <Brain className="w-7 h-7 text-primary" />
        </motion.div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-black tracking-[0.3em] uppercase text-foreground/50">
          Cognitive Engine
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="text-[11px] text-foreground/30 font-medium"
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
  const router = useRouter();
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
                router.push('/music');
              } else {
                router.push('/focus');
              }
            }}
          />
        ))}
      </div>
      {insights.length > 2 && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground/[0.03] border border-foreground/[0.08] hover:bg-foreground/[0.06] hover:border-foreground/[0.15] text-[11px] font-bold text-foreground/60 hover:text-foreground transition-all"
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
  const router = useRouter();
  const { chronotype, setChronotype } = useCognitiveEngine();
  const [data, setData] = useState<CognitiveEngineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/ai/cognitive-engine', window.location.origin);
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
  }, [chronotype]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const report = data?.report;
  const signals = data?.signals;

  // Grounded in the same real Prisma-backed signals the ring/meter/timeline
  // already use — replaces a client-only sinusoidal formula (lib/cognitive-
  // engine.ts's computeBioState, still used elsewhere in the app for ambient
  // UI theming) that had zero connection to this page's actual data and
  // reset to defaults on every refresh.
  const heroPhase = report
    ? report.burnoutRisk > 60 ? 'SYNAPTIC_FATIGUE'
      : report.focusScore >= 75 ? 'PEAK_FOCUS'
      : report.focusScore >= 45 ? 'LINEAR_EXECUTION'
      : 'REDUCED_CAPACITY_MODE'
    : 'LINEAR_EXECUTION';
  const isFatigue = heroPhase === 'SYNAPTIC_FATIGUE';
  // Honest "next update" countdown (the engine's own 10-minute cache TTL)
  // instead of a fabricated "next phase" prediction with no model behind it.
  const minutesToNextUpdate = lastRefresh
    ? Math.max(0, 10 - Math.floor((Date.now() - lastRefresh.getTime()) / 60000))
    : 10;

  return (
    <div className="absolute inset-0 p-4 lg:p-6 flex flex-col bg-transparent">
      <div
        className="w-full h-full rounded-[28px] flex flex-col overflow-hidden relative liquid-glass-premium"
        style={{
          borderRadius: '28px',
        }}
      >
        {/* Ambient glow orbs — layered for depth, phase-reactive */}
        <div className="absolute top-[-15%] left-[-5%] w-[50%] h-[50%] rounded-full opacity-60 blur-[140px] pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-15%] right-[-5%] w-[45%] h-[45%] rounded-full opacity-60 blur-[120px] pointer-events-none z-0" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--primary) 12%, transparent) 0%, transparent 70%)' }} />
        <div className="absolute top-[40%] right-[20%] w-[20%] h-[20%] rounded-full opacity-30 blur-[80px] pointer-events-none z-0" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--primary) 8%, transparent) 0%, transparent 70%)' }} />

        {/* ── Header — no bar/divider, matching the chatbot's floating-
              buttons treatment (components/ai/modern-chatbot/index.tsx) ── */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl border border-primary/25 flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.1)', boxShadow: '0 0 16px rgba(99,102,241,0.15)' }}
            >
              <Brain className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-wide sm:tracking-[0.2em] uppercase text-foreground/90 whitespace-nowrap">
                COGNITIVE TWIN
              </h1>
              <p className="hidden sm:block text-[9px] text-foreground/30 font-medium tracking-widest uppercase whitespace-nowrap">
                Neural Operating System · Adaptive Performance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Chronotype Select — a real declared preference, kept. The
                "Phase Override" that used to live here was removed: it was
                visible to every real user with no gate, forced the whole
                page (client hero AND the server report) into one of four
                hardcoded fake presets, and stuck permanently via localStorage
                with no indicator it was overridden — the single biggest
                source of this page "feeling fake." */}
            <select
              value={chronotype}
              onChange={(e) => {
                setChronotype(e.target.value as any);
              }}
              className="text-[9px] font-black tracking-widest uppercase bg-foreground/[0.03] border border-foreground/[0.08] hover:border-foreground/[0.14] rounded-xl px-3 py-2 text-foreground/70 hover:text-foreground outline-none transition-all cursor-pointer"
            >
              <option value="morning_lark" className="bg-[#060608] text-foreground/60">MORNING LARK</option>
              <option value="intermediate" className="bg-[#060608] text-foreground/60">INTERMEDIATE</option>
              <option value="night_owl" className="bg-[#060608] text-foreground/60">NIGHT OWL</option>
            </select>

            {lastRefresh && (
              <span className="hidden sm:inline text-[9px] text-foreground/25 font-medium">
                Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {report && (
              <div className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border',
                data?.modelUsed === 'gemini' || data?.modelUsed === 'groq'
                  ? 'bg-green-500/5 border-green-500/15'
                  : 'bg-amber-500/5 border-amber-500/15',
              )}>
                <span className="relative flex h-2 w-2">
                  <span className={cn(
                    'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                    data?.modelUsed === 'gemini' || data?.modelUsed === 'groq' ? 'bg-green-400' : 'bg-amber-400',
                  )} />
                  <span className={cn(
                    'relative inline-flex h-2 w-2 rounded-full',
                    data?.modelUsed === 'gemini' || data?.modelUsed === 'groq' ? 'bg-green-400' : 'bg-amber-400',
                  )} />
                </span>
                <span className={cn(
                  'text-[9px] font-bold tracking-widest uppercase',
                  data?.modelUsed === 'gemini' || data?.modelUsed === 'groq' ? 'text-green-400' : 'text-amber-400',
                )}>
                  {data?.modelUsed === 'gemini' ? 'Gemini Live' : data?.modelUsed === 'groq' ? 'Groq Live' : 'Local Synthesis'}
                </span>
              </div>
            )}
            <button
              onClick={() => setIsShareOpen(true)}
              aria-label="Compartir diagnóstico"
              className="h-8 px-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/20 text-[10px] font-bold tracking-wide transition-all flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Compartir</span>
            </button>
            <button
              onClick={() => router.push('/ai')}
              aria-label="Chat con el Twin"
              className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:bg-primary/15 transition-all"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={fetchReport}
              disabled={loading}
              aria-label="Refresh cognitive report"
              className="h-8 w-8 rounded-xl bg-foreground/[0.03] border border-foreground/[0.08] flex items-center justify-center text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-all disabled:opacity-40"
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
                <p className="text-sm font-bold text-foreground/60">Engine Error</p>
                <p className="text-xs text-foreground/30 mt-1">{error}</p>
              </div>
              <button
                onClick={fetchReport}
                className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl text-xs font-bold text-primary hover:bg-primary/20 transition-all"
              >
                Retry Analysis
              </button>
            </div>
          )}

          {/* Main content — Control Panel Layout */}
          {/* pb-40 on mobile: clears GeminiLiveOrb's fixed bottom-right
              button (bottom:5rem + 56px ≈ 136px), which otherwise overlaps
              this page's last visible content — same root cause as
              PageWrapper.tsx's pb-24→pb-40 fix. */}
          {report && signals && !loading && (
            <div className="p-4 pb-40 lg:p-6 space-y-6">

              {/* ── Row 1: Hero State (full width) ─────────────────────────── */}
              <ScrollReveal>
                <CognitiveStateHero
                  phase={heroPhase}
                  label={heroPhase.replace(/_/g, ' ')}
                  attentionScore={report.focusScore}
                  fatigueScore={report.burnoutRisk}
                  minutesToNextPhase={minutesToNextUpdate}
                  chronotype={chronotype}
                  twinConfidence={data?.twin?.confidenceScore}
                />
              </ScrollReveal>

              {/* ── Row 2: Command Grid (asymmetric 3-column) ──────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                {/* Left: Twin Vitals (compact) */}
                <ScrollReveal delay={0.05} className="lg:col-span-4 space-y-5">
                  <p className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground/30">Twin Vitals</p>
                  <div className="card--secondary liquid-glass rounded-3xl p-5 space-y-5 flex flex-col items-center [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)]">
                    {/* The twin's actual, currently-learned confidence/trust
                        (process-twin-signal.ts) — previously computed and fed
                        into the AI prompt but never shown anywhere on this
                        page, so "Cognitive Twin" never displayed what the
                        twin itself had actually learned. */}
                    {data?.twin && (
                      <div className="w-full flex items-center justify-between gap-3 pb-4 border-b border-foreground/[0.05]">
                        <ConfidenceGauge score={data.twin.confidenceScore} size="sm" />
                        <div className="flex flex-col items-end gap-1.5">
                          <TrustBadge level={data.twin.trustLevel as any} size="sm" />
                          <span className="text-[8px] text-foreground/25 uppercase tracking-widest">Twin Confidence</span>
                        </div>
                      </div>
                    )}
                    <FocusScoreRing
                      score={report.focusScore}
                      energyLevel={report.energyLevel}
                    />
                    {report.cognitiveMemory && (
                      <div className="w-full px-3 py-2.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                        <p className="text-[9px] text-indigo-400/80 leading-relaxed text-center">
                          <span className="font-black uppercase tracking-widest text-[8px] block mb-1 text-indigo-300">Adaptation</span>
                          {report.cognitiveMemory}
                        </p>
                      </div>
                    )}
                    <div className="w-full border-t border-foreground/[0.05] pt-4">
                      <BurnoutRiskMeter
                        risk={report.burnoutRisk}
                        workloadDensity={signals.workloadDensity}
                        focusFragmentation={report.focusFragmentation}
                        overduePressure={Math.min(100, signals.overdueTasks * 15)}
                      />
                    </div>
                  </div>

                  {/* Signal Stream (moved here — compact sidebar) */}
                  {report.insights && report.insights.length > 0 && (
                    <SignalStream insights={report.insights} />
                  )}
                </ScrollReveal>

                {/* Center + Right: Directive + Timeline (wider) */}
                <ScrollReveal delay={0.1} className="lg:col-span-8 space-y-5">
                  {/* Primary Directive */}
                  {report.recommendation && (
                    <RecommendationHero
                      headline={
                        heroPhase === 'PEAK_FOCUS' ? 'Initiate Peak Work Focus Block' :
                        heroPhase === 'SYNAPTIC_FATIGUE' ? 'Activate Cognitive Recovery Routine' :
                        'Execute Standard High-Value Routine'
                      }
                      detail={report.recommendation}
                      actionLabel={heroPhase === 'PEAK_FOCUS' ? 'Start Focus Block →' : heroPhase === 'SYNAPTIC_FATIGUE' ? 'Launch Ambient Player →' : 'Review Routines →'}
                      onActionClick={() => {
                        if (heroPhase === 'PEAK_FOCUS') {
                          router.push('/focus');
                        } else if (heroPhase === 'SYNAPTIC_FATIGUE') {
                          router.push('/music');
                        } else {
                          router.push('/routines');
                        }
                      }}
                      impact={heroPhase === 'PEAK_FOCUS' || heroPhase === 'SYNAPTIC_FATIGUE' ? 'high' : 'medium'}
                      // No estGain — there was never a real model behind
                      // "+35% Efficiency"/"+25% Recovery", just two invented
                      // numbers keyed off the phase.
                    />
                  )}

                  {/* Time Intelligence */}
                  <div>
                    <p className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground/30 mb-3">Time Intelligence</p>
                    <div className="card--secondary liquid-glass rounded-3xl p-5 relative overflow-hidden [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)]">
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

                  {/* Reorganized Day */}
                  {report.reorganizedDay?.length > 0 && (
                    <div className="card--secondary liquid-glass rounded-3xl p-5 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <ReorganizedDay tasks={report.reorganizedDay} />
                    </div>
                  )}
                </ScrollReveal>

              </div>

              {/* ── Row 2.5: Cognitive Metrics trend strip ──────────────────
                  Real daily trend (TwinSnapshot) for the metrics the gauges
                  above only show "now" — adds the historical dimension the
                  mockup calls for, without fabricating any number. */}
              <ScrollReveal delay={0.12}>
                <CognitiveMetricsStrip
                  cognitiveLoad={report.cognitiveLoad ?? null}
                  recoveryReserve={report.burnoutRisk != null ? Math.round(100 - report.burnoutRisk) : null}
                  confidence={data?.twin?.confidenceScore ?? null}
                />
              </ScrollReveal>

              {/* ── Row 3: Cognitive Graph (full width, premium tier) ──────────
                  A derived view over the twin's existing data (identity/
                  energy/bottlenecks/signals), not a new storage model — see
                  lib/cognitive-graph.ts. Full-width + premium glass on
                  purpose: this is the visual centerpiece that answers "what
                  makes this different from a task list," not another
                  secondary-column card. */}
              <ScrollReveal delay={0.15}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-8">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Brain className="w-3.5 h-3.5 text-indigo-400" />
                        <p className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground/50">Mapa Cognitivo</p>
                      </div>
                      <p className="text-[9px] text-foreground/25 uppercase tracking-widest">Arrastra los nodos</p>
                    </div>
                    <div className="liquid-glass-premium rounded-3xl p-2 h-[480px] border border-indigo-500/15 [box-shadow:0_0_60px_-15px_rgba(99,102,241,0.25),inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <CognitiveGraphView />
                    </div>
                  </div>

                  {/* Bitácora — why the graph just pulsed, sourced straight
                      from TwinEvolutionLog. Sits beside the graph on purpose:
                      the map + the reasoning behind it is the actual "AI-Native
                      Ops" proof, not two disconnected widgets. */}
                  <div className="lg:col-span-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <p className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground/50">Bitácora del Twin</p>
                    </div>
                    <div className="liquid-glass-premium rounded-3xl p-4 h-[480px] border border-indigo-500/15 [box-shadow:0_0_60px_-15px_rgba(99,102,241,0.25),inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <DecisionFeed />
                    </div>
                  </div>
                </div>
              </ScrollReveal>

              {/* ── Row 4: Active Modules + Integrated Systems ─────────────── */}
              <ScrollReveal delay={0.18}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-7">
                    <ActiveModulesStrip />
                  </div>
                  <div className="lg:col-span-5">
                    <IntegratedSystemsStrip />
                  </div>
                </div>
              </ScrollReveal>

              {/* Footer — real attribution, not a static "Powered by Gemini"
                  claim regardless of which provider (or the local fallback)
                  actually generated this report. */}
              <div className="flex items-center justify-center gap-2 pb-2">
                <Clock className="w-3 h-3 text-foreground/15" />
                <span className="text-[9px] text-foreground/15 font-medium">
                  {data.modelUsed === 'gemini' ? 'Powered by Gemini' : data.modelUsed === 'groq' ? 'Powered by Groq' : 'Local Cognitive Synthesis'}
                  {' '}· Adaptive Cognitive Operating System · {data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : '—'}
                </span>
              </div>

            </div>
          )}
        </div>
      </div>
      <ShareCognitiveCard
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        twinScore={data?.twin?.confidenceScore ?? (report?.focusScore ?? 88)}
        trustLevel={data?.twin?.trustLevel ?? 'high'}
        chronotype={chronotype === 'night_owl' ? 'Búho Nocturno' : chronotype === 'morning_lark' ? 'Foco Matutino' : 'Intermedio'}
        peakWindow={report ? `${report.peakWindowStart}:00 - ${report.peakWindowEnd}:00` : '20:00 - 23:00'}
        cognitiveLoad={report?.cognitiveLoad ?? 35}
        burnoutRisk={report?.burnoutRisk ?? 12}
      />
    </div>
  );
}
