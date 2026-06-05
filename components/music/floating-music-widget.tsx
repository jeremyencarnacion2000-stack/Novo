'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { usePlayerStore } from '@/lib/player-store';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  scale: number;
  rotate: number;
}

const FloatingMusicWidgetComponent = () => {
  const pathname = usePathname();
  const isMusicPage = pathname.startsWith('/music');

  const {
    currentTrack,
    isPlaying,
    isOpen,
    togglePlayPause,
    nextTrack,
    previousTrack,
    setVolume,
    volume,
    progress,
    isReady
  } = usePlayerStore();

  // Reward triggers
  const [isRewarding, setIsRewarding] = useState(false);
  const [rewardParticles, setRewardParticles] = useState<Particle[]>([]);

  // Decoupled Global Reward Listener for instant feedback
  useEffect(() => {
    const handleHabitCompleted = () => {
      setIsRewarding(true);

      // Spawn dazzling crystal fragments
      const newParticles: Particle[] = Array.from({ length: 15 }).map((_, idx) => ({
        id: Date.now() + idx,
        x: (Math.random() - 0.5) * 220,
        y: (Math.random() - 0.5) * 160 - 30,
        scale: Math.random() * 0.75 + 0.35,
        rotate: Math.random() * 360
      }));
      setRewardParticles(newParticles);

      setTimeout(() => {
        setIsRewarding(false);
      }, 2600);

      setTimeout(() => {
        setRewardParticles([]);
      }, 1400);
    };

    window.addEventListener('habit-completed', handleHabitCompleted);
    return () => window.removeEventListener('habit-completed', handleHabitCompleted);
  }, []);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const duration = currentTrack?.duration_ms || 0;
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  // ─── MUSIC PAGE: Horizontal bottom bar player ───
  if (isMusicPage && isOpen && currentTrack) {
    return (
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[680px] h-[85px] rounded-full bg-gradient-to-r from-[#0d0f0d]/95 via-[#141a14]/95 to-[#0b0c0a]/95 backdrop-blur-2xl border border-white/10 px-8 flex items-center justify-between shadow-[0_8px_32px_rgba(16,185,129,0.15)] hover:border-emerald-500/30 transition-all overflow-hidden"
      >
        {/* Left: Track Info with Rotating Vinyl Cover */}
        <div className="flex items-center gap-4 w-[210px] relative z-10">
          <div className="relative group flex-shrink-0">
            {isPlaying && (
              <span className="absolute inset-0 rounded-full bg-emerald-500/20 blur-md scale-105 animate-pulse" />
            )}
            <div
              className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-white/10 shadow-2xl animate-[spin_20s_linear_infinite]"
              style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
            >
              <img src={currentTrack.image || '/placeholder-album.png'} alt={currentTrack.name} className="w-full h-full object-cover rounded-full" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.3)_0%,transparent_60%)] pointer-events-none rounded-full" />
              <div className="absolute inset-2 border border-white/5 rounded-full" />
              <div className="absolute inset-4 border border-black/40 rounded-full" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#0d0f0d] border border-white/20 shadow-inner flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-black" />
              </div>
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-white text-sm font-bold truncate tracking-tight">{currentTrack.name}</span>
            <span className="text-emerald-400/80 text-xs truncate font-medium">{currentTrack.artist}</span>
          </div>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-5 relative z-10">
          <Button variant="ghost" size="icon" onClick={previousTrack} className="text-white/70 hover:text-white hover:bg-white/5 h-9 w-9 rounded-full hover:scale-115 active:scale-90 transition-all duration-200">
            <SkipBack className="h-5 w-5 fill-current" />
          </Button>
          <Button
            onClick={togglePlayPause}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all duration-300 active:scale-95 border border-white/10",
              isPlaying
                ? "bg-gradient-to-tr from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                : "bg-white hover:bg-gray-100 text-black"
            )}
            disabled={!isReady}
          >
            {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={nextTrack} className="text-white/70 hover:text-white hover:bg-white/5 h-9 w-9 rounded-full hover:scale-115 active:scale-90 transition-all duration-200">
            <SkipForward className="h-5 w-5 fill-current" />
          </Button>
        </div>

        {/* Right: Time & Volume */}
        <div className="flex items-center gap-4 w-[210px] justify-end relative z-10">
          <span className="text-xs text-white/50 font-mono tracking-wider tabular-nums bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
            {formatTime(progress)} <span className="opacity-40">/</span> {formatTime(duration)}
          </span>
          <div className="flex items-center gap-2 group relative">
            <Button variant="ghost" size="icon" onClick={() => setVolume(volume === 0 ? 0.5 : 0)} className="text-white/50 hover:text-white hover:bg-white/5 h-8 w-8 rounded-full transition-colors">
              {volume === 0 ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <div className="w-20 hidden group-hover:block transition-all duration-300 ease-in-out absolute right-9 bg-[#111411]/95 border border-white/10 p-2 rounded-lg shadow-xl -top-1">
              <Slider value={[volume * 100]} max={100} step={1} onValueChange={(value) => setVolume(value[0] / 100)} className="cursor-pointer [&>[role=slider]]:bg-emerald-400" />
            </div>
          </div>
        </div>

        {/* Neon Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 transition-all duration-1000 ease-linear shadow-[0_0_8px_#10b981]" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
    );
  }

  // Render only reward particles when not on `/music` (or minimized) to avoid overlapping ContextHub
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      <AnimatePresence>
        {rewardParticles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ x: 0, y: 0, scale: 0.1, opacity: 1, rotate: 0 }}
            animate={{ x: p.x, y: p.y, scale: p.scale, opacity: 0, rotate: p.rotate }}
            exit={{ opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 190,
              damping: 13,
              mass: 0.45
            }}
            className="absolute w-3.5 h-3.5 rounded-[4px] bg-gradient-to-tr from-yellow-300 via-pink-400 to-indigo-500 border border-white/60 backdrop-blur-md shadow-[0_0_12px_rgba(236,72,153,0.5)]"
            style={{
              left: `calc(100vw - 120px)`,
              top: `50vh`
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export const FloatingMusicWidget = React.memo(FloatingMusicWidgetComponent);