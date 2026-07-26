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

import React, { startTransition, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePlayerStore } from '@/lib/player-store';
import { useSettings } from '@/lib/settings-context';
import { useFocus } from '@/lib/focus-context';
import { useScrollContainer } from '@/lib/scroll-container-context';
import { useCognitiveState, useCognitiveDispatch } from '@/lib/cognitive-context';
import type { CognitivePhase } from '@/lib/cognitive-engine';
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  Sun, Moon, Music, CloudSun, Cloud, CloudRain, Zap,
  Brain, X, GripVertical, ArrowRight, Target, Coffee
} from 'lucide-react';
import {
  SiNotion, SiTodoist, SiSlack, SiGmail, SiGooglecalendar
} from 'react-icons/si';
import { NovoSkeleton } from "@/components/ui/NovoSkeleton";
import { NovoEmptyState } from "@/components/ui/NovoEmptyState";
import { AnimatePresence, motion, useMotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

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
type HubState = 'idle' | 'capsule' | 'expanded' | 'notification';
type WeatherIcon = 'sun' | 'cloud-sun' | 'cloud' | 'cloud-rain' | 'zap';

const HUB_SHAPE: Record<HubState, { width: number; height: number; radius: number }> = {
  idle: { width: 8, height: 80, radius: 20 },
  capsule: { width: 46, height: 190, radius: 9999 },
  notification: { width: 352, height: 118, radius: 30 },
  expanded: { width: 360, height: 310, radius: 26 },
};

const HUB_SPRING = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 34,
  mass: 0.86,
  restDelta: 0.01,
  restSpeed: 0.01,
};

export interface TwinNotificationPayload {
  title: string;
  description: string;
  platform?: 'notion' | 'todoist' | 'slack' | 'gmail' | 'calendar' | 'books' | 'twin';
  severity?: 'info' | 'warning' | 'critical';
  actionLabel?: string;
  actionUrl?: string;
}

export function emitTwinNotification(payload: TwinNotificationPayload) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cognitive:notification', { detail: payload }));
  }
}

function NotificationContent({
  notification,
  onDismiss,
}: {
  notification: TwinNotificationPayload;
  onDismiss: () => void;
}) {
  const router = useRouter();

  // Strip any legacy generic emojis from title to enforce NOVO vector icon design system
  const cleanTitle = notification.title
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .trim();

  const isCritical = notification.severity === 'critical';
  const isWarning = notification.severity === 'warning';

  const dotColor = isCritical ? 'bg-red-400' : isWarning ? 'bg-amber-400' : 'bg-emerald-400';
  const tagColor = isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-indigo-400';

  const iconContainerClass = isCritical
    ? 'bg-red-500/15 border-red-500/30 text-red-400'
    : isWarning
    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
    : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400';

  const renderIcon = () => {
    if (notification.platform === 'notion') return <SiNotion className="w-3.5 h-3.5 text-white" />;
    if (notification.platform === 'todoist') return <SiTodoist className="w-3.5 h-3.5 text-red-400" />;
    if (notification.platform === 'slack') return <SiSlack className="w-3.5 h-3.5 text-emerald-400" />;
    if (notification.platform === 'gmail') return <SiGmail className="w-3.5 h-3.5 text-red-400" />;
    if (notification.platform === 'calendar') return <SiGooglecalendar className="w-3.5 h-3.5 text-blue-400" />;

    if (cleanTitle.toLowerCase().includes('fatiga')) return <Coffee className="w-3.5 h-3.5 text-amber-400" />;
    if (cleanTitle.toLowerCase().includes('foco') || cleanTitle.toLowerCase().includes('focus')) return <Target className="w-3.5 h-3.5 text-indigo-400" />;
    if (cleanTitle.toLowerCase().includes('capacidad') || cleanTitle.toLowerCase().includes('reducida')) return <Zap className="w-3.5 h-3.5 text-red-400" />;

    return <Brain className="w-3.5 h-3.5 text-indigo-400" />;
  };

  return (
    <div className="w-full h-full p-3.5 flex flex-col justify-between overflow-hidden relative bg-black/95 border border-white/10 backdrop-blur-3xl rounded-[22px] shadow-[0_16px_48px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)]">
      {/* Top Header Row — iOS Dynamic Island style dot indicator + category tag */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", dotColor)} />
          <span className={cn("text-[9px] font-mono font-bold tracking-widest uppercase opacity-90", tagColor)}>
            TWIN SIGNAL
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white flex items-center justify-center transition-all cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Main Content Row */}
      <div className="flex items-center gap-3 my-0.5 min-w-0">
        <div className={cn("w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 shadow-inner", iconContainerClass)}>
          {renderIcon()}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[13px] font-bold text-white tracking-tight leading-tight truncate">
            {cleanTitle}
          </h4>
          <p className="text-[10px] text-white/70 font-normal leading-snug line-clamp-2 mt-0.5">
            {notification.description}
          </p>
        </div>
      </div>

      {/* Action Footer */}
      {notification.actionLabel && (
        <div className="flex justify-end pt-0.5">
          <button
            onClick={() => {
              if (notification.actionUrl) {
                router.push(notification.actionUrl);
              }
              onDismiss();
            }}
            className="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 border border-white/15 text-[10px] font-semibold text-white transition-all shadow-sm flex items-center gap-1 cursor-pointer active:scale-95"
          >
            <span>{notification.actionLabel}</span>
            <ArrowRight className="w-3 h-3 text-white/80" />
          </button>
        </div>
      )}
    </div>
  );
}

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
    let t: ReturnType<typeof setInterval> | null = setInterval(() => setTime(new Date()), 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setTime(new Date());
        if (!t) t = setInterval(() => setTime(new Date()), 1000);
      } else if (t) {
        clearInterval(t);
        t = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (t) clearInterval(t);
      document.removeEventListener('visibilitychange', onVisibility);
    };
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
function CapsuleContent({ cognitiveAlert }: { cognitiveAlert: boolean }) {
  const { bioState } = useCognitiveState();
  return (
    <div className="flex flex-col items-center justify-between py-4 px-2 w-full h-full">
      <ClockSection attentionScore={bioState.attentionScore} showDetails={false} />

      <div className="px-2 py-1 rounded-full text-[8px] font-bold tracking-widest uppercase bg-white/5 backdrop-blur-md text-white/60 border border-white/5 flex-shrink-0 text-center leading-none">
        {PHASE_LABEL[bioState.phase]}
      </div>

      {cognitiveAlert && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ border: `1.5px solid ${PHASE_COLOR[bioState.phase]}50` }}
          animate={{ opacity: [1, 0, 1, 0] }}
          transition={{ duration: 1.2, repeat: 2 }}
        />
      )}
    </div>
  );
}

