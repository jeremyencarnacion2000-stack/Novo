'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Heart, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react'
import { usePlayerStore } from '@/lib/player-store'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

interface NowPlayingFullscreenProps {
    open: boolean
    onClose: () => void
    onOpenQueue?: () => void
}

function formatTime(ms: number) {
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Full-screen Now Playing view (mobile-first), opened by tapping the
 * floating pill's track info. Ambient blurred-cover backdrop + large art +
 * uncluttered controls, per the visual reference. Dismiss: chevron or
 * drag-down.
 */
export function NowPlayingFullscreen({ open, onClose, onOpenQueue }: NowPlayingFullscreenProps) {
    const {
        currentTrack, isPlaying, isReady, progress,
        togglePlayPause, nextTrack, previousTrack, seekTo,
        isShuffle, toggleShuffle, repeatMode, toggleRepeat,
        toggleLike, likedTracks,
    } = usePlayerStore()

    if (!currentTrack) return null

    const duration = currentTrack.duration_ms || 0
    const isLiked = likedTracks.includes(currentTrack.id)

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                    drag="y"
                    dragConstraints={{ top: 0, bottom: 0 }}
                    dragElastic={{ top: 0, bottom: 0.5 }}
                    onDragEnd={(_, info) => { if (info.offset.y > 120) onClose() }}
                    className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[#0a0a0c]"
                >
                    {/* Ambient backdrop: blurred cover art */}
                    {currentTrack.image && (
                        <div className="absolute inset-0 pointer-events-none">
                            <img
                                src={currentTrack.image}
                                alt=""
                                aria-hidden
                                className="w-full h-full object-cover scale-150 blur-[80px] opacity-40 saturate-150"
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
                        </div>
                    )}

                    {/* Header */}
                    <div className="relative z-10 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
                        <button
                            onClick={onClose}
                            aria-label="Cerrar reproductor"
                            className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 active:scale-90 transition-transform"
                        >
                            <ChevronDown className="h-5 w-5" />
                        </button>
                        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">Reproduciendo</span>
                        {onOpenQueue ? (
                            <button
                                onClick={onOpenQueue}
                                aria-label="Ver cola"
                                className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 active:scale-90 transition-transform"
                            >
                                <ListMusic className="h-4.5 w-4.5" />
                            </button>
                        ) : (
                            <div className="h-10 w-10" aria-hidden />
                        )}
                    </div>

                    {/* Cover art */}
                    <div className="relative z-10 flex-1 flex items-center justify-center px-8 py-4 min-h-0">
                        <motion.div
                            animate={{ scale: isPlaying ? 1 : 0.92 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                            className="w-full max-w-[340px] aspect-square rounded-3xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.7)] border border-white/10"
                        >
                            {currentTrack.image ? (
                                <img src={currentTrack.image} alt={currentTrack.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                    <ListMusic className="w-16 h-16 text-white/20" />
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* Track info + like */}
                    <div className="relative z-10 px-7 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <h2 className="text-white text-xl font-bold truncate tracking-tight">{currentTrack.name}</h2>
                            <p className="text-white/50 text-sm truncate">{currentTrack.artist}</p>
                        </div>
                        <button
                            onClick={() => toggleLike(currentTrack)}
                            aria-label={isLiked ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                            className={cn(
                                'h-11 w-11 rounded-full flex items-center justify-center border transition-all active:scale-90 flex-shrink-0',
                                isLiked
                                    ? 'text-rose-400 border-rose-400/30 bg-rose-500/10'
                                    : 'text-white/50 border-white/10 bg-white/5'
                            )}
                        >
                            <Heart className={cn('h-5 w-5', isLiked && 'fill-current')} />
                        </button>
                    </div>

                    {/* Seek bar */}
                    <div className="relative z-10 px-7 mt-5">
                        <Slider
                            value={[duration > 0 ? (progress / duration) * 100 : 0]}
                            max={100}
                            step={0.1}
                            onValueChange={(v) => { if (duration > 0) seekTo((v[0] / 100) * duration) }}
                            className="cursor-pointer [&>[role=slider]]:bg-white [&>[role=slider]]:h-3.5 [&>[role=slider]]:w-3.5"
                        />
                        <div className="flex justify-between mt-1.5 text-[11px] text-white/40 font-mono tabular-nums">
                            <span>{formatTime(progress)}</span>
                            <span>-{formatTime(Math.max(0, duration - progress))}</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="relative z-10 flex items-center justify-between px-8 mt-3 pb-[max(2rem,env(safe-area-inset-bottom))]">
                        <button
                            onClick={toggleShuffle}
                            aria-label="Aleatorio"
                            className={cn('h-11 w-11 flex items-center justify-center rounded-full active:scale-90 transition-all', isShuffle ? 'text-emerald-400' : 'text-white/40')}
                        >
                            <Shuffle className="h-5 w-5" />
                        </button>
                        <button
                            onClick={previousTrack}
                            aria-label="Anterior"
                            className="h-12 w-12 flex items-center justify-center text-white active:scale-85 transition-transform"
                        >
                            <SkipBack className="h-7 w-7 fill-current" />
                        </button>
                        <button
                            onClick={togglePlayPause}
                            disabled={!isReady}
                            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
                            className="h-[72px] w-[72px] rounded-full bg-white text-black flex items-center justify-center shadow-[0_8px_40px_rgba(255,255,255,0.25)] active:scale-92 transition-transform disabled:opacity-60"
                        >
                            {isPlaying ? <Pause className="h-8 w-8 fill-current" /> : <Play className="h-8 w-8 fill-current ml-1" />}
                        </button>
                        <button
                            onClick={nextTrack}
                            aria-label="Siguiente"
                            className="h-12 w-12 flex items-center justify-center text-white active:scale-85 transition-transform"
                        >
                            <SkipForward className="h-7 w-7 fill-current" />
                        </button>
                        <button
                            onClick={toggleRepeat}
                            aria-label="Repetir"
                            className={cn('h-11 w-11 flex items-center justify-center rounded-full active:scale-90 transition-all', repeatMode !== 'off' ? 'text-emerald-400' : 'text-white/40')}
                        >
                            {repeatMode === 'track' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
