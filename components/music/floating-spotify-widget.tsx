'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import Image from 'next/image'

interface Position {
  x: number
  y: number
}

export function FloatingMusicWidget() {
  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPosition] = useState<Position>({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 })
  const widgetRef = useRef<HTMLDivElement>(null)

  // Load state
  useEffect(() => {
    const savedState = localStorage.getItem('music-widget-minimized')
    const savedPosition = localStorage.getItem('music-widget-position')

    if (savedState) setIsMinimized(JSON.parse(savedState))
    if (savedPosition) setPosition(JSON.parse(savedPosition))
  }, [])

  // Save state
  useEffect(() => {
    localStorage.setItem('music-widget-minimized', JSON.stringify(isMinimized))
  }, [isMinimized])

  useEffect(() => {
    localStorage.setItem('music-widget-position', JSON.stringify(position))
  }, [position])

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

    const maxX = window.innerWidth - (isMinimized ? 200 : 320)
    const maxY = window.innerHeight - (isMinimized ? 70 : 140)

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
      className={`fixed z-50 backdrop-blur-xl bg-black/40 border border-white/10 rounded-2xl shadow-2xl transition-all duration-300 ${
        isMinimized ? 'w-[200px] h-[60px]' : 'w-[320px] h-[120px]'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* ---------------- FULL MODE ---------------- */}
      {!isMinimized && (
        <div className="flex items-center h-full p-3 gap-3">
          <div className="relative h-20 w-20 rounded-xl overflow-hidden">
            <Image
              src="/album.jpg" // coloca tu imagen
              alt="Album"
              fill
              className="object-cover"
            />
          </div>

          <div className="flex flex-col flex-1 text-white">
            <p className="font-semibold leading-tight">Astronaut In The Ocean</p>
            <p className="text-sm opacity-70">Masked Wolf</p>

            <div className="flex items-center gap-3 mt-2">
              <SkipBack className="h-5 w-5 opacity-80 hover:opacity-100 cursor-pointer" />
              <Play className="h-6 w-6 opacity-100 cursor-pointer" />
              {/* O usa <Pause /> si está en pausa */}
              <SkipForward className="h-5 w-5 opacity-80 hover:opacity-100 cursor-pointer" />
            </div>
          </div>

          <div
            className="w-2 h-full flex items-center justify-center cursor-pointer opacity-40 hover:opacity-100"
            onClick={() => setIsMinimized(true)}
          >
            <div className="w-1 h-10 bg-white/40 rounded-full"></div>
          </div>
        </div>
      )}

      {/* ---------------- MINIMIZED MODE ---------------- */}
      {isMinimized && (
        <div className="flex items-center h-full px-3 gap-3">
          <div
            className="relative h-10 w-10 rounded-md overflow-hidden cursor-pointer"
            onClick={() => setIsMinimized(false)}
          >
            <Image
              src="/album.jpg"
              alt="Album small"
              fill
              className="object-cover"
            />
          </div>

          <SkipBack className="h-4 w-4 text-white opacity-80 hover:opacity-100 cursor-pointer" />
          <Play className="h-5 w-5 text-white cursor-pointer" />
          <SkipForward className="h-4 w-4 text-white opacity-80 hover:opacity-100 cursor-pointer" />
        </div>
      )}
    </div>
  )
}
