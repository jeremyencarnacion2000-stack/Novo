'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Music,
  Volume2
} from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { useSpotifyPlayer } from '@/lib/use-spotify-player'
import { usePremiumRestrictions } from '@/lib/use-premium-restrictions'
import { useToast } from '@/hooks/use-toast'

/**
 * Default album image (ruta del archivo subido — se convertirá en URL por el entorno)
 * /mnt/data/cec31b6b-3fb4-4872-b7e4-ab8099ff8ad9.png
 */
const DEFAULT_ALBUM = '/mnt/data/cec31b6b-3fb4-4872-b7e4-ab8099ff8ad9.png'

interface FloatingMusicWidgetProps {
  // Si pasas props, el componente usará estos valores (modo SDK)
  albumImage?: string
  title?: string
  artist?: string
  isPlaying?: boolean
  onPlay?: () => void
  onPause?: () => void
  onNext?: () => void
  onPrev?: () => void
}

interface Position {
  x: number
  y: number
}

export function FloatingMusicWidget(props: FloatingMusicWidgetProps = {}) {
  const pathname = usePathname()

  // Spotify hook (usa esto por defecto si no se pasan callbacks/props)
  const { playerState, play, pause, nextTrack, previousTrack, seek, setVolume } = useSpotifyPlayer()
  const { skipLimitReached, remainingSkips } = usePremiumRestrictions()
  const { toast } = useToast()

  console.log('[FLOATING WIDGET] Hook inicializado - playerState:', playerState)

  if (pathname.includes('/auth') || pathname.includes('/signin')) {
    return null
  }

  // Datos del track (prioriza props)
  const albumImage = props.albumImage ?? playerState.currentTrack?.album?.images?.[0]?.url ?? DEFAULT_ALBUM
  const title = props.title ?? playerState.currentTrack?.name ?? 'No track'
  const artist = props.artist ?? playerState.currentTrack?.artists?.[0]?.name ?? 'Unknown artist'
  const externalIsPlaying = props.isPlaying ?? playerState.isPlaying

  // Estados: minimizado, posición y drag
  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPosition] = useState<Position>({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 })

  // Estados para sliders
  const [localPosition, setLocalPosition] = useState<number>(0)
  const [localVolume, setLocalVolume] = useState<number>(0.5)

  const widgetRef = useRef<HTMLDivElement | null>(null)

  // Cargar estado desde localStorage
  useEffect(() => {
    try {
      const savedMin = localStorage.getItem('fmw-minimized')
      const savedPos = localStorage.getItem('fmw-position')
      if (savedMin) setIsMinimized(JSON.parse(savedMin))
      if (savedPos) setPosition(JSON.parse(savedPos))
    } catch (e) {
      // ignore
    }
  }, [])

  // Guardar estado
  useEffect(() => {
    localStorage.setItem('fmw-minimized', JSON.stringify(isMinimized))
  }, [isMinimized])

  useEffect(() => {
    localStorage.setItem('fmw-position', JSON.stringify(position))
  }, [position])

  // Sincronizar estados locales con playerState
  useEffect(() => {
    setLocalPosition(playerState.position)
  }, [playerState.position])

  useEffect(() => {
    setLocalVolume(playerState.volume)
  }, [playerState.volume])


  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Solo empezar drag si el click no proviene de un control (botón)
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input') || target.closest('a')) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    const newX = e.clientX - dragStart.x
    const newY = e.clientY - dragStart.y

    // Calcular límites según modo (minimizado es más pequeño)
    const widgetWidth = isMinimized ? 200 : 520
    const widgetHeight = isMinimized ? 64 : 320
    const maxX = Math.max(0, window.innerWidth - widgetWidth)
    const maxY = Math.max(0, window.innerHeight - widgetHeight)

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
  }, [isDragging, dragStart, isMinimized])

  // Play / Pause wrappers (usar callbacks props si se pasan, sino usar spotify hook)
  const doPlay = () => {
    if (props.onPlay) return props.onPlay()
    return play()
  }
  const doPause = () => {
    if (props.onPause) return props.onPause()
    return pause()
  }
  const doNext = () => {
    if (props.onNext) return props.onNext()
    if (skipLimitReached) {
      toast({
        title: "Límite de saltos alcanzado",
        description: "Has alcanzado el límite de 6 saltos por hora. Espera a que se reinicie.",
        variant: "destructive",
      })
      return
    }
    return nextTrack()
  }
  const doPrev = () => {
    if (props.onPrev) return props.onPrev()
    if (skipLimitReached) {
      toast({
        title: "Límite de saltos alcanzado",
        description: "Has alcanzado el límite de 6 saltos por hora. Espera a que se reinicie.",
        variant: "destructive",
      })
      return
    }
    return previousTrack()
  }

  // Toggle minimizado
  const toggleMinimize = () => setIsMinimized((v) => !v)

  // UI: modo minimizado -> barra compacta; modo player -> controles de reproducción
  // Transiciones: scale + fade + slide handled by tailwind classes

  // --- RENDER MINIMIZADO ---
  if (isMinimized) {
    return (
      <div
        ref={widgetRef}
        onMouseDown={handleMouseDown}
        className="fixed z-50 cursor-grab active:cursor-grabbing transition-all duration-300"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: 200,
          height: 64
        }}
      >
        <div className="w-full h-full backdrop-blur-xl bg-white/8 border border-white/12 rounded-full px-3 flex items-center gap-3 shadow-xl">
          <div
            onClick={() => setIsMinimized(false)}
            className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 cursor-pointer"
          >
            <img src={albumImage} alt="mini album" className="object-cover w-full h-full" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{title}</div>
            <div className="text-xs text-white/70 truncate">{artist}</div>
            <div className="text-xs text-white/50">Saltos restantes: {remainingSkips}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              aria-label="previous"
              onClick={(e) => {
                e.stopPropagation()
                doPrev()
              }}
              className={`p-1 ${skipLimitReached ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={skipLimitReached}
            >
              <SkipBack className="w-4 h-4 text-white/90" />
            </button>

            <button
              aria-label="play-pause"
              onClick={(e) => {
                e.stopPropagation()
                externalIsPlaying ? doPause() : doPlay()
              }}
              className="p-1"
            >
              {externalIsPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white" />
              )}
            </button>

            <button
              aria-label="next"
              onClick={(e) => {
                e.stopPropagation()
                doNext()
              }}
              className={`p-1 ${skipLimitReached ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={skipLimitReached}
            >
              <SkipForward className="w-4 h-4 text-white/90" />
            </button>
          </div>
        </div>
 
        {/* Overlay para modo preview */}
        {playerState.isPreviewMode && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
            <div className="text-white text-lg font-semibold">
              Modo Preview: {playerState.previewTimeLeft}s restantes
            </div>
          </div>
        )}
      </div>
    )
  }

  // --- RENDER PRINCIPAL (player o selector) ---
  return (
    <div
      ref={widgetRef}
      onMouseDown={handleMouseDown}
      className="fixed z-50 transition-all duration-300"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: 520,
        height: 320
      }}
    >
      <div className="w-full h-full rounded-2xl backdrop-blur-xl bg-white/6 border border-white/12 shadow-2xl overflow-hidden flex flex-col">
        {/* TOP: controls + info */}
        <div className="flex items-center px-5 py-4 gap-4">
          <div className="w-28 h-28 rounded-xl overflow-hidden flex-shrink-0">
            <img src={albumImage} alt="album" className="object-cover w-full h-full" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white truncate">{title}</div>
                <div className="text-sm text-white/75 truncate">{artist}</div>
                <div className="text-xs text-white/50">Saltos restantes: {remainingSkips}</div>
              </div>

              <div className="flex items-center gap-2">
                {/* Small Spotify badge */}
                <div className="p-1 rounded-md bg-white/6">
                  <Music className="w-4 h-4 text-white/90" />
                </div>

                {/* Minimize control (discreto) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsMinimized(true)
                  }}
                  className="p-1 rounded-full hover:bg-white/8"
                  aria-label="minimize"
                >
                  <ChevronDown className="w-4 h-4 text-white/80" />
                </button>

              </div>
            </div>

            {/* Barra de progreso funcional */}
            <div className="mt-3">
              <Slider
                value={[localPosition]}
                max={playerState.duration || 100}
                step={1}
                onValueChange={(value) => setLocalPosition(value[0])}
                onValueCommit={(value) => seek(value[0])}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* MIDDLE: controles de reproducción */}
        <div className="flex-1 px-5 pb-5">
          <div className="h-full flex flex-col items-center justify-center gap-6">
            <div className="flex items-center gap-6">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  doPrev()
                }}
                className={`p-2 rounded-full hover:bg-white/8 ${skipLimitReached ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={skipLimitReached}
                aria-label="previous"
              >
                <SkipBack className="w-6 h-6 text-white/90" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  externalIsPlaying ? doPause() : doPlay()
                }}
                className="p-3 rounded-full bg-white/10 hover:scale-105 transition-transform"
                aria-label="play-pause"
              >
                {externalIsPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white" />}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  doNext()
                }}
                className={`p-2 rounded-full hover:bg-white/8 ${skipLimitReached ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={skipLimitReached}
                aria-label="next"
              >
                <SkipForward className="w-6 h-6 text-white/90" />
              </button>
            </div>

            {/* Barra de progreso */}
            <div className="w-full max-w-md">
              <Slider
                value={[localPosition]}
                max={playerState.duration || 100}
                step={1}
                onValueChange={(value) => setLocalPosition(value[0])}
                onValueCommit={(value) => seek(value[0])}
                className="w-full"
              />
             {/* Control de volumen */}
             <div className="flex items-center gap-2 w-full max-w-md">
               <Volume2 className="w-4 h-4 text-white/70" />
               <Slider
                 value={[localVolume]}
                 max={1}
                 step={0.01}
                 onValueChange={(value) => setLocalVolume(value[0])}
                 onValueCommit={(value) => setVolume(value[0])}
                 className="flex-1"
               />
             </div>
            </div>

            {/* Información contextual */}
            <div className="text-sm text-white/70 text-center">
              <div className="truncate w-56">{title}</div>
              <div className="truncate w-56">{artist}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
