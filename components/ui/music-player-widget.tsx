'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'

/**
 * Props para el componente MusicPlayerWidget
 */
interface MusicPlayerWidgetProps {
  /** URL de la imagen del álbum */
  albumImage: string
  /** Título de la canción */
  title: string
  /** Nombre del artista */
  artist: string
  /** Callback para reproducir */
  onPlay: () => void
  /** Callback para pausar */
  onPause: () => void
  /** Callback para siguiente pista */
  onNext: () => void
  /** Callback para pista anterior */
  onPrev: () => void
}

/**
 * Componente reutilizable MusicPlayerWidget
 *
 * Widget tipo tarjeta horizontal para control de reproducción de música.
 * Incluye portada del álbum, controles de reproducción y información de la canción.
 * Diseño moderno con fondo semitransparente, blur y animaciones suaves.
 *
 * @param props - Las props del componente
 * @returns El componente renderizado
 */
export function MusicPlayerWidget({
  albumImage,
  title,
  artist,
  onPlay,
  onPause,
  onNext,
  onPrev,
}: MusicPlayerWidgetProps) {
  const [isPlaying, setIsPlaying] = useState(false)

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause()
      setIsPlaying(false)
    } else {
      onPlay()
      setIsPlaying(true)
    }
  }

  return (
    <div className="flex items-center p-4 bg-white/10 backdrop-blur-md rounded-lg shadow-lg border border-white/20 w-full max-w-md">
      {/* Sección izquierda: Portada del álbum */}
      <div className="flex-shrink-0 mr-4">
        <img
          src={albumImage}
          alt={`Portada del álbum ${title}`}
          className="w-16 h-16 rounded-md object-cover"
        />
      </div>

      {/* Sección centro: Controles de reproducción */}
      <div className="flex items-center space-x-2 flex-1 justify-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrev}
          className="transition-transform hover:scale-110 active:scale-95"
          aria-label="Pista anterior"
        >
          <SkipBack className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          onClick={handlePlayPause}
          className="transition-transform hover:scale-110 active:scale-95"
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          className="transition-transform hover:scale-110 active:scale-95"
          aria-label="Siguiente pista"
        >
          <SkipForward className="h-5 w-5" />
        </Button>
      </div>

      {/* Sección derecha: Información de la canción */}
      <div className="flex-shrink-0 ml-4 text-right min-w-0 flex-1">
        <h3 className="font-bold text-sm truncate">{title}</h3>
        <p className="text-xs text-muted-foreground truncate">{artist}</p>
      </div>
    </div>
  )
}