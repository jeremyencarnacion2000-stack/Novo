'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { usePlayerStore } from '@/lib/player-store'
import { useSettings } from '@/lib/settings-context'
import { X, Play, Pause, SkipForward, SkipBack, Minimize2, Maximize2, Shuffle, Repeat, Repeat1, Volume2, VolumeX, Heart, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

interface Position {
  x: number
  y: number
}

const FloatingMusicWidgetComponent = () => {
  const pathname = usePathname()
  const isMusicPage = pathname.startsWith('/music')

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
    progress,
    isShuffle,
    toggleShuffle,
    repeatMode,
    toggleRepeat,
    deviceId
  } = usePlayerStore()

  const [isPremium, setIsPremium] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const { settings, updateSettings } = useSettings()

  const [position, setPosition] = useState<Position>({ x: 20, y: 100 })
  const initializedRef = useRef(false)
  const positionSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize position from settings only once
  useEffect(() => {
    if (!initializedRef.current && settings.preferences?.fmwPosition) {
      setPosition(settings.preferences.fmwPosition)
      initializedRef.current = true
    } else if (!initializedRef.current && typeof window !== 'undefined') {
      // Default to bottom-right corner
      setPosition({ x: window.innerWidth - 370, y: window.innerHeight - 220 })
      initializedRef.current = true
    }
  }, []) // Only run once on mount

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
    if (pathname.startsWith('/music') || isOpen) {
      checkPremium()
    }
  }, [pathname, isOpen])

  // Save position to settings (debounced, only when dragging ends)
  const savePosition = (pos: Position) => {
    if (positionSaveTimeoutRef.current) {
      clearTimeout(positionSaveTimeoutRef.current)
    }
    positionSaveTimeoutRef.current = setTimeout(() => {
      updateSettings({
        preferences: {
          ...settings.preferences,
          fmwPosition: pos
        }
      })
    }, 500) // Debounce 500ms
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMusicPage) return // Disable dragging on music page
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
    if (isDragging) {
      setIsDragging(false)
      savePosition(position) // Save position when drag ends
    }
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


  // Don't show on auth pages
  if (pathname.includes('/auth') || pathname.includes('/signin')) {
    return null
  }

  if (!isOpen || !currentTrack) {
    return null
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const duration = currentTrack?.duration_ms || 0
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0

  // --- RENDER LOGIC ---

  // 1. Free User / Embed Mode
  if (!isPremium) {
    let embedUrl: string
    if (currentPlaylist) {
      embedUrl = `https://open.spotify.com/embed/playlist/${currentPlaylist.id}?utm_source=generator&theme=0`
    } else if (currentTrack.artistId) {
      embedUrl = `https://open.spotify.com/embed/artist/${currentTrack.artistId}?utm_source=generator&theme=0`
    } else {
      embedUrl = `https://open.spotify.com/embed/track/${currentTrack.id}?utm_source=generator&theme=0`
    }

    // On Music Page: Render as fixed bottom bar
    if (isMusicPage) {
      return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[600px] h-[80px] bg-black/60 backdrop-blur-xl border border-white/10 rounded-full overflow-hidden flex items-center justify-center z-50 shadow-2xl transition-all hover:bg-black/70 hover:scale-[1.01]">
          <iframe
            src={embedUrl}
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

    // On Other Pages: Render as floating widget
    return (
      <div
        ref={widgetRef}
        onMouseDown={handleMouseDown}
        className="fixed z-50 cursor-grab active:cursor-grabbing transition-all duration-300 rounded-lg shadow-2xl"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: isMinimized ? 200 : 350,
        }}
      >
        <div className="w-full rounded-lg bg-gradient-to-br from-gray-900 to-black backdrop-blur-xl border border-white/10 overflow-hidden transition-all duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-2 bg-black/40 text-white cursor-move">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {currentTrack.image && (
                <img src={currentTrack.image} alt={currentTrack.name} className={`rounded shadow-lg transition-all duration-300 ${isMinimized ? 'h-8 w-8' : 'h-10 w-10'}`} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{currentTrack.name}</p>
                {!isMinimized && <p className="text-[10px] text-gray-400 truncate">{currentTrack.artist}</p>}
              </div>
            </div>
            {isMinimized && (
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); togglePlayPause(); }} className="h-7 w-7 text-white hover:bg-white/10 flex-shrink-0">
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/10 flex-shrink-0">
              {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleOpen} className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/10 flex-shrink-0">
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Embed */}
          <div
            className={`transition-all duration-300 ${isMinimized ? 'h-0 overflow-hidden' : 'relative'}`}
            style={isMinimized ? { position: 'absolute', width: 350, height: 152, clipPath: 'inset(100%)', pointerEvents: 'none' } : { height: 152 }}
          >
            <iframe
              src={embedUrl}
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="eager"
              className="rounded-b-none"
              style={{ borderRadius: 0 }}
            />
          </div>
        </div>
      </div>
    )
  }

  // 2. Premium User

  // On Music Page: Render as Bar (SpotifyPlayerBar style)
  if (isMusicPage) {
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
            <span className="text-white text-sm font-bold truncate">{currentTrack.name}</span>
            <span className="text-gray-400 text-xs truncate">{currentTrack.artist}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsLiked(!isLiked)} className="h-8 w-8 text-gray-400 hover:text-green-500 hover:scale-110 transition-all">
            <Heart className={cn("h-4 w-4", isLiked && "fill-green-500 text-green-500")} />
          </Button>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={toggleShuffle} className={cn("h-8 w-8 transition-colors", isShuffle ? "text-green-500" : "text-gray-400 hover:text-white")}>
            <Shuffle className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={previousTrack} className="text-white hover:text-gray-300 h-8 w-8">
            <SkipBack className="h-5 w-5 fill-current" />
          </Button>
          <Button onClick={togglePlayPause} className="w-10 h-10 rounded-full bg-white hover:bg-gray-200 hover:scale-105 transition-all flex items-center justify-center shadow-lg" disabled={!deviceId} title={!deviceId ? "Player connecting..." : "Play/Pause"}>
            {!deviceId ? <AlertCircle className="h-5 w-5 text-yellow-600" /> : isPlaying ? <Pause className="h-5 w-5 text-black fill-black" /> : <Play className="h-5 w-5 text-black fill-black ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={nextTrack} className="text-white hover:text-gray-300 h-8 w-8">
            <SkipForward className="h-5 w-5 fill-current" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleRepeat} className={cn("h-8 w-8 transition-colors", repeatMode !== 'off' ? "text-green-500" : "text-gray-400 hover:text-white")}>
            {repeatMode === 'track' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
          </Button>
        </div>

        {/* Right: Progress & Volume */}
        <div className="flex items-center gap-4 w-[180px] justify-end">
          <span className="text-xs text-gray-400 tabular-nums">{formatTime(progress)} / {formatTime(duration)}</span>
          <div className="flex items-center gap-2 group">
            <Button variant="ghost" size="icon" onClick={() => setVolume(volume === 0 ? 0.5 : 0)} className="text-gray-400 hover:text-white h-8 w-8">
              {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <div className="w-20 hidden group-hover:block transition-all">
              <Slider value={[volume * 100]} max={100} step={1} onValueChange={(value) => setVolume(value[0] / 100)} className="cursor-pointer" />
            </div>
          </div>
        </div>

        {/* Progress Bar Overlay */}
        <div className="absolute bottom-0 left-6 right-6 h-[2px] bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
    )
  }

  // On Other Pages: Render as Floating Widget
  return (
    <div
      ref={widgetRef}
      onMouseDown={handleMouseDown}
      className="fixed z-50 cursor-grab active:cursor-grabbing transition-all duration-300 rounded-lg shadow-2xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isMinimized ? 200 : 350,
      }}
    >
      <div className="w-full rounded-lg bg-black/80 backdrop-blur-xl border border-white/10 overflow-hidden transition-all duration-300 relative">
        {/* Background Blur Effect */}
        {currentTrack.image && (
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img
              src={currentTrack.image}
              alt=""
              className="w-full h-full object-cover blur-3xl opacity-30 scale-150 saturate-150"
            />
            <div className="absolute inset-0 bg-black/20" />
          </div>
        )}

        {/* Widget Header */}
        <div className="relative z-10 flex items-center justify-between p-2 bg-black/20 text-white cursor-move border-b border-white/5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {currentTrack.image && (
              <img src={currentTrack.image} alt={currentTrack.name} className={`rounded shadow-lg transition-all duration-300 ${isMinimized ? 'h-8 w-8' : 'h-10 w-10'}`} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-white shadow-black drop-shadow-md">{currentTrack.name}</p>
              {!isMinimized && <p className="text-[10px] text-gray-300 truncate shadow-black drop-shadow-md">{currentTrack.artist}</p>}
            </div>
          </div>
          {isMinimized && (
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); togglePlayPause(); }} className="h-7 w-7 text-white hover:bg-white/10 flex-shrink-0">
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/10 flex-shrink-0" title={isMinimized ? "Expandir" : "Minimizar"}>
            {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleOpen} className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/10 flex-shrink-0">
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Full mode content */}
        <div className={`relative z-10 p-4 space-y-3 transition-all duration-300 ${isMinimized ? 'h-0 opacity-0 overflow-hidden p-0' : ''}`}>
          {currentTrack.duration_ms && (
            <div className="space-y-1">
              <div className="slider-container">
                <Slider value={[progress]} max={currentTrack.duration_ms} step={1000} className="cursor-pointer" disabled />
              </div>
              <div className="flex justify-between text-xs text-gray-300 font-medium shadow-black drop-shadow-sm">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(currentTrack.duration_ms)}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon" onClick={previousTrack} disabled={!currentPlaylist} className="h-10 w-10 text-white hover:bg-white/10 disabled:opacity-30">
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button variant="default" size="icon" onClick={togglePlayPause} className="h-12 w-12 rounded-full bg-white text-black hover:bg-gray-200 hover:scale-105 transition-transform shadow-lg">
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={nextTrack} disabled={!currentPlaylist} className="h-10 w-10 text-white hover:bg-white/10 disabled:opacity-30">
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>

          <div className="slider-container flex items-center gap-2">
            <span className="text-xs text-gray-300 font-medium">Vol</span>
            <Slider value={[volume * 100]} max={100} step={1} onValueChange={(value) => setVolume(value[0] / 100)} className="flex-1" />
          </div>

          {currentPlaylist && (
            <div className="text-center pt-1 border-t border-white/10">
              <p className="text-xs text-gray-300 shadow-black drop-shadow-sm">Playing: <span className="text-white font-medium">{currentPlaylist.name}</span></p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const FloatingMusicWidget = React.memo(FloatingMusicWidgetComponent)