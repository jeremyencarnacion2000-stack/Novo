'use client';

/**
 * ContextHub.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Premium Apple-Level Spatial Interface Component for Novo Heritage.
 *
 * Implements high-end glassmorphic physics, thin-line vector clock weights,
 * monospaced typography hierarchy, sculpted buttons, breathing radial aura
 * gradients, and real sunken card depth styling.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { usePlayerStore } from '@/lib/player-store';
import { useSettings } from '@/lib/settings-context';
import { useFocus } from '@/lib/focus-context';
import { useScrollContainer } from '@/lib/scroll-container-context';
import { useCognitiveState, useCognitiveDispatch } from '@/lib/cognitive-context';
import type { CognitivePhase } from '@/lib/cognitive-engine';
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  Sun, Moon, Music, CloudSun, Cloud, CloudRain, Zap,
  Brain, X
} from 'lucide-react';
import { NovoSkeleton } from "@/components/ui/NovoSkeleton";
import { NovoEmptyState } from "@/components/ui/NovoEmptyState";
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springConfig } from '@/lib/design-tokens';

// ─── Cognitive phase accent colors (High HSL precision) ──────────────────────
const PHASE_COLOR: Record<CognitivePhase, string> = {
  PEAK_FOCUS:       '#818cf8', // light indigo
  LINEAR_EXECUTION: '#34d399', // light emerald
  SYNAPTIC_FATIGUE: '#fb923c', // light amber
  REDUCED_CAPACITY_MODE: '#f59e0b', // warm amber
};
const PHASE_LABEL: Record<CognitivePhase, string> = {
  PEAK_FOCUS:       'FOCUS',
  LINEAR_EXECUTION: 'LINEAR',
  SYNAPTIC_FATIGUE: 'REST',
  REDUCED_CAPACITY_MODE: 'STRESS',
};

// ─── Types ───────────────────────────────────────────────────────────────────
type HubState = 'idle' | 'capsule' | 'expanded';
type WeatherIcon = 'sun' | 'cloud-sun' | 'cloud' | 'cloud-rain' | 'zap';

// ─── Weather icon map (Thin-Line Custom SVGs with stroke-width: 1.2) ──────────
function getWeatherIcon(type: WeatherIcon) {
  const strokeCls = "w-4 h-4 stroke-[1.2]";
  switch (type) {
    case 'sun': 
      return <Sun className={cn(strokeCls, "text-amber-300/80")} strokeWidth={1.2} />;
    case 'cloud-sun': 
      return <CloudSun className={cn(strokeCls, "text-zinc-400")} strokeWidth={1.2} />;
    case 'cloud': 
      return <Cloud className={cn(strokeCls, "text-zinc-500")} strokeWidth={1.2} />;
    case 'cloud-rain': 
      return <CloudRain className={cn(strokeCls, "text-blue-400/80")} strokeWidth={1.2} />;
    case 'zap': 
      return <Zap className={cn(strokeCls, "text-yellow-400/80")} strokeWidth={1.2} />;
  }
}

/**
 * Returns a contextual icon based on the hour of the day.
 *
 * ⚠️  This is NOT real weather data — it's a time-of-day simulation.
 * To show real weather, replace this with a call to a weather API
 * (e.g. Open-Meteo, OpenWeatherMap) and store the result in state.
 */
function getContextualWeather(hour: number): WeatherIcon {
  if (hour >= 6 && hour < 12) return 'cloud-sun';
  if (hour >= 12 && hour < 17) return 'sun';
  if (hour >= 17 && hour < 20) return 'cloud-sun';
  return 'cloud';
}

