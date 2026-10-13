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
import { usePathname, useRouter } from 'next/navigation';
import { usePlayerStore } from '@/lib/player-store';
import { useSettings } from '@/lib/settings-context';
import { useFocus, useFocusControls } from '@/lib/focus-context';
import { useScrollContainer } from '@/lib/scroll-container-context';
import { useCognitiveState, useCognitiveDispatch } from '@/lib/cognitive-context';
import type { CognitivePhase } from '@/lib/cognitive-engine';
import {
  Play, Pause, SkipForward, SkipBack, Plus, Timer, Waves,
  Sun, Moon, Music, CloudSun, Cloud, CloudRain, Zap,
  Brain, X, GripVertical, ArrowRight, Target, Coffee, FileText, Mic, Sparkles
} from 'lucide-react';
import {
  SiNotion, SiTodoist, SiGmail, SiGooglecalendar
} from 'react-icons/si';
import { FaSlack } from 'react-icons/fa6';
import { NovoSkeleton } from "@/components/ui/NovoSkeleton";
import { NovoEmptyState } from "@/components/ui/NovoEmptyState";
import { motion, useMotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useQuickCapture } from '@/lib/quick-capture-context';
import { useNovoMotionPolicy } from '@/hooks/use-novo-motion-policy';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { SHARED_SURFACE_SHAPES, useSharedSurfaceMorph } from '@/hooks/use-shared-surface-morph';
import { PomodoroDetachMorph } from '@/components/command-center-liquid-morph';
import { PomodoroWidget } from '@/components/pomodoro-widget';
import { createClientIdempotencyKey } from '@/lib/client-idempotency';
import { eventBus } from '@/lib/events/event-bus';
import type { CurrentTrack } from '@/lib/player-store';

// ─── Cognitive phase accent colors (High HSL precision) ──────────────────────
const PHASE_COLOR: Record<CognitivePhase, string> = {
  PEAK_FOCUS:       '#818cf8', // light indigo
  LINEAR_EXECUTION: '#34d399', // light emerald
  SYNAPTIC_FATIGUE: '#fb923c', // light amber
  REDUCED_CAPACITY_MODE: '#f59e0b', // warm amber
};

// ─── Types ───────────────────────────────────────────────────────────────────
type HubState = 'idle' | 'capsule' | 'expanded' | 'notification';
type HubTab = 'focus' | 'audio' | 'settings';
type WeatherIcon = 'sun' | 'cloud-sun' | 'cloud' | 'cloud-rain' | 'zap';

const HUB_TABS: readonly HubTab[] = ['focus', 'audio', 'settings'];

const HUB_CONTENT_SPRING = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 42,
  mass: 0.7,
  restDelta: 0.02,
  restSpeed: 0.02,
};