// ─── Expanded Content Sub-component ─────────────────────────────────────────
function ExpandedContent({
  setHubState,
  activeTab,
  setActiveTab,
}: {
  setHubState: React.Dispatch<React.SetStateAction<HubState>>;
  activeTab: 'music' | 'controls';
  setActiveTab: React.Dispatch<React.SetStateAction<'music' | 'controls'>>;
}) {
  // ── Real settings connections ──────────────────────────────────────────────
  const { settings, updateSettings } = useSettings();
  const { isActive: focusTimerActive, toggleTimer } = useFocus();
  const { bioState } = useCognitiveState();
  return (
    <div className="w-full h-full p-4 flex flex-col overflow-hidden">
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
    </div>
  );
}

// ─── Main ContextHub Component ──────────────────────────────────────────────
const ContextHubComponent = () => {
  const pathname = usePathname();
  const { scrollContainer } = useScrollContainer();
  const { logHabit } = useCognitiveDispatch();

  const [hubState, setHubState] = useState<HubState>('idle');
  const [activeTab, setActiveTab] = useState<'music' | 'controls'>('music');
  const [isHovered, setIsHovered] = useState(false);
  const [cognitiveAlert, setCognitiveAlert] = useState(false);
  const [dopaminePulse, setDopaminePulse] = useState(false);
  const [activeNotification, setActiveNotification] = useState<TwinNotificationPayload | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Direct y motion value — no spring to avoid oscillation
  const y = useMotionValue(80);
  const [windowHeight, setWindowHeight] = useState(800);
  const SCROLL_BAR_HEIGHT = 80;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handle = () => setWindowHeight(window.innerHeight);
    handle();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);


  // Refs to avoid scroll handler re-creation on state changes
  const hubStateRef = useRef(hubState);
  hubStateRef.current = hubState;
  const isHoveredRef = useRef(isHovered);
  isHoveredRef.current = isHovered;

  // Scroll observer — moves hub + triggers state change
  useEffect(() => {
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const maxScroll = Math.max(1, scrollHeight - clientHeight);
      const progress = maxScroll > 0 ? scrollTop / maxScroll : 0;

      // Update vertical position directly (no spring)
      if (hubStateRef.current !== 'expanded' && hubStateRef.current !== 'notification') {
        const topPadding = 80;
        const travelRange = Math.max(0, windowHeight - topPadding - 24 - SCROLL_BAR_HEIGHT);
        y.set(progress * travelRange + topPadding);
      }

      if (hubStateRef.current === 'idle') setHubState('capsule');

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        if (!isHoveredRef.current) {
          setHubState(cur => cur === 'capsule' ? 'idle' : cur);
        }
      }, 1400);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [scrollContainer, windowHeight, y]);

  // Auto-expand capsule → expanded on hover after 400ms (desktop only in
  // practice — touch devices never dispatch mouseenter).
  useEffect(() => {
    if (hubState === 'capsule' && isHovered) {
      const t = setTimeout(() => {
        setHubState('expanded');
        expandedViaHoverRef.current = true;
      }, 400);
      return () => clearTimeout(t);
    }
  }, [hubState, isHovered]);

  // Auto-collapse expanded → capsule on mouse-leave (0.5s) — but ONLY for
  // expansions that were themselves triggered by hover. A tap/click-triggered
  // expansion (the only kind that exists on touch, since `isHovered` never
  // becomes true there) used to collapse ~500ms after ANY tap regardless of
  // intent, because this effect only ever checked `!isHovered`, which is
  // permanently true on touch. Dismissal for those is the tap-outside
  // handler below instead — the same interaction model as iOS's Dynamic
  // Island: tap to open, stays open until you tap elsewhere.
  const expandedViaHoverRef = useRef(false);
  useEffect(() => {
    if (hubState === 'expanded' && !isHovered && expandedViaHoverRef.current) {
      const t = setTimeout(() => setHubState('capsule'), 500);
      return () => clearTimeout(t);
    }
  }, [hubState, isHovered]);

  // Tap/click outside the hub collapses it — the touch equivalent of
  // mouse-leave, and also a nice desktop shortcut (click away to dismiss
  // instead of waiting on the hover-out timeout).
  const hubRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hubState !== 'expanded') return;
    const handleOutside = (e: PointerEvent) => {
      if (hubRef.current && !hubRef.current.contains(e.target as Node)) {
        setHubState('capsule');
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [hubState]);

  const handleClick = () => {
    expandedViaHoverRef.current = false;
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
      setTimeout(() => setHubState('idle'), 1800);
    };
    const handleNotification = (e: Event) => {
      const detail = (e as CustomEvent).detail as TwinNotificationPayload;
      if (detail) {
        setActiveNotification(detail);
        setHubState('notification');
        if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
        notificationTimerRef.current = setTimeout(() => {
          setCognitiveAlert(false);
          setHubState('idle');
        }, 6000);
      }
    };
    const onFatigue = () => {
      setCognitiveAlert(true);
      handleNotification(new CustomEvent('cognitive:notification', {
        detail: {
          title: 'Alerta de Fatiga Cognitiva',
          description: 'Se ha detectado acumulación de fatiga. Te recomendamos hacer una pausa de 5 minutos o activar la música de foco.',
          platform: 'twin',
          severity: 'warning',
          actionLabel: 'Escuchar Música',
          actionUrl: '/music'
        }
      }));
    };
    const onNavWarn = () => {
      setCognitiveAlert(true);
      handleNotification(new CustomEvent('cognitive:notification', {
        detail: {
          title: 'Ventana de Foco Activa',
          description: 'Estás en tu ventana pico de concentración. Evita el cambio de contexto para maximizar tu rendimiento.',
          platform: 'twin',
          severity: 'info',
          actionLabel: 'Ver Tareas',
          actionUrl: '/checklist'
        }
      }));
    };
    const onReduced = () => {
      setCognitiveAlert(true);
      handleNotification(new CustomEvent('cognitive:notification', {
        detail: {
          title: 'Capacidad Reducida',
          description: 'Tu reserva energética está baja. Se recomienda respiración guiada o tareas de bajo impacto.',
          platform: 'twin',
          severity: 'critical',
          actionLabel: 'Iniciar Respiración',
          actionUrl: '/cognitive'
        }
      }));
    };

    window.addEventListener('habit-completed', onHabit);
    window.addEventListener('cognitive:task-completed', onTask);
    window.addEventListener('routine-opened', onRoutine);
    window.addEventListener('cognitive:notification', handleNotification);
    window.addEventListener('cognitive:fatigue-onset', onFatigue);
    window.addEventListener('cognitive:navigation-warning', onNavWarn);
    window.addEventListener('cognitive:reduced-capacity-onset', onReduced);
    return () => {
      window.removeEventListener('habit-completed', onHabit);
      window.removeEventListener('cognitive:task-completed', onTask);
      window.removeEventListener('routine-opened', onRoutine);
      window.removeEventListener('cognitive:notification', handleNotification);
      window.removeEventListener('cognitive:fatigue-onset', onFatigue);
      window.removeEventListener('cognitive:navigation-warning', onNavWarn);
      window.removeEventListener('cognitive:reduced-capacity-onset', onReduced);
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    };
  }, [logHabit]);

  // Agent Event Triggers
  useEffect(() => {
    const handlePlayMusic = () => {
      expandedViaHoverRef.current = false;
      setHubState('expanded');
      setActiveTab('music');
    };
    const handleExpandHub = () => {
      expandedViaHoverRef.current = false;
      setHubState('expanded');
    };
    window.addEventListener('cognitive:play-music', handlePlayMusic);
    window.addEventListener('cognitive:expand-hub', handleExpandHub);
    return () => {
      window.removeEventListener('cognitive:play-music', handlePlayMusic);
      window.removeEventListener('cognitive:expand-hub', handleExpandHub);
    };
  }, []);

  if (pathname?.includes('/auth') || pathname?.includes('/signin') || pathname?.includes('/welcome')) {
    return null;
  }

  // ─── Single morphing hub — no FLIP, no element switching, pure shape animation ───
  return (
    <div className="fixed left-0 top-0 h-full w-screen z-[60] flex flex-col items-start justify-start pointer-events-none overflow-visible">
      <motion.div
        ref={hubRef}
        className={cn(
          "context-hub-layer pointer-events-auto select-none relative overflow-hidden border transition-colors duration-300",
          hubState === 'idle'
            ? 'bg-white/20 border-white/5 cursor-pointer hover:bg-white/40'
            : hubState === 'capsule' && cognitiveAlert
              ? 'bg-gradient-to-b from-indigo-950/70 to-zinc-950/70 border-indigo-500/40 backdrop-blur-2xl cursor-pointer'
              : hubState === 'capsule'
                ? 'bg-black/90 border-white/10 hover:border-white/20 backdrop-blur-2xl cursor-pointer'
                : 'border-white/10 bg-black/95 backdrop-blur-3xl cursor-default',
          (hubState === 'capsule' || hubState === 'expanded') && dopaminePulse && 'animate-dopamine-pulse',
        )}
        style={{ y }}
        initial={{
          width: HUB_SHAPE.idle.width, height: HUB_SHAPE.idle.height, borderRadius: HUB_SHAPE.idle.radius, opacity: 0.55,
          boxShadow: '0 0 0 rgba(0,0,0,0)',
          transformOrigin: '100% 50%',
        }}
        animate={{
          width: HUB_SHAPE[hubState].width,
          height: HUB_SHAPE[hubState].height,
          borderRadius: HUB_SHAPE[hubState].radius,
          opacity: hubState === 'idle' ? 0.55 : 1,
          boxShadow: hubState === 'idle'
            ? '0 0 0 rgba(0,0,0,0)'
            : hubState === 'expanded'
              ? '-24px 32px 72px rgba(0,0,0,0.78), inset 0 0 24px rgba(255,255,255,0.025), inset 0 1px 0 rgba(255,255,255,0.09)'
              : hubState === 'notification'
                ? '-18px 18px 48px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.10)'
                : '-10px 16px 48px rgba(0,0,0,0.62)',
        }}
        transition={HUB_SPRING}
        onMouseEnter={() => {
          setIsHovered(true);
          if (hubState === 'idle') setHubState('capsule');
        }}
        onMouseLeave={() => setIsHovered(false)}
        onClick={
          hubState === 'idle' ? () => setHubState('capsule')
          : hubState === 'capsule' ? handleClick
          : undefined
        }
        title={hubState === 'idle' ? 'Novo Context Hub' : undefined}
      >
        <AnimatePresence mode="wait">
          {hubState === 'idle' && (
            <motion.div
              key="idle"
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <GripVertical className="w-3 h-3 text-white/50" strokeWidth={1.5} />
            </motion.div>
          )}
          {hubState === 'capsule' && (
            <motion.div
              key="capsule"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <CapsuleContent cognitiveAlert={cognitiveAlert} />
            </motion.div>
          )}
          {hubState === 'notification' && activeNotification && (
            <motion.div
              key="notification"
              className="absolute inset-0"
              initial={{ opacity: 0, x: 16, scale: 0.985, filter: 'blur(6px)' }}
              animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: 10, scale: 0.985, filter: 'blur(5px)' }}
              transition={{ type: 'spring', stiffness: 560, damping: 38, mass: 0.78 }}
            >
              <NotificationContent
                notification={activeNotification}
                onDismiss={() => {
                  setCognitiveAlert(false);
                  setHubState('capsule');
                }}
              />
            </motion.div>
          )}
          {hubState === 'expanded' && (
            <motion.div
              key="expanded"
              className="absolute inset-0"
              initial={{ opacity: 0, x: 18, scale: 0.992, filter: 'blur(5px)' }}
              animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: 12, scale: 0.992, filter: 'blur(5px)' }}
              transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.76 }}
            >
              <ExpandedContent
                setHubState={setHubState}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export const ContextHub = React.memo(ContextHubComponent);
