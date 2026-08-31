'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'

const AMBIENT_REFRESH_INTERVAL_MS = 15 * 60 * 1000

/**
 * Keeps authorized context fresh while the user works outside the Dashboard.
 * The server owns the durable 15-minute throttle, so route transitions and
 * multiple tabs cannot turn this into unbounded provider polling.
 */
export function AmbientContextHeartbeat() {
  const { status } = useSession()
  const pathname = usePathname()
  const inFlight = useRef(false)

  useEffect(() => {
    if (status !== 'authenticated' || pathname === '/') return

    const refresh = () => {
      if (document.visibilityState === 'hidden' || inFlight.current) return
      inFlight.current = true
      void fetch('/api/cognitive/ambient', { cache: 'no-store' })
        .catch(() => undefined)
        .finally(() => { inFlight.current = false })
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    refresh()
    const interval = window.setInterval(refresh, AMBIENT_REFRESH_INTERVAL_MS)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [pathname, status])

  return null
}