const HUB_TAB_SPRING = {
  type: 'spring' as const,
  stiffness: 560,
  damping: 44,
  mass: 0.64,
  restDelta: 0.02,
  restSpeed: 0.02,
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
    if (notification.platform === 'slack') return <FaSlack className="w-3.5 h-3.5 text-emerald-400" />;
    if (notification.platform === 'gmail') return <SiGmail className="w-3.5 h-3.5 text-red-400" />;
    if (notification.platform === 'calendar') return <SiGooglecalendar className="w-3.5 h-3.5 text-blue-400" />;

    if (cleanTitle.toLowerCase().includes('fatiga')) return <Coffee className="w-3.5 h-3.5 text-amber-400" />;
    if (cleanTitle.toLowerCase().includes('foco') || cleanTitle.toLowerCase().includes('focus')) return <Target className="w-3.5 h-3.5 text-indigo-400" />;
    if (cleanTitle.toLowerCase().includes('capacidad') || cleanTitle.toLowerCase().includes('reducida')) return <Zap className="w-3.5 h-3.5 text-red-400" />;

    return <Brain className="w-3.5 h-3.5 text-indigo-400" />;
  };

  return (
    <div className="w-full h-full p-3.5 flex flex-col justify-between overflow-visible relative bg-black/95 border border-white/10 backdrop-blur-3xl rounded-l-[30px] rounded-r-none shadow-[0_16px_48px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)]">
      <div aria-hidden="true" className="absolute -right-3 top-1/2 h-12 w-4 -translate-y-1/2 rounded-l-[18px] border-y border-l border-white/10 bg-black/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />
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
              if (notification.actionUrl?.startsWith('/') && !notification.actionUrl.startsWith('//')) {
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
  playlists?: Array<{ id: string; name: string; image?: string; trackCount: number }>;
  likedTracks?: CurrentTrack[];
}

function PlaylistPanel() {
  const router = useRouter();
  const [data, setData] = useState<YTData>({});
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState<'playlists' | 'liked'>('playlists');
  const [error, setError] = useState('');
  const [playingList, setPlayingList] = useState<string | null>(null);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlayPause = usePlayerStore((state) => state.togglePlayPause);
  const nextTrack = usePlayerStore((state) => state.nextTrack);
  const previousTrack = usePlayerStore((state) => state.previousTrack);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const playPlaylist = usePlayerStore((state) => state.playPlaylist);

  const loadAccount = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/youtube/account', { signal });
      if (!response.ok) {
        setError(response.status === 401 ? 'Conecta YouTube desde Música para ver tus listas.' : 'No pudimos cargar tu música. Puedes volver a intentar.');
        return;
      }
      setData(await response.json());
    } catch {
      if (!signal?.aborted) setError('No pudimos cargar tu música. Puedes volver a intentar.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void loadAccount(controller.signal);
    return () => controller.abort();
  }, [loadAccount]);

  const startPlaylist = async (playlist: NonNullable<YTData['playlists']>[number]) => {
    if (playingList) return;
    window.dispatchEvent(new Event('youtube:load-api'));
    setPlayingList(playlist.id);
    setError('');
    try {
      const response = await fetch(`/api/youtube/playlists/${encodeURIComponent(playlist.id)}`);
      if (!response.ok) throw new Error('Playlist unavailable');
      const result = await response.json();
      const tracks = (result.tracks as CurrentTrack[]).filter(track => track.id && track.name).map(track => ({ ...track, uri: track.id }));
      if (!tracks.length) { setError('Esta lista no tiene pistas reproducibles.'); return; }
      playPlaylist({ id: playlist.id, name: playlist.name, tracks });
    } catch { setError('No pudimos abrir esta lista. Inténtalo de nuevo.'); }
    finally { setPlayingList(null); }
  };

  return (
    <div className="flex flex-col min-h-full gap-3">
      <AmbientControls />
      {/* Now Playing Bar — triggers lazy YouTube API load on first interaction */}
      {currentTrack && (
        <div
          className="flex items-center gap-2.5 bg-zinc-900/40 backdrop-blur-xl border border-white/5 shadow-inner rounded-2xl p-2.5"
        >
          {currentTrack.image && (
            <img src={currentTrack.image} className="w-9 h-9 rounded-xl object-cover flex-shrink-0 opacity-80" alt="" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white/90 truncate">{currentTrack.name}</p>
            <p className="text-[10px] text-white/70 font-mono tracking-tighter truncate mt-0.5">{currentTrack.artist || 'Artista desconocido'}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={previousTrack}
              aria-label="Pista anterior"
              className="p-1 rounded-lg hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-1 focus-visible:ring-offset-black/80"
            >
              <SkipBack aria-hidden="true" className="w-3.5 h-3.5 text-zinc-500 hover:text-white" strokeWidth={1.2} />
            </button>
            <button
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
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
              aria-label="Pista siguiente"
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
            aria-label={tab === 'playlists' ? 'Ver listas' : 'Ver canciones guardadas'}
            onClick={() => startTransition(() => setActiveList(tab))}
            className={cn(
              'flex-1 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
              activeList === tab
                ? 'bg-white/5 backdrop-blur-md text-white border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {tab === 'playlists' ? 'Listas' : 'Guardadas'}
          </button>
        ))}
      </div>

      {/* Scrollable Content list */}
      {error && <div role="status" className="text-[11px] text-white/80">
        <p>{error}</p>
        <button type="button" onClick={() => void loadAccount()} className="min-h-11 px-2 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">Reintentar</button>
        <button type="button" onClick={() => router.push('/music')} className="min-h-11 px-2 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">Abrir Música</button>
      </div>}
      <div className="flex-1 space-y-1.5 pr-0.5 relative" data-lenis-prevent>
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
                  <button type="button" key={pl.id} disabled={playingList !== null} onClick={() => void startPlaylist(pl)} aria-label={`Reproducir lista ${pl.name}`} className="min-h-11 w-full text-left flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] active:bg-white/[0.06] transition-all group border border-transparent hover:border-white/5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                    {pl.image ? (
                      <img src={pl.image} className="w-8 h-8 rounded-lg object-cover flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                        <Music className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.2} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-zinc-300 truncate group-hover:text-white transition-colors">{pl.name}</p>
                      <p className="text-[9px] text-white/60 font-mono tracking-tighter mt-0.5">{playingList === pl.id ? 'Cargando…' : `${pl.trackCount} pistas`}</p>
                    </div>
                  </button>
                ))
              ) : (
                (data.likedTracks || []).slice(0, 15).map(t => (
                  <button type="button" key={t.id} aria-label={`Reproducir ${t.name}`} onClick={() => { window.dispatchEvent(new Event('youtube:load-api')); void playTrack({ ...t, uri: t.id }); }} className="min-h-11 w-full text-left flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] active:bg-white/[0.06] transition-all group border border-transparent hover:border-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                    {t.image ? (
                      <img src={t.image} className="w-8 h-8 rounded-lg object-cover flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                        <Music className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.2} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-zinc-300 truncate group-hover:text-white transition-colors">{t.name}</p>
                      <p className="text-[9px] text-white/60 font-mono tracking-tighter mt-0.5 truncate">{t.artist || 'Artista desconocido'}</p>
                    </div>
                  </button>
                ))
              )}
            </motion.div>
          ) : !error ? (
            <NovoEmptyState
              key="playlist-empty"
              message="No hay pistas en esta sección. Puedes buscar música o usar un sonido ambiente."
              actionLabel="Abrir Música"
              onAction={() => router.push('/music')}
              className="py-6 min-h-[140px] w-full"
            />
          ) : null}
      </div>
    </div>
  );
}

// ─── Clock and Weather Section Sub-component (Self-updating for render isolation) ───
type AmbientPreset = 'lluvia' | 'blanco' | 'cafetería';

let ambientAudio: { context: AudioContext; source: AudioBufferSourceNode; preset: AmbientPreset } | null = null;

function setAmbientIndicator(active: boolean) {
  window.dispatchEvent(new CustomEvent('cognitive:ambient-audio', { detail: { active } }));
}

function stopAmbientAudio() {
  if (!ambientAudio) return;
  ambientAudio.source.stop();
  ambientAudio.source.disconnect();
  void ambientAudio.context.close().catch(() => {});
  ambientAudio = null;
  setAmbientIndicator(false);
}

