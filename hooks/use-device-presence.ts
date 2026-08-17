'use client'

import { useEffect, useRef } from 'react'

const GRACE_PERIOD_MS = 2 * 60 * 1000 // brief alt-tab shouldn't fragment one session
const MIN_SESSION_MS = 30 * 1000       // discard noise shorter than this

function isActiveNow(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus()
}

function sendSession(startedAt: number, endedAt: number) {
  if (endedAt - startedAt < MIN_SESSION_MS) return
  const payload = JSON.stringify({
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
  })
  navigator.sendBeacon('/api/device/presence', new Blob([payload], { type: 'application/json' }))
}

/**
 * Tracks real presence sessions (tab visible AND window focused) in the
 * authenticated app shell and reports each completed session to
 * /api/device/presence via sendBeacon — delivery survives tab close, unlike
 * a normal fetch, which is why this isn't a plain POST.
 */
export function useDevicePresence() {
  const sessionStartRef = useRef<number | null>(null)
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const clearGraceTimer = () => {
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current)
        graceTimerRef.current = null
      }
    }

    const endSession = () => {
      clearGraceTimer()
      if (sessionStartRef.current === null) return
      sendSession(sessionStartRef.current, Date.now())
      sessionStartRef.current = null
    }

    const startSessionIfNeeded = () => {
      if (sessionStartRef.current === null) {
        sessionStartRef.current = Date.now()
      }
      clearGraceTimer()
    }

    const handleActivityChange = () => {
      if (isActiveNow()) {
        startSessionIfNeeded()
        return
      }
      // Lost visibility or focus — wait a short grace period before treating
      // it as a real session end, so a brief alt-tab doesn't fragment one
      // continuous session into several.
      if (sessionStartRef.current !== null && !graceTimerRef.current) {
        graceTimerRef.current = setTimeout(endSession, GRACE_PERIOD_MS)
      }
    }

    const handleUnload = () => {
      // beforeunload/pagehide fire on real tab close — end immediately,
      // don't wait out the grace period which would never fire in time.
      if (sessionStartRef.current !== null) {
        sendSession(sessionStartRef.current, Date.now())
        sessionStartRef.current = null
      }
    }

    if (isActiveNow()) startSessionIfNeeded()

    document.addEventListener('visibilitychange', handleActivityChange)
    window.addEventListener('focus', handleActivityChange)
    window.addEventListener('blur', handleActivityChange)
    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleActivityChange)
      window.removeEventListener('focus', handleActivityChange)
      window.removeEventListener('blur', handleActivityChange)
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
      clearGraceTimer()
      endSession()
    }
  }, [])
}
