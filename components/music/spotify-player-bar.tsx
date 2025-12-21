'use client'

import React, { useState, useEffect } from 'react'
import {
    Play,
    Pause,
    SkipForward,
    SkipBack,
    Shuffle,
    Repeat,
    Repeat1,
    Volume2,
    VolumeX,
    Heart,
    Maximize2,
    AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { usePlayerStore } from '@/lib/player-store'
import { cn } from '@/lib/utils'

interface SpotifyPlayerBarProps {
    onExpandNowPlaying?: () => void
    isNowPlayingExpanded?: boolean
    isPremium?: boolean
}

export function SpotifyPlayerBar({
    onExpandNowPlaying,
    isNowPlayingExpanded,
    isPremium = false
}: SpotifyPlayerBarProps) {
    const {
        currentTrack,
        isPlaying,
        togglePlayPause,
        nextTrack,
        previousTrack,
        volume,
        setVolume,
        progress,
        isShuffle,
        toggleShuffle,
        repeatMode,
        toggleRepeat,
        deviceId
    } = usePlayerStore()

    const [isLiked, setIsLiked] = useState(false)
    const [showEmbed, setShowEmbed] = useState(!isPremium)

    // Update showEmbed if isPremium changes
    useEffect(() => {
        setShowEmbed(!isPremium)
    }, [isPremium])

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000)
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const duration = currentTrack?.duration_ms || 0
    const progressPercent = duration > 0 ? (progress / duration) * 100 : 0

    if (!currentTrack) {
        return null
    }

    // Free User / Embed Mode
    if (showEmbed) {
        return (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[600px] h-[80px] bg-black/60 backdrop-blur-xl border border-white/10 rounded-full overflow-hidden flex items-center justify-center z-50 shadow-2xl transition-all hover:bg-black/70 hover:scale-[1.01]">
                <iframe
                    src={`https://open.spotify.com/embed/track/${currentTrack.id}?utm_source=generator&theme=0`}
                    width="100%"
                    height="80"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="eager"
                    className="rounded-full"
                />
            </div>
        )
    }

    // Premium User / Custom Controls
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[600px] h-[80px] bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-6 flex items-center justify-between z-50 shadow-2xl transition-all hover:bg-black/70 hover:scale-[1.01]">
            {/* Left: Track Info */}
            <div className="flex items-center gap-4 w-[180px]">
                <img
                    src={currentTrack.image || '/placeholder-album.png'}
                    alt={currentTrack.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white/10 shadow-lg animate-[spin_10s_linear_infinite]"
                    style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                />
                <div className="flex flex-col min-w-0">
                    <span className="text-white text-sm font-bold truncate">
                        {currentTrack.name}
                    </span>
                    <span className="text-gray-400 text-xs truncate">
                        {currentTrack.artist}
                    </span>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsLiked(!isLiked)}
                    className="h-8 w-8 text-gray-400 hover:text-green-500 hover:scale-110 transition-all"
                >
                    <Heart className={cn("h-4 w-4", isLiked && "fill-green-500 text-green-500")} />
                </Button>
            </div>

            {/* Center: Controls */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleShuffle}
                    className={cn(
                        "h-8 w-8 transition-colors",
                        isShuffle ? "text-green-500" : "text-gray-400 hover:text-white"
                    )}
                >
                    <Shuffle className="h-4 w-4" />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={previousTrack}
                    className="text-white hover:text-gray-300 h-8 w-8"
                >
                    <SkipBack className="h-5 w-5 fill-current" />
                </Button>

                <Button
                    onClick={togglePlayPause}
                    className="w-10 h-10 rounded-full bg-white hover:bg-gray-200 hover:scale-105 transition-all flex items-center justify-center shadow-lg"
                    disabled={!deviceId}
                    title={!deviceId ? "Player connecting..." : "Play/Pause"}
                >
                    {!deviceId ? (
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                    ) : isPlaying ? (
                        <Pause className="h-5 w-5 text-black fill-black" />
                    ) : (
                        <Play className="h-5 w-5 text-black fill-black ml-0.5" />
                    )}
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={nextTrack}
                    className="text-white hover:text-gray-300 h-8 w-8"
                >
                    <SkipForward className="h-5 w-5 fill-current" />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleRepeat}
                    className={cn(
                        "h-8 w-8 transition-colors",
                        repeatMode !== 'off' ? "text-green-500" : "text-gray-400 hover:text-white"
                    )}
                >
                    {repeatMode === 'track' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                </Button>
            </div>

            {/* Right: Progress & Volume */}
            <div className="flex items-center gap-4 w-[180px] justify-end">
                <span className="text-xs text-gray-400 tabular-nums">
                    {formatTime(progress)} / {formatTime(duration)}
                </span>

                <div className="flex items-center gap-2 group">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setVolume(volume === 0 ? 0.5 : 0)}
                        className="text-gray-400 hover:text-white h-8 w-8"
                    >
                        {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                    <div className="w-20 hidden group-hover:block transition-all">
                        <Slider
                            value={[volume * 100]}
                            max={100}
                            step={1}
                            onValueChange={(value) => setVolume(value[0] / 100)}
                            className="cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Progress Bar Overlay */}
            <div className="absolute bottom-0 left-6 right-6 h-[2px] bg-white/10 rounded-full overflow-hidden">
                <div
                    className="h-full bg-green-500 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
        </div>
    )
}
