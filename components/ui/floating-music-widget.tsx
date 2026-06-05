'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Play, Pause, SkipBack, SkipForward, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Props para el componente FloatingMusicWidget
 */
interface FloatingMusicWidgetProps {
  /** URL de la imagen del álbum */
  albumImage: string
  /** Título de la canción */
  title: string
  /** Nombre del artista */
  artist: string
  /** Estado de reproducción */
  isPlaying: boolean
  /** Callback para reproducir */
  onPlay: () => void
  /** Callback para pausar */
  onPause: () => void
  /** Callback para siguiente pista */
  onNext: () => void
  /** Callback para pista anterior */
  onPrev: () => void
  /** Callback para alternar minimizado */
  onToggleMinimize: () => void
}

/**
 * Componente FloatingMusicWidget
 *
 * Widget flotante de reproductor musical con diseño moderno y glass effect.
 * Incluye modo minimizado, drag & drop, y persistencia de estado.
 *
 * @param props - Las props del componente
 * @returns El componente renderizado
 */
export function FloatingMusicWidget({
  albumImage,
  title,
  artist,
  isPlaying,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onToggleMinimize,
}: FloatingMusicWidgetProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const widgetRef = useRef<HTMLDivElement>(null)

  // Cargar estado desde localStorage
  useEffect(() => {
    const savedMinimized = localStorage.getItem('floating-music-widget-minimized')
    const savedPosition = localStorage.getItem('floating-music-widget-position')

    if (savedMinimized !== null) {
      setIsMinimized(JSON.parse(savedMinimized))
    }
    if (savedPosition) {
      setPosition(JSON.parse(savedPosition))
    }
  }, [])

  // Guardar estado en localStorage
  useEffect(() => {
    localStorage.setItem('floating-music-widget-minimized', JSON.stringify(isMinimized))
  }, [isMinimized])

  useEffect(() => {
    localStorage.setItem('floating-music-widget-position', JSON.stringify(position))
  }, [position])

  // Manejar drag
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return

    const newX = e.clientX - dragStart.x
    const newY = e.clientY - dragStart.y

    // Mantener dentro de los límites de la ventana
    const widgetWidth = isMinimized ? 280 : 400
    const widgetHeight = isMinimized ? 60 : 80
    const maxX = window.innerWidth - widgetWidth
    const maxY = window.innerHeight - widgetHeight

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
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
  }, [isDragging, dragStart])

  const handleToggleMinimize = () => {
    setIsMinimized(!isMinimized)
    onToggleMinimize()
  }

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause()
    } else {
      onPlay()
    }
  }

  return (
    <div
      ref={widgetRef}
      className={cn(
        'fixed z-50 bg-white/10 border border-white/20 rounded-lg shadow-lg overflow-hidden transition-all duration-300 ease-in-out',
        isMinimized ? 'w-72 h-16' : 'w-96 h-20',
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      )}
      style={{
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      {isMinimized ? (
        // Modo minimizado: Barra compacta
        <div className="flex items-center justify-between p-3 h-full">
          {/* Miniatura y controles esenciales */}
          <div className="flex items-center gap-3">
            <img
              src={albumImage}
              alt={`Portada de ${title}`}
              className="w-10 h-10 rounded-md object-cover"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrev}
                className="h-8 w-8 p-0 hover:bg-white/20 transition-colors"
                aria-label="Pista anterior"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={handlePlayPause}
                className="h-8 w-8 p-0 hover:bg-white/20 transition-all duration-200 hover:scale-105"
                aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNext}
                className="h-8 w-8 p-0 hover:bg-white/20 transition-colors"
                aria-label="Siguiente pista"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Botón para expandir */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleMinimize}
            className="h-8 w-8 p-0 hover:bg-white/20 transition-colors"
            aria-label="Expandir widget"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        // Modo completo
        <div className="flex items-center p-4 h-full">
          {/* Imagen del artista/portada */}
          <div className="flex-shrink-0 mr-4">
            <img
              src={albumImage}
              alt={`Portada de ${title}`}
              className="w-16 h-16 rounded-md object-cover"
            />
          </div>

          {/* Información de la canción */}
          <div className="flex-1 min-w-0 mr-4">
            <h3 className="font-semibold text-sm truncate">{title}</h3>
            <p className="text-xs text-muted-foreground truncate">{artist}</p>
          </div>

          {/* Controles */}
          <div className="flex items-center gap-2 mr-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrev}
              className="h-8 w-8 p-0 hover:bg-white/20 transition-colors"
              aria-label="Pista anterior"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={handlePlayPause}
              className="h-8 w-8 p-0 hover:bg-white/20 transition-all duration-200 hover:scale-105"
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNext}
              className="h-8 w-8 p-0 hover:bg-white/20 transition-colors"
              aria-label="Siguiente pista"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Botón para minimizar */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleMinimize}
            className="h-8 w-8 p-0 hover:bg-white/20 transition-colors"
            aria-label="Minimizar widget"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}