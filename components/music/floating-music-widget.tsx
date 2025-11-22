'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Play, Pause, SkipBack, SkipForward, X, Minimize2 } from 'lucide-react'

interface Track {
  id: string
  name: string
  artists: { name: string }[]
  album: {
    name: string
    images: { url: string }[]
  }
  duration_ms: number
}

interface FloatingMusicWidgetProps {
  track: Track
  isPlaying: boolean
  onTogglePlay: () => void
  onClose: () => void
}

export function FloatingMusicWidget({
  track,
  isPlaying,
  onTogglePlay,
  onClose
}: FloatingMusicWidgetProps) {
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const widgetRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return

    const newX = e.clientX - dragStart.x
    const newY = e.clientY - dragStart.y

    // Keep widget within viewport bounds
    const maxX = window.innerWidth - 320
    const maxY = window.innerHeight - 120

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
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

  return (
    <div
      ref={widgetRef}
      className="fixed z-50 animate-in fade-in slide-in-from-bottom-4"
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
    >
      <Card className="w-80 shadow-lg border-2">
        <div
          className="p-3 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-3">
            <img
              src={track.album.images[0]?.url || '/placeholder.jpg'}
              alt={track.album.name}
              className="w-12 h-12 rounded"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{track.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {track.artists.map(a => a.name).join(', ')}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="px-3 pb-3">
          {/* Progress bar */}
          <div className="w-full bg-secondary rounded-full h-1 mb-3">
            <div className="bg-primary h-1 rounded-full" style={{ width: '30%' }}></div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button size="icon" className="h-8 w-8" onClick={onTogglePlay}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}