'use client';

/**
 * ContextHub.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Lateral Hub for focus, quick capture and audio. One restrained glass material
 * and one reversible geometry controller keep its states visually connected.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePlayerStore } from '@/lib/player-store';
import { useSettings } from '@/lib/settings-context';
import { useFocus, useFocusControls } from '@/lib/focus-context';
import { useScrollContainer } from '@/lib/scroll-container-context';
import { useCognitiveState, useCognitiveDispatch } from '@/lib/cognitive-context';
import {
  Play, Pause, SkipForward, SkipBack, Plus, Waves,
  Sun, Moon, Music, Clock3, Zap,
  Brain, X, GripVertical, ArrowRight, Target, Coffee, FileText, Mic, Sparkles
} from 'lucide-react';
import {
  SiNotion, SiTodoist, SiGmail, SiGooglecalendar
} from 'react-icons/si';
import { FaSlack } from 'react-icons/fa6';
import { NovoSkeleton } from "@/components/ui/NovoSkeleton";
import { NovoEmptyState } from "@/components/ui/NovoEmptyState";
import { animate, AnimatePresence, motion, useMotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useQuickCapture } from '@/lib/quick-capture-context';
import { useNovoMotionPolicy } from '@/hooks/use-novo-motion-policy';
import { HubGlassMaterial } from '@/components/ui/hub-glass-material';
import { SHARED_SURFACE_SHAPES, useSharedSurfaceMorph } from '@/hooks/use-shared-surface-morph';
import { PomodoroDetachMorph } from '@/components/command-center-liquid-morph';
import { PomodoroWidget } from '@/components/pomodoro-widget';
import { createClientIdempotencyKey } from '@/lib/client-idempotency';
import { eventBus } from '@/lib/events/event-bus';
import { LiquidNotification } from '@/components/ui/liquid-notification';
import type { CurrentTrack } from '@/lib/player-store';

// ─── Types ───────────────────────────────────────────────────────────────────
type HubState = 'idle' | 'capsule' | 'expanded' | 'notification';
type HubTab = 'focus' | 'audio' | 'settings';

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

function NotificationContent({ notification, onDismiss }: { notification: TwinNotificationPayload; onDismiss: () => void }) {
  const router = useRouter();
  const cleanTitle = notification.title.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
  const iconClass = "h-4 w-4 text-white/80";
  const icon = notification.platform === 'notion' ? <SiNotion className={iconClass} />
    : notification.platform === 'todoist' ? <SiTodoist className={iconClass} />
    : notification.platform === 'slack' ? <FaSlack className={iconClass} />
    : notification.platform === 'gmail' ? <SiGmail className={iconClass} />
    : notification.platform === 'calendar' ? <SiGooglecalendar className={iconClass} />
    : <Brain className={iconClass} strokeWidth={1.5} />;
  return <div className="novo-hub-notice-body relative overflow-hidden rounded-[28px] text-white">
    <HubGlassMaterial priority="interactive" />
    <div className="relative z-[1] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-white/75">Novo · Twin</span>
        <button type="button" aria-label="Cerrar aviso del Twin" onClick={onDismiss} className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"><X aria-hidden="true" className="h-4 w-4" /></button>
      </div>
      <div className="mt-1 flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0"><h4 className="text-[14px] font-medium leading-snug">{cleanTitle}</h4><p className="mt-1 text-[12px] leading-relaxed text-white/80">{notification.description}</p></div>
      </div>
      {notification.actionLabel && <div className="mt-3 flex justify-end"><button type="button" onClick={() => { if (notification.actionUrl?.startsWith('/') && !notification.actionUrl.startsWith('//')) router.push(notification.actionUrl); onDismiss(); }} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white/12 px-4 text-[12px] font-medium transition-colors hover:bg-white/18">{notification.actionLabel}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></button></div>}
    </div>
  </div>;
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
          className="novo-hub-track-row flex items-center gap-2.5"
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
      <div className="novo-hub-audio-tabs flex gap-1">
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
    <div className="novo-hub-ambient">
      <div className="flex items-center justify-between mb-2">
        <p className="novo-hub-section-title flex items-center gap-1.5">
          <Waves className="w-3.5 h-3.5 text-white/70" strokeWidth={1.4} /> Ambiente
        </p>
        <span className="text-[11px] text-white/60">{activePreset ? "En reproducción" : ""}</span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {(['lluvia', 'blanco', 'cafetería'] as AmbientPreset[]).map((preset) => (
          <button
            key={preset}
            onClick={() => toggleAmbient(preset)}
            aria-pressed={activePreset === preset}
            aria-label={`${activePreset === preset ? 'Detener' : 'Activar'} sonido de ${preset}`}
            className={cn('min-h-11 rounded-xl px-1.5 py-1.5 text-[9px] font-semibold capitalize transition-[background,color,transform] duration-150 active:scale-[0.97] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70', activePreset === preset ? 'bg-white/12 text-white border border-white/15' : 'bg-black/20 text-white/80 hover:bg-white/[0.07] hover:text-white border border-transparent')}
          >
            {preset}
          </button>
        ))}
      </div>
      {error && <p role="status" className="mt-1 text-[10px] text-white/80">{error}</p>}
    </div>
  );
}

function ClockSection({ showDetails = false }: { showDetails?: boolean }) {
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const update = () => {
      if (document.visibilityState === 'hidden') return;
      setTime(new Date());
      timer = setTimeout(update, 60000 - (Date.now() % 60000));
    };
    const onVisibility = () => { if (timer) clearTimeout(timer); update(); };
    update();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
  return <div className={showDetails ? 'novo-hub-clock-details' : 'novo-hub-clock'}>
    <span className="tabular-nums">{time?.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }) ?? '—:—'}</span>
    {showDetails && <span className="novo-hub-date">{time?.toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric', month: 'short' }) ?? ' '}</span>}
  </div>;
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
  const { isActive: focusTimerActive, toggleTimer } = useFocusControls();
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  return (
    <div className="novo-hub-capsule flex h-full w-full flex-col items-center justify-between px-1 py-4">
      <div className="flex flex-col items-center gap-2 text-white/80"><Clock3 aria-hidden="true" className="h-4 w-4" strokeWidth={1.4} /><ClockSection /></div>
      <div className="flex flex-col items-center gap-1.5 text-white/70" aria-label={cognitiveAlert ? 'Alerta del Gemelo Cognitivo' : focusTimerActive ? 'Foco activo' : isPlaying || ambientAudioActive ? 'Audio activo' : 'En reposo'}>
        <span aria-hidden="true" className={cn('h-1 w-1 rounded-full', cognitiveAlert ? 'bg-amber-200' : 'bg-white/50')} />
        {focusTimerActive ? <FocusTimeText className="text-[10px] tabular-nums" /> : <span className="text-[9px]">{isPlaying || ambientAudioActive ? 'Audio' : 'Listo'}</span>}
      </div>
      {focusToggleEnabled && <button type="button" data-hub-direct-action
        aria-label={focusTimerActive ? 'Pausar temporizador' : 'Iniciar temporizador'} aria-pressed={focusTimerActive}
        onPointerEnter={() => onFocusActionPointerChange(true)} onPointerLeave={() => onFocusActionPointerChange(false)}
        onClick={(event) => { event.stopPropagation(); toggleTimer(); }}
        className="novo-hub-compact-play pointer-events-auto relative z-[3] grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60">
        {focusTimerActive ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="ml-0.5 h-4 w-4" />}
      </button>}
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
      <div className="novo-hub-session-controls flex flex-wrap items-center justify-between gap-2">
      <div className="novo-hub-timer tabular-nums"><FocusTimeText /></div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(event) => {
            if (!isActive) toggleTimer();
            onOpen(event.detail === 0);
          }}
          className="novo-hub-primary min-h-11 shrink-0 rounded-full px-5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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
      </div>
      <p className="novo-hub-focus-hint">{isModified ? 'Tu sesión está en curso' : 'Elige una tarea y comienza cuando estés listo'}</p>
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
    <div id="novo-hub-panel" role="region" aria-label="Hub de Novo" className="novo-hub-panel w-full h-full flex flex-col overflow-hidden">
      <div className="novo-hub-header">
        <div><p className="novo-hub-brand">Novo</p><p className="novo-hub-subtitle">Atención {bioState.attentionScore}%</p>
          <div role="progressbar" aria-label="Nivel de atención" aria-valuemin={0} aria-valuemax={100} aria-valuenow={bioState.attentionScore} className="sr-only" />
        </div>
        <div className="flex items-center gap-2"><ClockSection showDetails />
          <button type="button" aria-label="Contraer Hub" aria-expanded="true" onClick={onCollapse}
            className="novo-hub-icon-button grid h-11 w-11 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"><X aria-hidden="true" className="h-4 w-4" /></button>
        </div>
      </div>

      {bioState.phase === 'REDUCED_CAPACITY_MODE' && (
        <div className="novo-hub-pause-hint flex shrink-0 items-center justify-between gap-3">
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
      <div role="tablist" aria-label="Herramientas del Hub" className="novo-hub-tabs grid grid-cols-3">
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
              'novo-hub-tab relative min-h-11 text-[13px] font-medium transition-colors duration-150 motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
              activeTab === tab
                ? 'text-white'
                : 'text-white/65 hover:text-white/90'
            )}
          >
            {tab === 'focus' ? 'Foco' : tab === 'audio' ? 'Audio' : 'Ajustes'}
          </button>
        ))}
      </div>

      {/* Tab contents */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
          {activeTab === 'focus' ? (
            <motion.div
              key="focus"
              role="tabpanel" id="hub-panel-focus" aria-labelledby="hub-tab-focus"
              data-hub-motion-panel
              className="novo-hub-focus absolute inset-x-0 top-0 bottom-0 flex flex-col overflow-y-auto" data-lenis-prevent
              initial={{ opacity: 0, x: tabDirection * 12, scale: 0.988 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: tabDirection * -8, scale: 0.992 }}
              transition={reducedMotion ? { duration: 0 } : HUB_TAB_SPRING}
            >
              <div ref={pomodoroSourceRef} data-pomodoro-source className="novo-hub-focus-session">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="novo-hub-task-title">{activeTask?.text ?? 'Sin tarea seleccionada'}</p>
                    {tasks.some(task => !task.completed) && <select aria-label="Tarea de foco" value={selectedTaskId ?? ''} onChange={event => setSelectedTaskId(event.target.value || null)} className="mt-1 w-full min-h-11 rounded-lg bg-slate-900 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                      <option value="">Sin tarea seleccionada</option>
                      {tasks.filter(task => !task.completed).map(task => <option key={task.id} value={task.id}>{task.text}</option>)}
                    </select>}
                    <FocusSessionControl onOpen={onOpenPomodoro} />
                  </div>
                </div>
              </div>
              <div className="novo-hub-capture">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="novo-hub-section-title">Captura rápida</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={openQuickNote}
                      aria-label="Nueva nota"
                      className="novo-hub-capture-action inline-flex h-11 w-11 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    >
                      <FileText aria-hidden="true" className="h-3 w-3" /><span className="sr-only">Nota</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('toggle-voice-command-hub'))}
                      aria-label="Abrir comandos de voz"
                      className="novo-hub-capture-action inline-flex h-11 w-11 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    >
                      <Mic aria-hidden="true" className="h-3 w-3" /><span className="sr-only">Voz</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { onCollapse(); router.push('/ai'); }}
                      aria-label="Abrir asistente Novo"
                      className="novo-hub-capture-action inline-flex h-11 w-11 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    >
                      <Sparkles aria-hidden="true" className="h-3 w-3" /><span className="sr-only">Asistente</span>
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input aria-label="Nueva tarea" disabled={savingCapture} value={quickCapture} onChange={(event) => setQuickCapture(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void submitQuickCapture(); } }} placeholder="Añadir tarea…" className="novo-hub-capture-input min-w-0 flex-1 min-h-11 bg-transparent text-[13px] text-white placeholder:text-white/60 focus-visible:outline-none" />
                  <button type="button" disabled={savingCapture || !quickCapture.trim()} onClick={() => void submitQuickCapture()} aria-label={savingCapture ? 'Guardando tarea' : 'Guardar captura rápida'} className="w-11 h-11 shrink-0 rounded-full bg-white/10 hover:bg-white/18 text-white flex items-center justify-center disabled:opacity-40 transition-colors duration-150"><Plus className="w-3.5 h-3.5" /></button>
                </div>
                {captureStatus && <p role="status" className="mt-1 text-[10px] text-white/80">{captureStatus}</p>}
              </div>
            </motion.div>
          ) : activeTab === 'audio' ? (
            <motion.div
              key="audio"
              role="tabpanel" id="hub-panel-audio" aria-labelledby="hub-tab-audio"
              data-hub-motion-panel
              className="novo-hub-audio absolute inset-x-0 top-0 bottom-0 overflow-y-auto" data-lenis-prevent
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
              className="novo-hub-settings absolute inset-x-0 top-0 bottom-0 flex flex-col gap-3 overflow-y-auto" data-lenis-prevent
              initial={{ opacity: 0, x: tabDirection * 12, scale: 0.988 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: tabDirection * -8, scale: 0.992 }}
              transition={reducedMotion ? { duration: 0 } : HUB_TAB_SPRING}
            >
              {/* Dimness slider — controls backgroundDimness in settings */}
              <div className="novo-hub-setting p-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-medium text-white/90 flex items-center gap-1.5">
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
                    className="absolute left-0 top-1/2 h-11 w-full -translate-y-1/2 cursor-pointer appearance-none bg-transparent accent-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  />
                </div>
              </div>
              <label className="novo-hub-setting flex items-center justify-between gap-3 text-[13px] text-white/90">
                Animaciones
                <input type="checkbox" checked={settings.showAnimations} onChange={event => updateSettings({ showAnimations: event.target.checked })} className="h-5 w-5 accent-white" />
              </label>

              {/* Theme selector — toggles light/dark via settings context */}
              <div className="flex items-center justify-between novo-hub-setting p-1">
                <div>
                  <p className="text-[13px] font-medium text-white/90">Apariencia</p>
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
  const [feedbackActive, setFeedbackActive] = useState(false);
  const [activeNotification, setActiveNotification] = useState<TwinNotificationPayload | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    state: hubState === 'notification' ? 'capsule' : hubState,
    enabled: !pomodoroMorphing,
    motionMode,
  });
  useEffect(() => {
    const height = pomodoroOpen || pomodoroMorphing ? hubMorph.stageSize.height : hubMorph.shape.height;
    if (pomodoroMorphing) return;
    const target = Math.max(12, Math.min(y.get(), windowHeight - height - 12));
    if (motionMode !== 'full') { y.set(target); return; }
    const flight = animate(y, target, { type: 'spring', stiffness: 260, damping: 30 });
    return () => flight.stop();
  }, [hubState, windowHeight, hubMorph.stageSize.height, hubMorph.shape.height, pomodoroOpen, pomodoroMorphing, motionMode, y]);

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
      setFeedbackActive(true);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setFeedbackActive(false);
        feedbackTimerRef.current = null;
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
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (routineTimerRef.current) clearTimeout(routineTimerRef.current);
      feedbackTimerRef.current = null;
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
          "context-hub-layer novo-hub-shell pointer-events-auto select-none relative z-[2] overflow-visible border transition-colors duration-300",
          hubState === 'idle'
            ? 'bg-transparent border-white/5 cursor-pointer'
            : hubState === 'capsule' && cognitiveAlert
              ? 'bg-transparent border-white/20 cursor-pointer'
              : hubState === 'capsule'
                ? 'bg-transparent border-white/10 hover:border-white/20 cursor-pointer'
                : 'border-white/10 bg-transparent cursor-default',
          feedbackActive && 'novo-hub-feedback',
        )}
        // Keep the optical host in normal flow so Chromium can sample the
        // wallpaper behind the delivered displacement lens.
        style={{
          top: y,
          width: hubMorph.stageSize.width,
          height: hubMorph.stageSize.height,
          borderRadius: hubMorph.surfaceRadius,
          opacity: 1,
          boxShadow: hubState === 'idle' ? 'none' : '-8px 16px 42px rgba(0,0,0,0.3)',
        }}
        onMouseEnter={() => {
          setIsHovered(true);
          if (hubState === 'idle') setHubState('capsule');
        }}
        onMouseLeave={() => { hoverSuppressedRef.current = false; setIsHovered(false); }}
        title={hubState === 'idle' ? 'Novo Context Hub' : undefined}
      >
        <HubGlassMaterial radius={hubMorph.surfaceRadius} />
        {(hubState === 'idle' || hubState === 'capsule' || hubState === 'notification') && (
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
            width: hubMorph.stageSize.width,
            height: hubMorph.stageSize.height,
            pointerEvents: hubState === 'expanded' ? 'auto' : 'none',
          }}
        >
          <AnimatePresence initial={false}>
          {hubState === 'idle' && (
            <motion.div
              key="idle"
              data-hub-motion-panel
              className="absolute right-0 top-0 flex items-center justify-center"
              style={{ width: 12, height: 72 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={motionMode === 'full' ? HUB_CONTENT_SPRING : { duration: 0 }}
            >
              <GripVertical className="w-3 h-3 text-white/50" strokeWidth={1.5} />
            </motion.div>
          )}
          {(hubState === 'capsule' || hubState === 'notification') && (
            <motion.div
              key="capsule"
              data-hub-motion-panel
              className="absolute right-0 top-0"
              style={{ width: SHARED_SURFACE_SHAPES.capsule.width, height: SHARED_SURFACE_SHAPES.capsule.height }}
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
          </AnimatePresence>
          {(
            <motion.div
              key="expanded"
              data-hub-motion-panel
              aria-hidden={hubState !== 'expanded'}
              inert={hubState !== 'expanded'}
              className="absolute right-0 top-0"
              style={{ width: hubMorph.stageSize.width, height: hubMorph.stageSize.height, visibility: hubState === 'expanded' ? 'visible' : undefined }}
              initial={{ opacity: 0, x: 12 }}
              animate={hubState === 'expanded'
                ? { opacity: 1, x: 0, visibility: 'visible' }
                : { opacity: 0, x: 12, transitionEnd: { visibility: 'hidden' } }}
              transition={motionMode === 'full' ? { ...HUB_CONTENT_SPRING, opacity: { duration: 0.2, delay: hubState === 'expanded' ? 0.12 : 0 } } : { duration: 0 }}
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
      <LiquidNotification
        noticeKey={hubState === 'notification' && activeNotification ? `${activeNotification.title}:${activeNotification.description}` : null}
        sourceRef={hubSurfaceRef}
        sourcePosition={y}
        side="left"
        urgent={activeNotification?.severity === 'critical'}
        onDismiss={() => { setCognitiveAlert(false); setHubState('capsule'); }}
        onPresented={() => {
          if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
          notificationTimerRef.current = setTimeout(() => {
            setCognitiveAlert(false);
            setHubState(current => current === 'notification' ? 'capsule' : current);
          }, 6000);
        }}
      >
        {activeNotification && <NotificationContent notification={activeNotification} onDismiss={() => { setCognitiveAlert(false); setHubState('capsule'); }} />}
      </LiquidNotification>
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
