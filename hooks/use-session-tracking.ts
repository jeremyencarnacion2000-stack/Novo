'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { startSession, endSession, trackEvent } from '@/lib/analytics'
import { createClientIdempotencyKey } from '@/lib/client-idempotency'

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
    const sessionIntentRef = useRef<{ module: string; id: string } | null>(null)
    const [isTracking, setIsTracking] = useState(false)

    useEffect(() => {
        if (!session?.user?.id) return

        const userId = session.user.id
        const module = Object.entries(routeToModule).find(([route]) =>
            pathname?.startsWith(route)
        )?.[1] || 'unknown'
        let active = true

        // Analytics is useful but never part of the first interaction. Give
        // the route and its visual shell a moment to settle before opening a
        // session or sending a page-view request.
        const handleModuleChange = async () => {
            if (!active) return

            if (sessionIdRef.current && currentModuleRef.current !== module) {
                await endSession(sessionIdRef.current)
                if (!active) return
                sessionIdRef.current = null
            }

            if (!sessionIdRef.current || currentModuleRef.current !== module) {
                const intent = sessionIntentRef.current?.module === module
                    ? sessionIntentRef.current.id
                    : createClientIdempotencyKey()
                sessionIntentRef.current = { module, id: intent }
                const newSession = await startSession(userId, module, intent)
                if (!active) return
                if (newSession?.id) {
                    sessionIdRef.current = newSession.id
                    currentModuleRef.current = module
                    sessionIntentRef.current = null
                    setIsTracking(true)
                }
                if (active) await trackEvent(userId, 'page_view', module)
            }
        }

        const startTimer = window.setTimeout(() => {
            void handleModuleChange()
        }, 1000)

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
            active = false
            window.clearTimeout(startTimer)
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [session?.user?.id, pathname] )

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