function AmbientControls() {
  const [activePreset, setActivePreset] = useState<AmbientPreset | null>(() => ambientAudio?.preset ?? null);
  const [error, setError] = useState('');

  const toggleAmbient = (preset: AmbientPreset) => {
    if (activePreset === preset) {
      stopAmbientAudio();
      setActivePreset(null);
      return;
    }

    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) { setError('Este navegador no permite sonidos ambiente.'); return; }
    stopAmbientAudio();
    setError('');
    const context = new AudioContextClass();
    void context.resume().catch(() => {
      if (ambientAudio?.context !== context) return;
      stopAmbientAudio();
      setActivePreset(null);
      setError('No pudimos iniciar el audio. Vuelve a tocar el sonido.');
    });

    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = preset === 'blanco' ? white : previous * 0.96 + white * 0.04;
      samples[index] = previous;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = preset === 'cafetería' ? 'bandpass' : 'lowpass';
    filter.frequency.value = preset === 'lluvia' ? 1300 : preset === 'cafetería' ? 900 : 7000;
    gain.gain.value = preset === 'blanco' ? 0.025 : 0.045;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
    ambientAudio = { context, source, preset };
    setActivePreset(preset);
    setAmbientIndicator(true);
  };

  return (
    <div className="rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-2.5 shadow-inner">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] font-black tracking-[0.16em] uppercase text-white/80 flex items-center gap-1.5">
          <Waves className="w-3.5 h-3.5 text-indigo-300" strokeWidth={1.4} /> Ambiente
        </p>
        <div className="flex h-4 items-end gap-[2px]" aria-hidden="true">
          {[0, 1, 2, 3].map((bar) => <span key={bar} className={cn('w-px rounded-full bg-indigo-300/80', activePreset ? 'animate-pulse' : 'opacity-30')} style={{ height: `${5 + (bar % 3) * 3}px`, animationDelay: `${bar * 90}ms` }} />)}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {(['lluvia', 'blanco', 'cafetería'] as AmbientPreset[]).map((preset) => (
          <button
            key={preset}
            onClick={() => toggleAmbient(preset)}
            aria-pressed={activePreset === preset}
            aria-label={`${activePreset === preset ? 'Detener' : 'Activar'} sonido de ${preset}`}
            className={cn('min-h-11 rounded-xl px-1.5 py-1.5 text-[9px] font-semibold capitalize transition-[background,color,transform] duration-150 active:scale-[0.97] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70', activePreset === preset ? 'bg-indigo-400/20 text-indigo-100 border border-indigo-300/25' : 'bg-black/20 text-white/80 hover:bg-white/[0.07] hover:text-white border border-transparent')}
          >
            {preset}
          </button>
        ))}
      </div>
      {error && <p role="status" className="mt-1 text-[10px] text-white/80">{error}</p>}
    </div>
  );
}

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
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
    };

    const schedule = () => {
      if (disposed || document.visibilityState === 'hidden') return;
      setTime(new Date());
      // Align updates to the second boundary and avoid background wakeups.
      const delay = Math.max(120, 1000 - (Date.now() % 1000));
      timer = setTimeout(schedule, delay);
    };

    const onVisibility = () => {
      clearTimer();
      if (document.visibilityState === 'visible') schedule();
    };

    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      clearTimer();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!time) {
    return (
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-white/5 rounded-full" />
    );
  }

  const formattedTime = time.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
  const weatherIcon = getContextualWeather(time.getHours());

  if (showDetails) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="scale-[0.72] origin-center opacity-80">
          <AnalogClock time={time} attentionScore={attentionScore} />
        </div>
        <div>
          <p className="text-[11px] font-bold text-white/95 leading-none">{formattedTime}</p>
          <p className="text-[9px] text-zinc-300/75 font-mono tracking-tight mt-1 flex items-center gap-1.5">
            {getWeatherIcon(weatherIcon)}
            <span>{time.toLocaleDateString('es-BO', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
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

      <p className="text-[10px] font-mono font-semibold text-white/80 tracking-tight leading-none">{formattedTime}</p>

      {getWeatherIcon(weatherIcon)}
    </>
  );
}

// ─── Capsule Content Sub-component ──────────────────────────────────────────
function CapsuleContent({
  cognitiveAlert,
  ambientAudioActive,
  focusToggleEnabled,
  onFocusActionPointerChange,
}: {
  cognitiveAlert: boolean;
  ambientAudioActive: boolean;
  focusToggleEnabled: boolean;
  onFocusActionPointerChange: (hovered: boolean) => void;
}) {
  const { bioState } = useCognitiveState();
  const { isActive: focusTimerActive, toggleTimer } = useFocusControls();
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const reduceMotion = useNovoMotionPolicy() !== 'full';
  return (
    <div className="flex flex-col items-center justify-between py-3 px-1 w-full h-full">
      <ClockSection attentionScore={bioState.attentionScore} showDetails={false} />

      {cognitiveAlert ? (
        <motion.div
          className="w-7 h-7 rounded-full border border-indigo-400/35 bg-indigo-400/10 flex items-center justify-center shadow-[0_0_14px_rgba(129,140,248,0.28)]"
          animate={reduceMotion ? { scale: 1, opacity: 1 } : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          aria-label="Alerta del Gemelo Cognitivo"
        >
          <Brain className="w-3.5 h-3.5 text-indigo-200" strokeWidth={1.5} />
        </motion.div>
      ) : focusTimerActive ? (
        <div className="flex flex-col items-center gap-1 text-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.9)]" />
          <FocusTimeText className="text-[8px] font-mono font-bold tabular-nums tracking-tight" />
        </div>
      ) : isPlaying || ambientAudioActive ? (
        <div className="h-6 flex items-center gap-[2px]" aria-label="Audio activo">
          {[0, 1, 2].map((bar) => (
            <motion.span
              key={bar}
              className="w-[2px] rounded-full bg-indigo-300"
              animate={reduceMotion ? { height: `${5 + bar * 1.5}px` } : { height: ['5px', `${10 + bar * 3}px`, '5px'] }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.55 + bar * 0.12, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        </div>
      ) : (
        <div className="px-2 py-1 rounded-full text-[7px] font-bold tracking-[0.13em] uppercase bg-white/[0.06] text-white/75 border border-white/[0.08] flex-shrink-0 text-center leading-none">
          En reposo
        </div>
      )}

      {focusToggleEnabled && (
        <button
          type="button"
          data-hub-direct-action
          aria-label={focusTimerActive ? 'Pausar temporizador' : 'Iniciar temporizador'}
          aria-pressed={focusTimerActive}
          title={focusTimerActive ? 'Pausar temporizador' : 'Iniciar temporizador'}
          onPointerEnter={() => onFocusActionPointerChange(true)}
          onPointerLeave={() => onFocusActionPointerChange(false)}
          onClick={(event) => { event.stopPropagation(); toggleTimer(); }}
          className={cn(
            'pointer-events-auto relative z-[3] grid h-11 w-11 shrink-0 place-items-center rounded-[17px] border transition-[background,color,transform,border-color] duration-150 active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55',
            focusTimerActive
              ? 'border-emerald-300/25 bg-emerald-300/15 text-emerald-100 shadow-[0_0_18px_rgba(52,211,153,0.18)]'
              : 'border-white/10 bg-white/[0.08] text-white/80 hover:bg-white/[0.14] hover:text-white',
          )}
        >
          {focusTimerActive ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="ml-0.5 h-4 w-4" />}
        </button>
      )}

      {cognitiveAlert && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ border: `1.5px solid ${PHASE_COLOR[bioState.phase]}50` }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 0, 1, 0] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.2, repeat: 2 }}
        />
      )}
    </div>
  );
}

// ─── Expanded Content Sub-component ─────────────────────────────────────────
function FocusTimeText({ className }: { className?: string }) {
  const { time, formatTime } = useFocus();
  return <span className={className}>{formatTime(time)}</span>;
}

