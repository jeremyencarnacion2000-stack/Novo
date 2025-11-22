'use client'

import { useEffect, useState } from 'react'

interface EqualizerProps {
  isPlaying: boolean
}

export function Equalizer({ isPlaying }: EqualizerProps) {
  const [bars, setBars] = useState<number[]>([20, 35, 50, 65, 80, 65, 50, 35])

  useEffect(() => {
    if (!isPlaying) {
      setBars([20, 20, 20, 20, 20, 20, 20, 20])
      return
    }

    const interval = setInterval(() => {
      setBars(prev => prev.map(() => Math.random() * 80 + 20))
    }, 150)

    return () => clearInterval(interval)
  }, [isPlaying])

  return (
    <div className="flex items-end gap-1 h-8">
      {bars.map((height, index) => (
        <div
          key={index}
          className="w-1 bg-primary rounded-sm transition-all duration-150"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  )
}