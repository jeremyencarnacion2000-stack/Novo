// hooks/use-sync-queue.ts
'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { flushQueue, getQueue, createOfflineFetch } from '@/lib/sync-queue'
import { useToast } from '@/hooks/use-toast'

export function useSyncQueue() {
    const { isOnline } = useOnlineStatus()
    const { toast } = useToast()
    const installedRef = useRef(false)

    // Install the offline fetch wrapper once
    useEffect(() => {
        if (installedRef.current) return
        installedRef.current = true

        if (typeof window !== 'undefined') {
            window.fetch = createOfflineFetch()
            console.log('[SyncQueue] Offline fetch wrapper installed')
        }
    }, [])

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
    }, [isOnline, flush])

    return { isOnline, pendingCount: getQueue().length }
}