// ─── Analog Clock SVG (Ultra-thin lines & elegant aesthetic with cognitive capacity outer ring) ─────────────────
function AnalogClock({ time, attentionScore }: { time: Date | null; attentionScore: number }) {
  const secDeg = time ? (time.getSeconds() / 60) * 360 : 0;
  const minDeg = time ? (time.getMinutes() / 60) * 360 + (time.getSeconds() / 60) * 6 : 0;
  const hrDeg = time ? ((time.getHours() % 12) / 12) * 360 + (time.getMinutes() / 60) * 30 : 0;

  // Outer ring parameters
  const radius = 21;
  const circumference = 2 * Math.PI * radius; // ~131.95
  const strokeDashoffset = circumference - (attentionScore / 100) * circumference;

  // Fluid transition color: emerald (#4ADE80) if high capacity, amber/orange (#FBBF24) if fatigue/moderate
  const strokeColor = attentionScore > 50 ? '#4ADE80' : '#FBBF24';

  return (
    <svg viewBox="0 0 44 44" className="w-10 h-10" strokeLinecap="round">
      {/* Background track circle */}
      <circle cx="22" cy="22" r="21" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.8" />
      
      {/* Dynamic Cognitive Capacity Outer Arc */}
      <circle
        cx="22"
        cy="22"
        r="21"
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.2"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        transform="rotate(-90 22 22)"
        opacity={0.8}
        className="transition-all duration-1000 ease-in-out"
        style={{ transitionProperty: 'stroke-dashoffset, stroke' }}
      />

      <circle cx="22" cy="22" r="19.5" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.6" />
      {[...Array(12)].map((_, i) => {
        const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
        const r = 16.5;
        const x1 = 22 + r * Math.cos(angle);
        const y1 = 22 + r * Math.sin(angle);
        const x2 = 22 + (r - (i % 3 === 0 ? 2.5 : 1.5)) * Math.cos(angle);
        const y2 = 22 + (r - (i % 3 === 0 ? 2.5 : 1.5)) * Math.sin(angle);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.15)" strokeWidth={i % 3 === 0 ? 0.7 : 0.4} />;
      })}
      {/* Hour hand */}
      <line
        x1="22" y1="22"
        x2={22 + 8 * Math.sin((hrDeg * Math.PI) / 180)}
        y2={22 - 8 * Math.cos((hrDeg * Math.PI) / 180)}
        stroke="rgba(255,255,255,0.9)" strokeWidth="1.0"
      />
      {/* Minute hand */}
      <line
        x1="22" y1="22"
        x2={22 + 12 * Math.sin((minDeg * Math.PI) / 180)}
        y2={22 - 12 * Math.cos((minDeg * Math.PI) / 180)}
        stroke="rgba(255,255,255,0.5)" strokeWidth="0.7"
      />
      {/* Second hand */}
      <line
        x1="22" y1="22"
        x2={22 + 14 * Math.sin((secDeg * Math.PI) / 180)}
        y2={22 - 14 * Math.cos((secDeg * Math.PI) / 180)}
        stroke="#818cf8" strokeWidth="0.4"
        style={{ transition: 'all 0.15s linear' }}
      />
      <circle cx="22" cy="22" r="1.0" fill="#818cf8" />
    </svg>
  );
}

// ─── YouTube Playlist Panel (Sculpted glassmorphism tabs & breathing graphics) ───
interface YTData {
  channel?: { title: string; thumbnailUrl?: string };
  playlists?: Array<{ id: string; title: string; thumbnailUrl?: string; itemCount: number }>;
  likedTracks?: Array<{ id: string; title: string; channelTitle: string; thumbnailUrl?: string }>;
}

