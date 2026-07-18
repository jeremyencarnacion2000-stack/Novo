'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { startSession, endSession, trackEvent } from '@/lib/analytics'

// Map routes to module names
const routeToModule: Record<string, string> = {
    '/dashboard': 'dashboard',
    '/today': 'today',
    '/analytics': 'analytics',
    '/calendar': 'calendar',
    '/ai-assistant': 'ai-assistant',
    '/focus': 'focus',
    '/routines': 'routines',
    '/checklist': 'checklist',
    '/projects': 'projects',
    '/trackers': 'trackers',
    '/school': 'school',
    '/library': 'library',
    '/music': 'music',
    '/settings': 'settings',
}

/**
 * Hook that automatically tracks user session time on each module.
 * Should be used in the root layout or a layout wrapper.
 */
export function useSessionTracking() {
    const { data: session } = useSession()
    const pathname = usePathname()
    const sessionIdRef = useRef<string | null>(null)
    const currentModuleRef = useRef<string | null>(null)
    const [isTracking, setIsTracking] = useState(false)

    useEffect(() => {
        if (!session?.user?.id) return

        const userId = session.user.id
        const module = Object.entries(routeToModule).find(([route]) =>
            pathname?.startsWith(route)
        )?.[1] || 'unknown'

        // If module changed, end previous session and start new one
        const handleModuleChange = async () => {
            // End previous session if exists
            if (sessionIdRef.current && currentModuleRef.current !== module) {
                await endSession(sessionIdRef.current)
                sessionIdRef.current = null
            }

            // Start new session for current module
            if (!sessionIdRef.current || currentModuleRef.current !== module) {
                const newSession = await startSession(userId, module)
                if (newSession?.id) {
                    sessionIdRef.current = newSession.id
                    currentModuleRef.current = module
                    setIsTracking(true)
                }

                // Track page view event
                await trackEvent(userId, 'page_view', module)
            }
        }

        handleModuleChange()

        // End session on page unload
        const handleBeforeUnload = () => {
            if (sessionIdRef.current) {
                const blob = new Blob([JSON.stringify({
                    action: 'endSession',
                    sessionId: sessionIdRef.current
                })], { type: 'application/json' })
                navigator.sendBeacon('/api/analytics', blob)
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [session?.user?.id, pathname])

    // Clean up session on unmount
    useEffect(() => {
        return () => {
            if (sessionIdRef.current) {
                endSession(sessionIdRef.current)
            }
        }
    }, [])

    return { isTracking, currentModule: currentModuleRef.current }
}

export default useSessionTracking