function FocusSessionControl({ onOpen }: { onOpen: (keyboardActivated: boolean) => void }) {
  const { mode, time, isActive } = useFocus();
  const { toggleTimer, resetTimer, profiles, activeProfileId } = useFocusControls();
  const profile = profiles.find(item => item.id === activeProfileId) ?? profiles[0];
  const defaultTime = (mode === 'work' ? profile.workDuration : mode === 'shortBreak' ? profile.shortBreakDuration : profile.longBreakDuration) * 60;
  const isModified = time !== defaultTime;

  return (
    <>
      <p className="mt-0.5 text-[10px] text-white/70">{isModified ? <><FocusTimeText /> restantes</> : 'Elige una tarea y comienza cuando estés listo'}</p>
      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={(event) => {
            if (!isActive) toggleTimer();
            onOpen(event.detail === 0);
          }}
          className="min-h-11 shrink-0 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[10px] font-bold text-white transition-[background,transform] duration-150 hover:bg-white/[0.16] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {isActive ? 'Abrir' : 'Iniciar'}
        </button>
        {isModified && (
          <button
            type="button"
            onClick={resetTimer}
            className="min-h-11 shrink-0 rounded-xl px-3 py-2 text-[10px] font-semibold text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            Reiniciar
          </button>
        )}
      </div>
    </>
  );
}

