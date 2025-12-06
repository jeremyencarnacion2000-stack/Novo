'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { usePlayerStore } from '@/lib/player-store'
import { X, Play, Pause, SkipForward, SkipBack } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

interface Position {
  x: number
  y: number
}

const FloatingMusicWidgetComponent = () => {
  const pathname = usePathname()
  const {
    currentTrack,
    isPlaying,
    isOpen,
    currentPlaylist,
    toggleOpen,
    togglePlayPause,
    nextTrack,
    previousTrack,
    setVolume,
    volume,
    progress
  } = usePlayerStore()

  const [isPremium, setIsPremium] = useState(false)
  const [position, setPosition] = useState<Position>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedPos = localStorage.getItem('fmw-position')
        if (savedPos) {
          const parsed = JSON.parse(savedPos)
          // Ensure position is within viewport
          const widgetWidth = 350
          const widgetHeight = 200
          const maxX = window.innerWidth - widgetWidth - 20
          const maxY = window.innerHeight - widgetHeight - 20
          const minY = 80 // Minimum Y to avoid overlapping header

          if (parsed.x >= 0 && parsed.x <= maxX && parsed.y >= minY && parsed.y <= maxY) {
            return parsed
          }
        }
      } catch (e) {
        console.error("Failed to parse fmw-position from localStorage", e);
      }
      // Default to bottom-right corner
      return { x: window.innerWidth - 370, y: window.innerHeight - 220 }
    }
    return { x: 20, y: 100 };
  });

  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 })
  const widgetRef = useRef<HTMLDivElement | null>(null)

  // Check if user is Premium
  useEffect(() => {
    async function checkPremium() {
      try {
        const response = await fetch('/api/spotify/has-token')
        const data = await response.json()
        setIsPremium(data.isPremium || false)
      } catch (error) {
        setIsPremium(false)
      }
    }
    checkPremium()
  }, [])

  useEffect(() => {
    localStorage.setItem('fmw-position', JSON.stringify(position))
  }, [position])

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a') || target.closest('.slider-container') || target.closest('iframe')) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    const newX = e.clientX - dragStart.x
    const newY = e.clientY - dragStart.y

    const widgetWidth = 350
    const widgetHeight = isPremium ? 250 : 180

    const maxX = Math.max(0, window.innerWidth - widgetWidth - 20)
    const maxY = Math.max(0, window.innerHeight - widgetHeight - 20)

    setPosition({
      x: Math.max(8, Math.min(newX, maxX)),
      y: Math.max(8, Math.min(newY, maxY))
    })
  }

  const handleMouseUp = () => {
    if (isDragging) setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragStart, isPremium])

  // Auto-advance for Free users (Embeds)
  useEffect(() => {
    if (isPremium || !isPlaying || !currentTrack?.duration_ms) return

    // For Free users, we can't reliably auto-advance because we don't know when the song ends in the iframe
    // The user has to manually click play in the iframe anyway.
    // So we just provide the Next button for them to manually advance.

  }, [isPremium, isPlaying, currentTrack])

  // Debug logging
  useEffect(() => {
    console.log('FloatingMusicWidget state:', {
      isOpen,
      hasCurrentTrack: !!currentTrack,
      currentTrackId: currentTrack?.id,
      isPlaying,
      isPremium
    })
  }, [isOpen, currentTrack, isPlaying, isPremium])

  if (pathname.includes('/auth') || pathname.includes('/signin')) {
    return null
  }

  if (!isOpen || !currentTrack) {
    console.log('FloatingMusicWidget hidden:', { isOpen, hasCurrentTrack: !!currentTrack })
    return null
  }

  console.log('FloatingMusicWidget rendering for track:', currentTrack.name)

  const formatTime = (ms: number) => {
    const seconds = Math.floor((ms / 1000) % 60)
    const minutes = Math.floor((ms / 1000 / 60) % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Use embed for Free users
  if (!isPremium) {
    // Add autoplay parameter - may work after user interaction
    const embedUrl = `https://open.spotify.com/embed/track/${currentTrack.id}?utm_source=generator&theme=0&autoplay=1`

    return (
      <div
        ref={widgetRef}
        onMouseDown={handleMouseDown}
        className="fixed z-50 cursor-grab active:cursor-grabbing transition-all duration-300 rounded-lg shadow-2xl"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: 350,
        }}
      >
        <div className="w-full rounded-lg bg-gradient-to-br from-gray-900 to-black backdrop-blur-xl border-2 border-white/10 overflow-hidden">
          {/* Widget Header */}
          <div className="flex items-center justify-between p-2 bg-black/40 text-white cursor-move border-b border-white/5">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {currentTrack.image && (
                <img src={currentTrack.image} alt={currentTrack.name} className="h-8 w-8 rounded shadow-lg" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{currentTrack.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{currentTrack.artist}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleOpen}
              className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/10 flex-shrink-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Spotify Embed - Key is currentTrack.id to force reload on track change */}
          <div className="relative">
            <iframe
              key={currentTrack.id}
              src={embedUrl}
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded-b-lg"
            />
          </div>

          {/* Free User Controls */}
          <div className="px-3 py-2 bg-black/20 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={previousTrack}
                disabled={!currentPlaylist}
                className="h-8 w-8 text-white hover:bg-white/10 disabled:opacity-30"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={nextTrack}
                disabled={!currentPlaylist}
                className="h-8 w-8 text-white hover:bg-white/10 disabled:opacity-30"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-gray-400 text-right flex-1 ml-2">
              {currentPlaylist ? `Playing: ${currentPlaylist.name}` : 'Spotify Free • Ads enabled'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Premium user - full controls
  return (
    <div
      ref={widgetRef}
      onMouseDown={handleMouseDown}
      className="fixed z-50 cursor-grab active:cursor-grabbing transition-all duration-300 rounded-lg shadow-2xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: 350,
      }}
    >
      <div className="w-full rounded-lg bg-gradient-to-br from-gray-900 to-black backdrop-blur-xl border-2 border-white/10 overflow-hidden">
        {/* Widget Header */}
        <div className="flex items-center justify-between p-3 bg-black/40 text-white cursor-move border-b border-white/5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {currentTrack.image && (
              <img src={currentTrack.image} alt={currentTrack.name} className="h-10 w-10 rounded shadow-lg" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{currentTrack.name}</p>
              <p className="text-xs text-gray-400 truncate">{currentTrack.artist}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleOpen}
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Player Controls */}
        <div className="p-4 space-y-3">
          {/* Progress Bar */}
          {currentTrack.duration_ms && (
            <div className="space-y-1">
              <div className="slider-container">
                <Slider
                  value={[progress]}
                  max={currentTrack.duration_ms}
                  step={1000}
                  className="cursor-pointer"
                  disabled
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(currentTrack.duration_ms)}</span>
              </div>
            </div>
          )}

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={previousTrack}
              disabled={!currentPlaylist}
              className="h-10 w-10 text-white hover:bg-white/10 disabled:opacity-30"
            >
              <SkipBack className="h-5 w-5" />
            </Button>

            <Button
              variant="default"
              size="icon"
              onClick={togglePlayPause}
              className="h-12 w-12 rounded-full bg-white text-black hover:bg-gray-200 hover:scale-105 transition-transform"
            >
              {isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6 ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={nextTrack}
              disabled={!currentPlaylist}
              className="h-10 w-10 text-white hover:bg-white/10 disabled:opacity-30"
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>

          {/* Volume Control */}
          <div className="slider-container flex items-center gap-2">
            <span className="text-xs text-gray-400">Vol</span>
            <Slider
              value={[volume * 100]}
              max={100}
              step={1}
              onValueChange={(value) => setVolume(value[0] / 100)}
              className="flex-1"
            />
          </div>

          {/* Playlist Info */}
          {currentPlaylist && (
            <div className="text-center pt-1 border-t border-white/5">
              <p className="text-xs text-gray-400">
                Playing from: <span className="text-white">{currentPlaylist.name}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const FloatingMusicWidget = React.memo(FloatingMusicWidgetComponent)