'use client'

import React from 'react'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { getQueue } from '@/lib/sync-queue'
import { WifiOff } from 'lucide-react'
import { useState, useEffect } from 'react'

export function OfflineIndicator() {
    const { isOnline } = useOnlineStatus()
    const [pendingCount, setPendingCount] = useState(0)

    useEffect(() => {
        // Update pending count periodically
        const update = () => setPendingCount(getQueue().length)
        update()
        const interval = setInterval(update, 3000)
        return () => clearInterval(interval)
    }, [])

    if (isOnline && pendingCount === 0) return null

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none md:hidden">
            <div className={`mt-[env(safe-area-inset-top,12px)] mx-4 px-4 py-2 rounded-full backdrop-blur-xl shadow-lg flex items-center gap-2 pointer-events-auto animate-in slide-in-from-top duration-300 ${isOnline ? 'bg-indigo-500/90' : 'bg-amber-500/90'
                }`}>
                <WifiOff className="h-3.5 w-3.5 text-black/70" />
                <span className="text-xs font-semibold text-black/80">
                    {isOnline
                        ? `Sincronizando ${pendingCount} cambio${pendingCount > 1 ? 's' : ''}...`
                        : pendingCount > 0
                            ? `Sin conexión · ${pendingCount} pendiente${pendingCount > 1 ? 's' : ''}`
                            : 'Sin conexión'
                    }
                </span>
            </div>
        </div>
    )
}