function ExpandedContent({
  onCollapse,
  onOpenPomodoro,
  pomodoroSourceRef,
  activeTab,
  onTabChange,
  tabDirection,
}: {
  onCollapse: () => void;
  onOpenPomodoro: (keyboardActivated: boolean) => void;
  pomodoroSourceRef: React.RefObject<HTMLDivElement | null>;
  activeTab: HubTab;
  onTabChange: (tab: HubTab) => void;
  tabDirection: 1 | -1;
}) {
  // ── Real settings connections ──────────────────────────────────────────────
  const { settings, updateSettings } = useSettings();
  const router = useRouter();
  const { tasks, selectedTaskId, setSelectedTaskId, addTask } = useFocusControls();
  const reducedMotion = useNovoMotionPolicy() !== 'full';
  const { bioState } = useCognitiveState();
  const { onOpen: openQuickNote } = useQuickCapture();
  const [quickCapture, setQuickCapture] = useState('');
  const [captureStatus, setCaptureStatus] = useState('');
  const [savingCapture, setSavingCapture] = useState(false);
  const captureIntentRef = useRef<{ text: string; key: string } | null>(null);
  const savingRef = useRef(false);
  const activeTask = tasks.find((task) => task.id === selectedTaskId);
  const submitQuickCapture = async () => {
    const text = quickCapture.trim();
    if (!text || savingRef.current) return;
    if (captureIntentRef.current?.text !== text) captureIntentRef.current = { text, key: createClientIdempotencyKey() };
    savingRef.current = true;
    setSavingCapture(true);
    setCaptureStatus('');
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': captureIntentRef.current.key },
        body: JSON.stringify({ title: text, status: 'todo', priority: 'medium' }),
      });
      if (!response.ok) throw new Error('Capture unavailable');
      const task = await response.json();
      if (typeof task.id !== 'string') throw new Error('Invalid task');
      addTask(text, task.id);
      setSelectedTaskId(task.id);
      eventBus.dispatch('TaskCreated', { taskId: task.id, taskTitle: text, source: 'standalone' });
      setQuickCapture('');
      captureIntentRef.current = null;
      setCaptureStatus('Tarea guardada y seleccionada.');
    } catch { setCaptureStatus('No se guardó la tarea. Tu texto se conserva; vuelve a intentar.'); }
    finally { savingRef.current = false; setSavingCapture(false); }
  };
  return (
    <div id="novo-hub-panel" role="region" aria-label="Hub de Novo" className="w-full h-full p-4 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2 pt-1 pb-2.5 border-b border-white/[0.06] mb-2.5 flex-shrink-0">
        <ClockSection attentionScore={bioState.attentionScore} showDetails={true}>
          {/* Cognitive telemetry progress */}
          <div className="flex items-center gap-1.5 mt-2">
            <Brain className="w-2.5 h-2.5" style={{ color: PHASE_COLOR[bioState.phase] }} />
            <div
              role="progressbar"
              aria-label="Nivel de atención"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={bioState.attentionScore}
              className="flex-1 h-1 bg-white/15 rounded-full overflow-hidden w-16"
            >
              <div
                aria-hidden="true"
                className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
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
          type="button"
          aria-label="Contraer Hub"
          aria-expanded="true"
          onClick={onCollapse}
          className="grid h-11 w-11 place-items-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <X aria-hidden="true" className="w-3.5 h-3.5" />
        </button>
      </div>

      {bioState.phase === 'REDUCED_CAPACITY_MODE' && (
        <div className={cn('mx-2 mb-2 p-2.5 rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-300 flex items-center justify-between gap-2 shadow-[0_8px_20px_rgba(245,158,11,0.15)] flex-shrink-0', !reducedMotion && 'animate-pulse')}>
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.2} />
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.1em] text-amber-200">Haz una pausa</p>
              <p className="text-[8px] text-amber-300/85 leading-normal">Abre Foco para elegir un descanso.</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/focus')}
            className="px-2 py-1 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 text-[8px] font-bold uppercase tracking-widest text-white border border-amber-500/30 transition-all flex-shrink-0"
          >
            Abrir Foco
          </button>
        </div>
      )}

      {/* Tab bar — panels overlap briefly instead of waiting for an empty
          exit frame, so tab changes read as one continuous fluid surface. */}
      <div role="tablist" aria-label="Herramientas del Hub" className="grid grid-cols-3 mx-2 mb-3 rounded-[14px] bg-black/45 p-1 border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(0,0,0,0.55)]">
        {HUB_TABS.map(tab => (
          <button
            key={tab}
            role="tab"
            id={`hub-tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={activeTab === tab ? `hub-panel-${tab}` : undefined}
            tabIndex={activeTab === tab ? 0 : -1}
            aria-label={`Pestaña ${tab === 'focus' ? 'Foco' : tab === 'audio' ? 'Audio' : 'Ajustes'}`}
            onClick={() => onTabChange(tab)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const index = HUB_TABS.indexOf(tab);
              const next = event.key === 'Home' ? HUB_TABS[0] : event.key === 'End' ? HUB_TABS[2] : HUB_TABS[(index + (event.key === 'ArrowRight' ? 1 : 2)) % 3];
              onTabChange(next);
              document.getElementById(`hub-tab-${next}`)?.focus();
            }}
            className={cn(
              'min-h-11 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-[10px] transition-[background,color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
              activeTab === tab
                ? 'bg-white/[0.12] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.16),0_1px_2px_rgba(0,0,0,0.2)]'
                : 'text-white/65 hover:text-white/90'
            )}
          >
            {tab === 'focus' ? 'Foco' : tab === 'audio' ? 'Audio' : 'Ajustes'}
          </button>
        ))}
      </div>

      {/* Tab contents */}
      <div className="relative flex-1 min-h-0 px-2 pb-2 overflow-hidden">
          {activeTab === 'focus' ? (
            <motion.div
              key="focus"
              role="tabpanel" id="hub-panel-focus" aria-labelledby="hub-tab-focus"
              data-hub-motion-panel
              className="absolute inset-x-2 top-0 bottom-2 flex flex-col gap-3 overflow-y-auto" data-lenis-prevent
              initial={{ opacity: 0, x: tabDirection * 12, scale: 0.988 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: tabDirection * -8, scale: 0.992 }}
              transition={reducedMotion ? { duration: 0 } : HUB_TAB_SPRING}
            >
              <div ref={pomodoroSourceRef} data-pomodoro-source className="rounded-[20px] border border-emerald-400/15 bg-emerald-400/[0.055] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200/85 flex items-center gap-1.5"><Timer className="w-3.5 h-3.5" /> Temporizador de foco</p>
                    <p className="mt-1 text-sm font-semibold text-white truncate">{activeTask?.text ?? 'Sin tarea seleccionada'}</p>
                    {tasks.some(task => !task.completed) && <select aria-label="Tarea de foco" value={selectedTaskId ?? ''} onChange={event => setSelectedTaskId(event.target.value || null)} className="mt-1 w-full min-h-11 rounded-lg bg-slate-900 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                      <option value="">Sin tarea seleccionada</option>
                      {tasks.filter(task => !task.completed).map(task => <option key={task.id} value={task.id}>{task.text}</option>)}
                    </select>}
                    <FocusSessionControl onOpen={onOpenPomodoro} />
                  </div>
                </div>
              </div>
              <div className="rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-2.5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/75">Captura rápida</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={openQuickNote}
                      aria-label="Nueva nota"
                      className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-white/10 px-2 text-[9px] font-semibold text-white/90 transition-colors hover:bg-white/15 hover:text-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    >
                      <FileText aria-hidden="true" className="h-3 w-3" />
                      Nota
                    </button>
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('toggle-voice-command-hub'))}
                      aria-label="Abrir comandos de voz"
                      className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-white/10 px-2 text-[9px] font-semibold text-white/90 transition-colors hover:bg-white/15 hover:text-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    >
                      <Mic aria-hidden="true" className="h-3 w-3" />
                      Voz
                    </button>
                    <button
                      type="button"
                      onClick={() => { onCollapse(); router.push('/ai'); }}
                      aria-label="Abrir asistente Novo"
                      className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-white/10 px-2 text-[9px] font-semibold text-white/90 transition-colors hover:bg-white/15 hover:text-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    >
                      <Sparkles aria-hidden="true" className="h-3 w-3" />
                      Asistente
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input aria-label="Nueva tarea" disabled={savingCapture} value={quickCapture} onChange={(event) => setQuickCapture(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void submitQuickCapture(); } }} placeholder="Añadir tarea…" className="min-w-0 flex-1 min-h-11 bg-transparent text-xs text-white placeholder:text-white/55 focus-visible:outline-white" />
                  <button type="button" disabled={savingCapture || !quickCapture.trim()} onClick={() => void submitQuickCapture()} aria-label={savingCapture ? 'Guardando tarea' : 'Guardar captura rápida'} className="w-11 h-11 shrink-0 rounded-lg bg-white/10 hover:bg-white/18 text-white flex items-center justify-center disabled:opacity-40 transition-[background,transform] duration-150 active:scale-[0.97]"><Plus className="w-3.5 h-3.5" /></button>
                </div>
                {captureStatus && <p role="status" className="mt-1 text-[10px] text-white/80">{captureStatus}</p>}
              </div>
            </motion.div>
          ) : activeTab === 'audio' ? (
            <motion.div
              key="audio"
              role="tabpanel" id="hub-panel-audio" aria-labelledby="hub-tab-audio"
              data-hub-motion-panel
              className="absolute inset-x-2 top-0 bottom-2 overflow-y-auto" data-lenis-prevent
              initial={{ opacity: 0, x: tabDirection * 12, scale: 0.988 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: tabDirection * -8, scale: 0.992 }}
              transition={reducedMotion ? { duration: 0 } : HUB_TAB_SPRING}
            >
              <PlaylistPanel />
            </motion.div>
          ) : (
            <motion.div
              key="controls"
              role="tabpanel" id="hub-panel-settings" aria-labelledby="hub-tab-settings"
              data-hub-motion-panel
              className="absolute inset-x-2 top-0 bottom-2 flex flex-col gap-3 overflow-y-auto" data-lenis-prevent
              initial={{ opacity: 0, x: tabDirection * 12, scale: 0.988 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: tabDirection * -8, scale: 0.992 }}
              transition={reducedMotion ? { duration: 0 } : HUB_TAB_SPRING}
            >
              {/* Dimness slider — controls backgroundDimness in settings */}
              <div className="p-3 rounded-2xl bg-zinc-900/40 backdrop-blur-xl border border-white/5 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-white/90 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sun className="w-3.5 h-3.5 text-zinc-300" strokeWidth={1.2} /> Atenuación
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
                    aria-label="Atenuación global"
                    className="absolute left-0 top-1/2 h-11 w-full -translate-y-1/2 cursor-pointer appearance-none bg-transparent accent-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  />
                </div>
              </div>
              <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/5 text-xs text-white/90">
                Animaciones
                <input type="checkbox" checked={settings.showAnimations} onChange={event => updateSettings({ showAnimations: event.target.checked })} className="h-5 w-5 accent-indigo-300" />
              </label>

              {/* Theme selector — toggles light/dark via settings context */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/40 backdrop-blur-xl border border-white/5 shadow-inner">
                <div>
                  <p className="text-[11px] font-bold text-white/90 uppercase tracking-wider">Apariencia</p>
                  <p className="text-[9px] text-white/65 mt-0.5 font-medium">{settings.theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}</p>
                </div>
                <div className="flex gap-1.5 bg-black/30 p-1 rounded-xl border border-white/5">
                  <button
                    aria-label="Modo claro"
                    aria-pressed={settings.theme === 'light'}
                    onClick={() => updateSettings({ theme: 'light' })}
                    className={cn('grid h-11 w-11 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70', settings.theme === 'light' ? 'bg-white/15 text-white' : 'hover:bg-white/5 text-zinc-300')}
                  >
                    <Sun className="w-3.5 h-3.5" strokeWidth={1.2} />
                  </button>
                  <button
                    aria-label="Modo oscuro"
                    aria-pressed={settings.theme === 'dark'}
                    onClick={() => updateSettings({ theme: 'dark' })}
                    className={cn('grid h-11 w-11 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70', settings.theme === 'dark' ? 'bg-white/15 text-white' : 'hover:bg-white/5 text-zinc-300')}
                  >
                    <Moon className="w-3.5 h-3.5" strokeWidth={1.2} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
      </div>
    </div>
  );
}

// ─── Main ContextHub Component ──────────────────────────────────────────────
const ContextHubComponent = () => {
  const { scrollContainer } = useScrollContainer();
  const { logHabit } = useCognitiveDispatch();

  const [hubState, setHubState] = useState<HubState>('idle');
  const [pomodoroOpen, setPomodoroOpen] = useState(false);
  const [pomodoroMorphing, setPomodoroMorphing] = useState(false);
  const [activeTab, setActiveTab] = useState<HubTab>('focus');
  const [tabDirection, setTabDirection] = useState<1 | -1>(1);
  const [isHovered, setIsHovered] = useState(false);
  const [cognitiveAlert, setCognitiveAlert] = useState(false);
  const [ambientAudioActive, setAmbientAudioActive] = useState(() => ambientAudio !== null);
  const [dopaminePulse, setDopaminePulse] = useState(false);
  const [activeNotification, setActiveNotification] = useState<TwinNotificationPayload | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dopamineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Direct y motion value — no spring to avoid oscillation
  const y = useMotionValue(80);
  const [windowHeight, setWindowHeight] = useState(800);
  const SCROLL_BAR_HEIGHT = SHARED_SURFACE_SHAPES.capsule.height;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handle = () => setWindowHeight(window.visualViewport?.height ?? window.innerHeight);
    handle();
    window.addEventListener('resize', handle);
    window.visualViewport?.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('resize', handle);
      window.visualViewport?.removeEventListener('resize', handle);
    };
  }, []);

  // Refs to avoid scroll handler re-creation on state changes
  const hubStateRef = useRef(hubState);
  hubStateRef.current = hubState;
  const isHoveredRef = useRef(isHovered);
  isHoveredRef.current = isHovered;
  const pomodoroOpenRef = useRef(pomodoroOpen);
  pomodoroOpenRef.current = pomodoroOpen;
  const pomodoroMorphingRef = useRef(pomodoroMorphing);
  pomodoroMorphingRef.current = pomodoroMorphing;

  // Scroll observer — moves hub + triggers state change
  useEffect(() => {
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (pomodoroOpenRef.current || pomodoroMorphingRef.current) return;
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
    if (pomodoroMorphing) return;
    if (hubState === 'capsule' && isHovered && !hoverSuppressedRef.current && !pomodoroOpen && !pomodoroMorphing) {
      const t = setTimeout(() => {
        if (!hoverSuppressedRef.current) {
          setHubState('expanded');
          expandedViaHoverRef.current = true;
        }
      }, 400);
      return () => clearTimeout(t);
    }
  }, [hubState, isHovered, pomodoroOpen, pomodoroMorphing]);

  // Auto-collapse expanded → capsule on mouse-leave (0.5s) — but ONLY for
  // expansions that were themselves triggered by hover. A tap/click-triggered
  // expansion (the only kind that exists on touch, since `isHovered` never
  // becomes true there) used to collapse ~500ms after ANY tap regardless of
  // intent, because this effect only ever checked `!isHovered`, which is
  // permanently true on touch. Dismissal for those is the tap-outside
  // handler below instead — the same interaction model as iOS's Dynamic
  // Island: tap to open, stays open until you tap elsewhere.
  const expandedViaHoverRef = useRef(false);
  const hoverSuppressedRef = useRef(false);
  useEffect(() => {
    if (hubState === 'expanded' && !isHovered && expandedViaHoverRef.current) {
      const t = setTimeout(() => {
        if (!hubRef.current?.contains(document.activeElement) && !pomodoroMorphingRef.current) setHubState('capsule');
      }, 500);
      return () => clearTimeout(t);
    }
  }, [hubState, isHovered]);

  // Tap/click outside the hub collapses it — the touch equivalent of
  // mouse-leave, and also a nice desktop shortcut (click away to dismiss
  // instead of waiting on the hover-out timeout).
  const hubRef = useRef<HTMLDivElement>(null);
  const hubSurfaceRef = useRef<HTMLDivElement>(null);
  const pomodoroSourceRef = useRef<HTMLDivElement>(null);
  const pomodoroRef = useRef<HTMLDivElement>(null);
  const hubContentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pomodoroOpenerRef = useRef<HTMLElement | null>(null);
  const pendingHubFocusRef = useRef(false);
  const keyboardFocusRef = useRef(false);
  const motionMode = useNovoMotionPolicy();
  const hubMorph = useSharedSurfaceMorph({
    surfaceRef: hubSurfaceRef,
    state: hubState,
    enabled: !pomodoroMorphing,
  });
  useEffect(() => {
    const height = pomodoroOpen || pomodoroMorphing ? hubMorph.stageSize.height : hubMorph.shape.height;
    if (pomodoroMorphing) return;
    y.set(Math.max(12, Math.min(y.get(), windowHeight - height - 12)));
  }, [hubState, windowHeight, hubMorph.stageSize.height, hubMorph.shape.height, pomodoroOpen, pomodoroMorphing, y]);

  useEffect(() => {
    if (hubState !== 'expanded' || pomodoroOpen || pomodoroMorphing) return;
    const handleOutside = (e: PointerEvent) => {
      if (hubRef.current && !hubRef.current.contains(e.target as Node)) {
        setHubState('capsule');
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [hubState, pomodoroOpen, pomodoroMorphing]);

  const openPomodoro = useCallback((keyboardActivated = false) => {
    expandedViaHoverRef.current = false;
    if (pomodoroOpenRef.current) return;
    const activeElement = document.activeElement;
    pomodoroOpenerRef.current = activeElement instanceof HTMLElement && hubContentRef.current?.contains(activeElement)
      ? activeElement
      : null;
    keyboardFocusRef.current = keyboardActivated;
    pomodoroOpenRef.current = true;
    pomodoroMorphingRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    setPomodoroMorphing(true);
    setPomodoroOpen(true);
  }, []);

  const closePomodoro = useCallback((keyboardActivated = false) => {
    if (!pomodoroOpenRef.current) return;
    keyboardFocusRef.current = keyboardActivated;
    pomodoroOpenRef.current = false;
    pomodoroMorphingRef.current = true;
    expandedViaHoverRef.current = false;
    setActiveTab('focus');
    hubContentRef.current?.style.setProperty('opacity', '0');
    setHubState('expanded');
    setPomodoroMorphing(true);
    setPomodoroOpen(false);
  }, []);

  const collapseHub = useCallback(() => {
    expandedViaHoverRef.current = false;
    pendingHubFocusRef.current = false;
    hoverSuppressedRef.current = true;
    setHubState('capsule');
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const handlePomodoroSettled = useCallback((opened: boolean) => {
    setHubState(opened ? 'capsule' : 'expanded');
    setPomodoroMorphing(false);
    requestAnimationFrame(() => {
      hubContentRef.current?.style.setProperty('opacity', '1');
      if (keyboardFocusRef.current) {
        if (opened) {
          pomodoroRef.current?.querySelector<HTMLButtonElement>('[data-pomodoro-primary]')?.focus();
        } else {
          const opener = pomodoroOpenerRef.current;
          const fallback = hubContentRef.current?.querySelector<HTMLElement>('[role="tab"]');
          (opener?.isConnected ? opener : fallback)?.focus();
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!pendingHubFocusRef.current || hubState !== 'expanded' || pomodoroOpen || pomodoroMorphing) return;
    pendingHubFocusRef.current = false;
    const frame = requestAnimationFrame(() => {
      hubContentRef.current?.querySelector<HTMLElement>('[role="tab"]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [hubState, pomodoroOpen, pomodoroMorphing]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (pomodoroOpen) closePomodoro(true);
      else if (!pomodoroMorphing && (hubState === 'expanded' || hubState === 'notification')) {
        collapseHub();
      }
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [hubState, pomodoroOpen, pomodoroMorphing, closePomodoro, collapseHub]);

  const handleClick = useCallback((keyboardActivated = false) => {
    expandedViaHoverRef.current = false;
    hoverSuppressedRef.current = false;
    if (pomodoroOpenRef.current) closePomodoro(keyboardActivated);
    else if (!pomodoroMorphingRef.current) {
      pendingHubFocusRef.current = keyboardActivated;
      setHubState('expanded');
    }
  }, [closePomodoro]);

  const handleTabChange = (nextTab: HubTab) => {
    if (nextTab === activeTab) return;
    const currentIndex = HUB_TABS.indexOf(activeTab);
    const nextIndex = HUB_TABS.indexOf(nextTab);
    setTabDirection(nextIndex > currentIndex ? 1 : -1);
    startTransition(() => setActiveTab(nextTab));
  };

  // Event handlers
  // Event handlers — pulse hub on actions, let sileo handle the notification toast
  useEffect(() => {
    const pulse = () => {
      setDopaminePulse(true);
      if (dopamineTimerRef.current) clearTimeout(dopamineTimerRef.current);
      dopamineTimerRef.current = setTimeout(() => {
        setDopaminePulse(false);
        dopamineTimerRef.current = null;
      }, 1200);
    };

    const onHabit = (e: Event) => {
      const cost = (e as CustomEvent).detail?.energyCost ?? 0.5;
      logHabit(cost);
      setHubState(cur => cur === 'idle' ? 'capsule' : cur);
      pulse();
    };
    const onTask = () => {
      setHubState(cur => cur === 'idle' ? 'capsule' : cur);
      pulse();
    };
    const onRoutine = () => {
      setHubState(cur => cur === 'idle' ? 'capsule' : cur);
      if (routineTimerRef.current) clearTimeout(routineTimerRef.current);
      routineTimerRef.current = setTimeout(() => {
        if (!pomodoroOpenRef.current && !pomodoroMorphingRef.current && !isHoveredRef.current) setHubState(cur => cur === 'capsule' ? 'idle' : cur);
        routineTimerRef.current = null;
      }, 1800);
    };
    const handleNotification = (e: Event) => {
      const detail = (e as CustomEvent).detail as TwinNotificationPayload;
      if (detail && typeof detail.title === 'string' && typeof detail.description === 'string') {
        setActiveNotification(detail);
        if (pomodoroOpenRef.current || pomodoroMorphingRef.current || hubStateRef.current === 'expanded') return;
        setHubState('notification');
        if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
        notificationTimerRef.current = setTimeout(() => {
          setCognitiveAlert(false);
          setHubState(cur => cur === 'notification' ? 'capsule' : cur);
        }, 6000);
      }
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

    window.addEventListener('habit-completed', onHabit);
    window.addEventListener('cognitive:task-completed', onTask);
    window.addEventListener('routine-opened', onRoutine);
    window.addEventListener('cognitive:notification', handleNotification);
    window.addEventListener('cognitive:navigation-warning', onNavWarn);
    return () => {
      window.removeEventListener('habit-completed', onHabit);
      window.removeEventListener('cognitive:task-completed', onTask);
      window.removeEventListener('routine-opened', onRoutine);
      window.removeEventListener('cognitive:notification', handleNotification);
      window.removeEventListener('cognitive:navigation-warning', onNavWarn);
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
      if (dopamineTimerRef.current) clearTimeout(dopamineTimerRef.current);
      if (routineTimerRef.current) clearTimeout(routineTimerRef.current);
      dopamineTimerRef.current = null;
      routineTimerRef.current = null;
    };
  }, [logHabit]);

  useEffect(() => {
    const handleAmbientAudio = (event: Event) => setAmbientAudioActive(Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active));
    window.addEventListener('cognitive:ambient-audio', handleAmbientAudio);
    return () => {
      window.removeEventListener('cognitive:ambient-audio', handleAmbientAudio);
      stopAmbientAudio();
    };
  }, []);

  // Agent Event Triggers
  useEffect(() => {
    const handlePlayMusic = () => {
      handleClick();
      setTabDirection(1);
      setActiveTab('audio');
    };
    const handleExpandHub = () => {
      handleClick();
    };
    window.addEventListener('cognitive:play-music', handlePlayMusic);
    window.addEventListener('cognitive:expand-hub', handleExpandHub);
    return () => {
      window.removeEventListener('cognitive:play-music', handlePlayMusic);
      window.removeEventListener('cognitive:expand-hub', handleExpandHub);
    };
  }, [handleClick]);

  // One real optical body, resized like the supplied HTML. Content stays crisp
  // in its own frame; no ancestor clip/filter can block the page refraction.
  return (
    <div className="fixed right-0 top-0 h-full w-screen z-[60] flex flex-col items-end justify-start pointer-events-none overflow-visible">
      <motion.div
        ref={(node) => {
          hubRef.current = node;
          hubSurfaceRef.current = node;
        }}
        data-hub-state={hubState}
        className={cn(
          "context-hub-layer pointer-events-auto select-none relative z-[2] overflow-visible border transition-colors duration-300",
          hubState === 'idle'
            ? 'bg-transparent border-white/5 cursor-pointer'
            : hubState === 'capsule' && cognitiveAlert
              ? 'bg-transparent border-indigo-500/40 cursor-pointer'
              : hubState === 'capsule'
                ? 'bg-transparent border-white/10 hover:border-white/20 cursor-pointer'
                : 'border-white/10 bg-transparent cursor-default',
          (hubState === 'capsule' || hubState === 'expanded') && dopaminePulse && 'animate-dopamine-pulse',
        )}
        // Keep the optical host in normal flow so Chromium can sample the
        // wallpaper behind the delivered displacement lens.
        style={{
          top: y,
          width: hubMorph.stageSize.width,
          height: hubMorph.stageSize.height,
          borderRadius: hubMorph.surfaceRadius,
          opacity: 1,
          boxShadow: hubState === 'idle'
            ? '0 0 0 rgba(0,0,0,0)'
            : hubState === 'expanded'
              ? '-24px 32px 72px rgba(0,0,0,0.78), inset 0 0 24px rgba(255,255,255,0.025), inset 0 1px 0 rgba(255,255,255,0.09)'
              : hubState === 'notification'
                ? '-18px 18px 48px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.10)'
                : '-10px 16px 48px rgba(0,0,0,0.62)',
        }}
        onMouseEnter={() => {
          setIsHovered(true);
          if (hubState === 'idle') setHubState('capsule');
        }}
        onMouseLeave={() => { hoverSuppressedRef.current = false; setIsHovered(false); }}
        title={hubState === 'idle' ? 'Novo Context Hub' : undefined}
      >
        <GlassSurface
          data-hub-glass
          aria-hidden
          preset="panel"
          refractive
          radius={hubMorph.surfaceRadius}
          refractivePriority="critical"
          refractiveActive
          backgroundColor="rgba(7, 13, 24, 0.58)"
          elevation={hubState === 'expanded' ? 'high' : 'medium'}
          className="pointer-events-none"
          style={{ position: 'absolute', inset: 0, zIndex: 0, borderRadius: 'inherit' }}
        />
        {(hubState === 'idle' || hubState === 'capsule') && (
          <motion.button
            ref={triggerRef}
            type="button"
            data-hub-trigger
            aria-label={pomodoroOpen ? 'Volver al Hub' : 'Abrir Hub'}
            aria-expanded={false}
            onClick={(event) => handleClick(event.detail === 0)}
            className="absolute inset-0 z-[1] min-w-11 rounded-[23px] pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60"
          />
        )}
        <div
          ref={hubContentRef}
          data-hub-content-frame
          inert={pomodoroMorphing}
          className="absolute right-0 top-0 overflow-hidden z-[2]"
          style={{
            ...hubMorph.contentStyle,
            pointerEvents: hubState === 'expanded' || hubState === 'notification' ? 'auto' : 'none',
          }}
        >
          {hubState === 'idle' && (
            <motion.div
              key="idle"
              data-hub-motion-panel
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={motionMode === 'full' ? HUB_CONTENT_SPRING : { duration: 0 }}
            >
              <GripVertical className="w-3 h-3 text-white/50" strokeWidth={1.5} />
            </motion.div>
          )}
          {hubState === 'capsule' && (
            <motion.div
              key="capsule"
              data-hub-motion-panel
              className="absolute inset-0"
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={motionMode === 'full' ? HUB_CONTENT_SPRING : { duration: 0 }}
            >
              <CapsuleContent
                cognitiveAlert={cognitiveAlert}
                ambientAudioActive={ambientAudioActive}
                focusToggleEnabled={!pomodoroOpen && !pomodoroMorphing}
                onFocusActionPointerChange={(hovered) => { hoverSuppressedRef.current = hovered; }}
              />
            </motion.div>
          )}
          {hubState === 'notification' && activeNotification && (
            <motion.div
              key="notification"
              data-hub-motion-panel
              className="absolute inset-0"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={motionMode === 'full' ? HUB_CONTENT_SPRING : { duration: 0 }}
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
          {(
            <motion.div
              key="expanded"
              data-hub-motion-panel
              aria-hidden={hubState !== 'expanded'}
              inert={hubState !== 'expanded'}
              className="absolute inset-0"
              style={{ visibility: hubState === 'expanded' ? 'visible' : 'hidden' }}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={motionMode === 'full' ? HUB_CONTENT_SPRING : { duration: 0 }}
            >
              <ExpandedContent
                onCollapse={collapseHub}
                onOpenPomodoro={openPomodoro}
                pomodoroSourceRef={pomodoroSourceRef}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                tabDirection={tabDirection}
              />
            </motion.div>
          )}
        </div>
      </motion.div>
      <PomodoroWidget
        ref={pomodoroRef}
        open={pomodoroOpen}
        animating={pomodoroMorphing}
        onClose={closePomodoro}
      />
      <PomodoroDetachMorph
        open={pomodoroOpen}
        motionMode={motionMode}
        hubRef={hubSurfaceRef}
        sourceRef={pomodoroSourceRef}
        widgetRef={pomodoroRef}
        hubContentRef={hubContentRef}
        position={y}
        stageSize={hubMorph.stageSize}
        onSettled={handlePomodoroSettled}
      />
    </div>
  );
};

export const ContextHub = React.memo(function ContextHub() {
  const pathname = usePathname();
  if (pathname?.includes('/auth') || pathname?.includes('/signin') || pathname?.includes('/welcome')) return null;
  return <ContextHubComponent />;
});