function PlaylistPanel() {
  const [data, setData] = useState<YTData>({});
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState<'playlists' | 'liked'>('playlists');
  const { currentTrack, isPlaying, togglePlayPause, nextTrack, previousTrack } = usePlayerStore();

  useEffect(() => {
    fetch('/api/youtube/account')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Now Playing Bar — triggers lazy YouTube API load on first interaction */}
      {currentTrack && (
        <div
          className="flex items-center gap-2.5 bg-zinc-900/40 backdrop-blur-xl border border-white/5 shadow-inner rounded-2xl p-2.5"
          onMouseEnter={() => window.dispatchEvent(new Event('youtube:load-api'))}
        >
          {currentTrack.image && (
            <img src={currentTrack.image} className="w-9 h-9 rounded-xl object-cover flex-shrink-0 opacity-80" alt="" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white/90 truncate">{currentTrack.name}</p>
            <p className="text-[10px] text-zinc-500 font-mono tracking-tighter truncate mt-0.5">{currentTrack.artist}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={previousTrack}
              aria-label="Previous track"
              className="p-1 rounded-lg hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-1 focus-visible:ring-offset-black/80"
            >
              <SkipBack aria-hidden="true" className="w-3.5 h-3.5 text-zinc-500 hover:text-white" strokeWidth={1.2} />
            </button>
            <button
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={() => {
                window.dispatchEvent(new Event('youtube:load-api'))
                togglePlayPause()
              }}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-1 focus-visible:ring-offset-black/80"
            >
              {isPlaying ? (
                <Pause aria-hidden="true" className="w-3 h-3 text-white" strokeWidth={1.2} />
              ) : (
                <Play aria-hidden="true" className="w-3 h-3 text-white translate-x-[0.5px]" strokeWidth={1.2} />
              )}
            </button>
            <button
              onClick={nextTrack}
              aria-label="Next track"
              className="p-1 rounded-lg hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-1 focus-visible:ring-offset-black/80"
            >
              <SkipForward aria-hidden="true" className="w-3.5 h-3.5 text-zinc-500 hover:text-white" strokeWidth={1.2} />
            </button>
          </div>
        </div>
      )}

      {/* Tab Switcher — startTransition keeps INP < 50ms by yielding to browser before re-render */}
      <div className="flex bg-black/30 rounded-xl p-1 border border-white/5 shadow-inner gap-0.5">
        {(['playlists', 'liked'] as const).map(tab => (
          <button
            key={tab}
            aria-pressed={activeList === tab}
            aria-label={tab === 'playlists' ? 'Show playlists' : 'Show liked tracks'}
            onClick={() => startTransition(() => setActiveList(tab))}
            className={cn(
              'flex-1 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
              activeList === tab 
                ? 'bg-white/5 backdrop-blur-md text-white border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]' 
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {tab === 'playlists' ? 'Playlists' : 'Liked'}
          </button>
        ))}
      </div>

      {/* Scrollable Content list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-hide pr-0.5 min-h-[160px] relative" data-lenis-prevent>
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="playlist-skeletons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2.5 p-2 rounded-xl">
                <NovoSkeleton variant="rect" className="w-8 h-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <NovoSkeleton variant="rect" className="h-3 w-3/4 rounded" />
                  <NovoSkeleton variant="rect" className="h-2 w-1/3 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2 rounded-xl">
                <NovoSkeleton variant="rect" className="w-8 h-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <NovoSkeleton variant="rect" className="h-3 w-1/2 rounded" />
                  <NovoSkeleton variant="rect" className="h-2 w-1/4 rounded" />
                </div>
              </div>
            </motion.div>
          ) : (activeList === 'playlists' ? (data.playlists || []) : (data.likedTracks || [])).length > 0 ? (
            <motion.div
              key="playlist-items"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-1.5"
            >
              {activeList === 'playlists' ? (
                (data.playlists || []).map(pl => (
                  <div key={pl.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] active:bg-white/[0.06] cursor-pointer transition-all group border border-transparent hover:border-white/5">
                    {pl.thumbnailUrl ? (
                      <img src={pl.thumbnailUrl} className="w-8 h-8 rounded-lg object-cover flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                        <Music className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.2} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-zinc-300 truncate group-hover:text-white transition-colors">{pl.title}</p>
                      <p className="text-[9px] text-zinc-500 font-mono tracking-tighter mt-0.5">{pl.itemCount} TRACKS</p>
                    </div>
                  </div>
                ))
              ) : (
                (data.likedTracks || []).slice(0, 15).map(t => (
                  <div key={t.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] active:bg-white/[0.06] cursor-pointer transition-all group border border-transparent hover:border-white/5">
                    {t.thumbnailUrl ? (
                      <img src={t.thumbnailUrl} className="w-8 h-8 rounded-lg object-cover flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                        <Music className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.2} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-zinc-300 truncate group-hover:text-white transition-colors">{t.title}</p>
                      <p className="text-[9px] text-zinc-500 font-mono tracking-tighter mt-0.5 truncate">{t.channelTitle}</p>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          ) : (
            <NovoEmptyState
              key="playlist-empty"
              message="Silence is preparation. Speak or tap to initialize focus frequencies."
              actionLabel="Quick Focus"
              onAction={() => window.dispatchEvent(new CustomEvent('cognitive:start-breathing'))}
              className="py-6 min-h-[140px] w-full"
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Clock and Weather Section Sub-component (Self-updating for render isolation) ───
function ClockSection({
  attentionScore,
  showDetails = false,
  children
}: {
  attentionScore: number;
  showDetails?: boolean;
  children?: React.ReactNode;
}) {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!time) {
    return (
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-white/5 rounded-full" />
    );
  }

  const formattedTime = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const weatherIcon = getContextualWeather(time.getHours());

  if (showDetails) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="scale-[0.72] origin-center opacity-80">
          <AnalogClock time={time} attentionScore={attentionScore} />
        </div>
        <div>
          <p className="text-[11px] font-bold text-white/95 leading-none">{formattedTime}</p>
          <p className="text-[9px] text-zinc-500 font-mono tracking-tighter mt-1 flex items-center gap-1.5">
            {getWeatherIcon(weatherIcon)}
            <span>{time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </p>
          {children}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-center scale-[0.72] origin-center opacity-90">
        <AnalogClock time={time} attentionScore={attentionScore} />
      </div>

      <p className="text-[10px] font-mono font-medium text-zinc-500 tracking-tighter leading-none">{formattedTime}</p>
      
      <div className="w-6 h-px bg-white/10 my-0.5" />
      
      {getWeatherIcon(weatherIcon)}
    </>
  );
}

// ─── Capsule Content Sub-component ──────────────────────────────────────────
function CapsuleContent({
  cognitiveAlert,
  dopaminePulse,
  springY,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleClick,
}: {
  cognitiveAlert: boolean;
  dopaminePulse: boolean;
  springY: any;
  handlePointerDown: (e: React.PointerEvent) => void;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: (e: React.PointerEvent) => void;
  handleClick: (e: React.MouseEvent) => void;
}) {
  const { bioState } = useCognitiveState();
  return (
    <motion.div
      key="hub-capsule"
      layoutId="context-hub-shape"
      className={cn(
        "flex flex-col items-center justify-between py-4 px-2 rounded-full select-none cursor-pointer border shadow-[0_16px_48px_rgba(0,0,0,0.7)] backdrop-blur-2xl pointer-events-auto relative overflow-hidden transition-colors duration-300",
        cognitiveAlert
          ? 'bg-gradient-to-b from-indigo-950/70 to-zinc-950/70 border-indigo-500/40'
          : 'bg-black/90 border-white/10 hover:border-white/20',
        dopaminePulse && "animate-dopamine-pulse"
      )}
      style={{
        width: '46px',
        height: '190px',
        marginRight: '0px',
        y: springY,
        touchAction: 'none',
      }}
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={springConfig.smooth}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
    >
      <ClockSection attentionScore={bioState.attentionScore} showDetails={false} />

      <div
        className="px-2 py-1 rounded-full text-[8px] font-bold tracking-widest uppercase bg-white/5 backdrop-blur-md text-white/60 border border-white/5 flex-shrink-0 text-center leading-none"
      >
        {PHASE_LABEL[bioState.phase]}
      </div>

      {cognitiveAlert && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ border: `1.5px solid ${PHASE_COLOR[bioState.phase]}50` }}
          animate={{ opacity: [1, 0, 1, 0] }}
          transition={{ duration: 1.2, repeat: 2 }}
        />
      )}
    </motion.div>
  );
}

// ─── Expanded Content Sub-component ─────────────────────────────────────────
function ExpandedContent({
  dopaminePulse,
  springY,
  setHubState,
  activeTab,
  setActiveTab,
}: {
  dopaminePulse: boolean;
  springY: any;
  setHubState: React.Dispatch<React.SetStateAction<HubState>>;
  activeTab: 'music' | 'controls';
  setActiveTab: React.Dispatch<React.SetStateAction<'music' | 'controls'>>;
}) {
  // ── Real settings connections ──────────────────────────────────────────────
  const { settings, updateSettings } = useSettings();
  const { isActive: focusTimerActive, toggleTimer } = useFocus();
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const { bioState } = useCognitiveState();
  return (
    <motion.div
      key="hub-expanded"
      layoutId="context-hub-shape"
      className={cn(
        "rounded-[24px] border border-white/10 bg-black/95 backdrop-blur-3xl p-4 cursor-default pointer-events-auto relative overflow-hidden flex flex-col",
        dopaminePulse && "animate-dopamine-pulse"
      )}
      style={{
        width: '360px',
        height: '310px',
        y: springY,
        boxShadow: '0 32px 64px rgba(0,0,0,0.8), inset 0 0 24px rgba(255, 255, 255, 0.02), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
      initial={false}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95, x: 10, transition: { duration: 0.18 } }}
      transition={springConfig.smooth}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 pt-1 pb-2.5 border-b border-white/[0.06] mb-2.5 flex-shrink-0">
        <ClockSection attentionScore={bioState.attentionScore} showDetails={true}>
          {/* Cognitive telemetry progress */}
          <div className="flex items-center gap-1.5 mt-2">
            <Brain className="w-2.5 h-2.5" style={{ color: PHASE_COLOR[bioState.phase] }} />
            <div className="flex-1 h-0.5 bg-white/5 rounded-full overflow-hidden w-16">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${bioState.attentionScore}%`,
                  background: `linear-gradient(90deg, ${PHASE_COLOR[bioState.phase]}, ${PHASE_COLOR[bioState.phase]}88)`,
                }}
              />
            </div>
            <span className="text-[8px] font-mono tracking-tighter text-zinc-400 tabular-nums">
              {bioState.attentionScore}%
            </span>
          </div>
        </ClockSection>
        <button
          aria-label="Collapse hub"
          onClick={() => startTransition(() => setHubState('capsule'))}
          className="p-1.5 rounded-xl hover:bg-white/5 text-zinc-500 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <X aria-hidden="true" className="w-3.5 h-3.5" />
        </button>
      </div>

      {bioState.phase === 'REDUCED_CAPACITY_MODE' && (
        <div className="mx-2 mb-2 p-2.5 rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-300 flex items-center justify-between gap-2 shadow-[0_8px_20px_rgba(245,158,11,0.15)] animate-pulse flex-shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.2} />
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.1em] text-amber-200">Guided Breathing Recommended</p>
              <p className="text-[8px] text-amber-400/80 leading-normal">Stress score high. Tap to initiate 2-min recovery.</p>
            </div>
          </div>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('cognitive:start-breathing'))}
            className="px-2 py-1 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 text-[8px] font-bold uppercase tracking-widest text-white border border-amber-500/30 transition-all flex-shrink-0"
          >
            Start
          </button>
        </div>
      )}

      {/* Tab bar — startTransition keeps INP < 50ms during panel switch */}
      <div className="flex gap-1 mx-2 mb-2 bg-black/35 rounded-xl p-1 border border-white/5 shadow-inner">
        {(['music', 'controls'] as const).map(tab => (
          <button
            key={tab}
            aria-pressed={activeTab === tab}
            aria-label={tab === 'music' ? 'Music tab' : 'Controls tab'}
            onClick={() => startTransition(() => setActiveTab(tab))}
            className={cn(
              'flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
              activeTab === tab 
                ? 'bg-white/5 backdrop-blur-md text-white border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]' 
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {tab === 'music' ? 'Music' : 'Controls'}
          </button>
        ))}
      </div>

      {/* Tab contents */}
      <div className="flex-1 min-h-0 px-2 pb-2 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'music' ? (
            <motion.div
              key="music"
              className="h-full"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.16 }}
            >
              <PlaylistPanel />
            </motion.div>
          ) : (
            <motion.div
              key="controls"
              className="h-full flex flex-col gap-3"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.16 }}
            >
              {/* Focus mode switch — starts/pauses the Pomodoro focus timer */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/40 backdrop-blur-xl border border-white/5 shadow-inner">
                <div>
                  <p className="text-[11px] font-bold text-white/90 uppercase tracking-wider">Focus Timer</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5 font-medium">{focusTimerActive ? 'Sesión activa — toca para pausar' : 'Iniciar sesión Pomodoro'}</p>
                </div>
                <button
                  onClick={toggleTimer}
                  aria-label={focusTimerActive ? 'Pause focus timer' : 'Start focus timer'}
                  className={cn(
                    'relative w-9 h-5 rounded-full transition-all duration-300',
                    focusTimerActive ? 'bg-indigo-500/80' : 'bg-white/10'
                  )}
                >
                  <div className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-md',
                    focusTimerActive ? 'left-[18px]' : 'left-0.5'
                  )} />
                </button>
              </div>

              {/* Dimness slider — controls backgroundDimness in settings */}
              <div className="p-3 rounded-2xl bg-zinc-900/40 backdrop-blur-xl border border-white/5 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-white/90 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sun className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.2} /> Dimness
                  </p>
                  <span className="text-[9px] font-mono text-zinc-500">{settings.backgroundDimness}%</span>
                </div>
                <div className="relative h-1 bg-white/10 rounded-full">
                  <div
                    className="absolute left-0 top-0 h-full bg-white/80 rounded-full transition-all"
                    style={{ width: `${settings.backgroundDimness}%` }}
                  />
                  <input
                    type="range" min={0} max={80} value={settings.backgroundDimness}
                    onChange={e => updateSettings({ backgroundDimness: Number(e.target.value) })}
                    aria-label="Background dimness"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                  />
                </div>
              </div>

              {/* Theme selector — toggles light/dark via settings context */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/40 backdrop-blur-xl border border-white/5 shadow-inner">
                <div>
                  <p className="text-[11px] font-bold text-white/90 uppercase tracking-wider">Appearance</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5 font-medium">{settings.theme === 'dark' ? 'Dark mode' : 'Light mode'}</p>
                </div>
                <div className="flex gap-1.5 bg-black/30 p-1 rounded-xl border border-white/5">
                  <button
                    aria-label="Light mode"
                    aria-pressed={settings.theme === 'light'}
                    onClick={() => updateSettings({ theme: 'light' })}
                    className={cn('p-1.5 rounded-lg transition-colors', settings.theme === 'light' ? 'bg-white/15 text-white' : 'hover:bg-white/5 text-zinc-400')}
                  >
                    <Sun className="w-3.5 h-3.5" strokeWidth={1.2} />
                  </button>
                  <button
                    aria-label="Dark mode"
                    aria-pressed={settings.theme === 'dark'}
                    onClick={() => updateSettings({ theme: 'dark' })}
                    className={cn('p-1.5 rounded-lg transition-colors', settings.theme === 'dark' ? 'bg-white/15 text-white' : 'hover:bg-white/5 text-zinc-400')}
                  >
                    <Moon className="w-3.5 h-3.5" strokeWidth={1.2} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Main ContextHub Component ──────────────────────────────────────────────
const ContextHubComponent = () => {
  const pathname = usePathname();
  const { settings } = useSettings();
  const { scrollContainer } = useScrollContainer();
  const { logHabit } = useCognitiveDispatch();

  const [hubState, setHubState] = useState<HubState>('idle');
  const [activeTab, setActiveTab] = useState<'music' | 'controls'>('music');
  const [isHovered, setIsHovered] = useState(false);
  const [cognitiveAlert, setCognitiveAlert] = useState(false);
  const [dopaminePulse, setDopaminePulse] = useState(false);

  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Motion values for vertical positioning
  const scrollYProgress = useMotionValue(0);
  const y = useMotionValue(120);
  const springY = useSpring(y, { stiffness: 300, damping: 35, mass: 0.6 });
  const [windowHeight, setWindowHeight] = useState(800);

  // Resize boundaries
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handle = () => setWindowHeight(window.innerHeight);
    handle();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  // Sync scroll dynamics — constant travelRange prevents position jumps
  const SCROLL_BAR_HEIGHT = 80;
  useEffect(() => {
    const updateY = (progress: number) => {
      const topPadding = 24;
      const bottomPadding = 24;
      const travelRange = Math.max(0, windowHeight - topPadding - bottomPadding - SCROLL_BAR_HEIGHT);

      if (hubState === 'expanded') {
        y.set((windowHeight - 310) / 2);
      } else {
        y.set(progress * travelRange + topPadding);
      }
    };

    const unsubscribe = scrollYProgress.on('change', updateY);
    updateY(scrollYProgress.get());

    return unsubscribe;
  }, [hubState, windowHeight, scrollYProgress, y]);

  // Refs to avoid scroll handler re-creation on state changes
  const hubStateRef = useRef(hubState);
  hubStateRef.current = hubState;
  const isHoveredRef = useRef(isHovered);
  isHoveredRef.current = isHovered;

  // Scroll physics observer — stable deps, no re-creation on state change
  useEffect(() => {
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const maxScroll = Math.max(1, scrollHeight - clientHeight);
      const progress = maxScroll > 0 ? (scrollTop / maxScroll) : 0;
      scrollYProgress.set(progress);

      if (hubStateRef.current === 'idle') setHubState('capsule');

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        if (!isHoveredRef.current) {
          setHubState(cur => cur === 'capsule' ? 'idle' : cur);
        }
      }, 100);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [scrollContainer]);

  // Auto-expand capsule → expanded on hover after 400ms
  useEffect(() => {
    if (hubState === 'capsule' && isHovered) {
      const t = setTimeout(() => setHubState('expanded'), 400);
      return () => clearTimeout(t);
    }
  }, [hubState, isHovered]);

  // Auto-collapse expanded → capsule when not hovered (0.5s)
  useEffect(() => {
    if (hubState === 'expanded' && !isHovered) {
      const t = setTimeout(() => setHubState('capsule'), 500);
      return () => clearTimeout(t);
    }
  }, [hubState, isHovered]);

  // Drag-to-Scroll interaction
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!scrollContainer) return;
    isDragging.current = true;
    hasDragged.current = false;
    dragStartY.current = e.clientY;
    dragStartScrollTop.current = scrollContainer.scrollTop;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !scrollContainer) return;
    const delta = e.clientY - dragStartY.current;
    if (Math.abs(delta) > 3) hasDragged.current = true;

    const travelRange = Math.max(1, windowHeight - 48 - SCROLL_BAR_HEIGHT);
    const scrollRange = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const ratio = Math.min(scrollRange / travelRange, 3);
    scrollContainer.scrollTop = dragStartScrollTop.current + delta * ratio;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (hasDragged.current) { e.stopPropagation(); return; }
    setHubState('expanded');
  };

  // Event handlers
  // Event handlers — pulse hub on actions, let sileo handle the notification toast
  useEffect(() => {
    const onHabit = (e: Event) => {
      const cost = (e as CustomEvent).detail?.energyCost ?? 0.5;
      logHabit(cost);
      setHubState('capsule');
      setDopaminePulse(true);
      setTimeout(() => setDopaminePulse(false), 1200);
    };
    const onTask = () => {
      setHubState('capsule');
      setDopaminePulse(true);
      setTimeout(() => setDopaminePulse(false), 1200);
    };
    const onRoutine = () => {
      setHubState('capsule');
      setTimeout(() => setHubState('idle'), 1500);
    };
    const onFatigue = () => {
      setCognitiveAlert(true);
      setHubState('capsule');
      setTimeout(() => setCognitiveAlert(false), 4000);
    };
    const onNavWarn = () => {
      setCognitiveAlert(true);
      setHubState('capsule');
      setTimeout(() => setCognitiveAlert(false), 3000);
    };
    const onReduced = () => {
      setCognitiveAlert(true);
      setHubState('expanded');
      setTimeout(() => setCognitiveAlert(false), 5000);
    };

    window.addEventListener('habit-completed', onHabit);
    window.addEventListener('cognitive:task-completed', onTask);
    window.addEventListener('routine-opened', onRoutine);
    window.addEventListener('cognitive:fatigue-onset', onFatigue);
    window.addEventListener('cognitive:navigation-warning', onNavWarn);
    window.addEventListener('cognitive:reduced-capacity-onset', onReduced);
    return () => {
      window.removeEventListener('habit-completed', onHabit);
      window.removeEventListener('cognitive:task-completed', onTask);
      window.removeEventListener('routine-opened', onRoutine);
      window.removeEventListener('cognitive:fatigue-onset', onFatigue);
      window.removeEventListener('cognitive:navigation-warning', onNavWarn);
      window.removeEventListener('cognitive:reduced-capacity-onset', onReduced);
    };
  }, [logHabit]);

  // Agent Event Triggers
  useEffect(() => {
    const handlePlayMusic = () => {
      setHubState('expanded');
      setActiveTab('music');
    };
    const handleExpandHub = () => {
      setHubState('expanded');
    };
    window.addEventListener('cognitive:play-music', handlePlayMusic);
    window.addEventListener('cognitive:expand-hub', handleExpandHub);
    return () => {
      window.removeEventListener('cognitive:play-music', handlePlayMusic);
      window.removeEventListener('cognitive:expand-hub', handleExpandHub);
    };
  }, []);

  if (pathname.includes('/auth') || pathname.includes('/signin') || pathname.includes('/welcome')) {
    return null;
  }

  // ─── Idle state: sleek vertical hardware slider line ───────────────────────
  const idleContent = (
    <motion.div
      key="hub-idle"
      layoutId="context-hub-shape"
      className="rounded-full bg-white/20 hover:bg-white/40 border border-white/5 shadow-sm cursor-pointer pointer-events-auto transition-colors duration-300"
      style={{
        width: '8px',
        height: '80px',
        marginRight: '0px',
        y: springY,
        touchAction: 'none',
      }}
      initial={false}
      animate={{ opacity: 0.35 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      whileHover={{ opacity: 0.7 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={() => setHubState('capsule')}
      title="Novo Context Hub"
    />
  );

  return (
    <div
      className="fixed right-0 top-0 h-full w-[380px] z-[60] flex flex-col items-end justify-start pointer-events-none"
    >
      <div
        className="pointer-events-auto"
        onMouseEnter={() => {
          setIsHovered(true);
          // Open on hover — idle → capsule immediately, capsule → expanded after delay
          setHubState(cur => {
            if (cur === 'idle') return 'capsule';
            return cur;
          });
        }}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          marginRight: hubState === 'expanded' ? '12px' : '0px',
          transition: 'margin-right 0.3s ease',
        }}
      >
        <AnimatePresence>
          {hubState === 'idle' && idleContent}
          {hubState === 'capsule' && (
            <CapsuleContent
              cognitiveAlert={cognitiveAlert}
              dopaminePulse={dopaminePulse}
              springY={springY}
              handlePointerDown={handlePointerDown}
              handlePointerMove={handlePointerMove}
              handlePointerUp={handlePointerUp}
              handleClick={handleClick}
            />
          )}
          {hubState === 'expanded' && (
            <ExpandedContent
              dopaminePulse={dopaminePulse}
              springY={springY}
              setHubState={setHubState}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export const ContextHub = React.memo(ContextHubComponent);
