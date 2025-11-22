import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { startSession, endSession } from '@/lib/analytics'

export function useAnalyticsSession(module: string) {
  const { data: session } = useSession()
  const sessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!session?.user?.id) return

    // Start session when component mounts
    startSession(session.user.id, module).then((newSession) => {
      if (newSession) {
        sessionIdRef.current = newSession.id
      }
    })

    // End session when component unmounts or visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden && sessionIdRef.current) {
        endSession(sessionIdRef.current)
        sessionIdRef.current = null
      } else if (!document.hidden && !sessionIdRef.current) {
        // Resume session if coming back
        startSession(session.user.id, module).then((newSession) => {
          if (newSession) {
            sessionIdRef.current = newSession.id
          }
        })
      }
    }

    const handleBeforeUnload = () => {
      if (sessionIdRef.current) {
        // Note: This might not always execute, but it's better than nothing
        navigator.sendBeacon('/api/analytics/session/end', JSON.stringify({
          sessionId: sessionIdRef.current
        }))
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (sessionIdRef.current) {
        endSession(sessionIdRef.current)
      }
    }
  }, [session?.user?.id, module])
}