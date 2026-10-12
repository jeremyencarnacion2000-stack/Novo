// hooks/use-sync-queue.ts
'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { flushQueue, getQueue, createOfflineFetch, setSyncQueueUser, SYNC_QUEUE_CHANGE_EVENT } from '@/lib/sync-queue'
import { useToast } from '@/hooks/use-toast'
import { useSession } from 'next-auth/react'

export function useSyncQueue() {
    const { isOnline } = useOnlineStatus()
    const { toast } = useToast()
    const { data: session, status } = useSession()
    const installedRef = useRef(false)
    const originalFetchRef = useRef<typeof window.fetch | null>(null)
    const [pendingCount, setPendingCount] = useState(0)

    // Install only for an authenticated user. The queue is namespaced by this
    // id and the native fetch is restored on logout/unmount so a pending
    // mutation can never be replayed under another account.
    useEffect(() => {
        const userId = status === 'authenticated' ? session?.user?.id : null
        if (typeof window === 'undefined' || !userId) {
            setSyncQueueUser(null)
            if (installedRef.current && originalFetchRef.current) {
                window.fetch = originalFetchRef.current
                originalFetchRef.current = null
                installedRef.current = false
            }
            return
        }

        setSyncQueueUser(userId)
        if (!installedRef.current) {
            originalFetchRef.current = window.fetch
            window.fetch = createOfflineFetch({ allowAnonymousQueue: false })
            installedRef.current = true
            console.log('[SyncQueue] Offline fetch wrapper installed for authenticated user')
        }

        return () => {
            setSyncQueueUser(null)
            if (installedRef.current && originalFetchRef.current) {
                window.fetch = originalFetchRef.current
                originalFetchRef.current = null
                installedRef.current = false
            }
        }
    }, [session?.user?.id, status])

    const refreshPendingCount = useCallback(() => {
        setPendingCount(getQueue().length)
    }, [])

    // Read the queue only when its namespace or contents change. The old
    // implementation parsed localStorage on every global layout render, even
    // though most renders had nothing to do with offline mutations.
    useEffect(() => {
        if (status !== 'authenticated' || !session?.user?.id) {
            setPendingCount(0)
            return
        }

        refreshPendingCount()
        const handleQueueChange = () => refreshPendingCount()
        window.addEventListener(SYNC_QUEUE_CHANGE_EVENT, handleQueueChange)
        return () => window.removeEventListener(SYNC_QUEUE_CHANGE_EVENT, handleQueueChange)
    }, [refreshPendingCount, session?.user?.id, status])

    // Flush queue when coming back online
    const flush = useCallback(async () => {
        const queue = getQueue()
        if (queue.length === 0) return

        toast({
            title: 'Sincronizando...',
            description: `${queue.length} cambio${queue.length > 1 ? 's' : ''} pendiente${queue.length > 1 ? 's' : ''}`,
        })

        const result = await flushQueue()

        if (result.success > 0) {
            toast({
                title: '¡Sincronizado!',
                description: `${result.success} cambio${result.success > 1 ? 's' : ''} sincronizado${result.success > 1 ? 's' : ''}`,
            })
        }

        if (result.failed > 0) {
            toast({
                title: 'Sincronización parcial',
                description: `${result.failed} cambio${result.failed > 1 ? 's' : ''} aún pendiente${result.failed > 1 ? 's' : ''}`,
                variant: 'destructive',
            })
        }
    }, [toast])

    useEffect(() => {
        if (isOnline) {
            // Small delay to ensure connectivity is stable
            const timeout = setTimeout(flush, 2000)
            return () => clearTimeout(timeout)
        }
    }, [isOnline, flush, session?.user?.id, status])

    return { isOnline, pendingCount }
}
