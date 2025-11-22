"use client"

import { useState, useEffect } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [showIndicator, setShowIndicator] = useState(false)

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine)
      setShowIndicator(true)

      // Hide indicator after 3 seconds if online
      if (navigator.onLine) {
        setTimeout(() => setShowIndicator(false), 3000)
      }
    }

    // Set initial status
    setIsOnline(navigator.onLine)

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  if (!showIndicator) return null

  return (
    <div className={cn(
      "fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300",
      isOnline
        ? "bg-green-100 text-green-800 border border-green-200"
        : "bg-red-100 text-red-800 border border-red-200"
    )}>
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4" />
          Online
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          Offline
        </>
      )}
    </div>
  )
}