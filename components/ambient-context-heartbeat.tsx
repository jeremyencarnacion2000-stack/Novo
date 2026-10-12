'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'

const AMBIENT_REFRESH_INTERVAL_MS = 15 * 60 * 1000
const INITIAL_REFRESH_DELAY_MS = 2500

/**
 * Keeps authorized context fresh while the user works outside the Dashboard.
 * The server owns the durable 15-minute throttle, so route transitions and
 * multiple tabs cannot turn this into unbounded provider polling.
 */
export function AmbientContextHeartbeat() {
  const { status } = useSession()
  const pathname = usePathname()
  const inFlight = useRef(false)
  const shouldRun = status === 'authenticated' && pathname !== '/'

  useEffect(() => {
    if (!shouldRun) return

    const refresh = () => {
      if (document.visibilityState === 'hidden' || inFlight.current) return
      inFlight.current = true
      void fetch('/api/cognitive/ambient', { cache: 'no-store' })
        .catch(() => undefined)
        .finally(() => { inFlight.current = false })
    }

    let interval: number | null = null
    let initialTimer: number | null = window.setTimeout(() => {
      initialTimer = null
      if (document.visibilityState === 'hidden') return
      refresh()
      interval = window.setInterval(refresh, AMBIENT_REFRESH_INTERVAL_MS)
    }, INITIAL_REFRESH_DELAY_MS)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (initialTimer !== null) {
          window.clearTimeout(initialTimer)
          initialTimer = null
        }
        refresh()
        if (interval === null) interval = window.setInterval(refresh, AMBIENT_REFRESH_INTERVAL_MS)
      } else {
        if (initialTimer !== null) {
          window.clearTimeout(initialTimer)
          initialTimer = null
        }
        if (interval !== null) {
          window.clearInterval(interval)
          interval = null
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      if (initialTimer !== null) window.clearTimeout(initialTimer)
      if (interval !== null) window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [shouldRun])

  return null
}