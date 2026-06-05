'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
    Bell, X, Check, CheckCheck, Trash2,
    CalendarClock, ListChecks, TrendingUp, Lightbulb,
    AlertCircle, Info, Sparkles
} from 'lucide-react'
import { useSession } from 'next-auth/react'

// ── Types ──────────────────────────────────────────────────────────
export type NotificationType = 'info' | 'warning' | 'success' | 'suggestion' | 'reminder' | 'achievement'

export interface AppNotification {
    id: string
    type: NotificationType
    title: string
    body: string
    timestamp: string
    read: boolean
    icon?: string
    actionUrl?: string
    source?: string // e.g. 'tasks', 'routines', 'ai', 'system'
}

// ── Icons per type ─────────────────────────────────────────────────
const typeConfig: Record<NotificationType, { icon: React.ElementType; color: string; bg: string }> = {
    info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/15' },
    warning: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/15' },
    success: { icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
    suggestion: { icon: Lightbulb, color: 'text-violet-400', bg: 'bg-violet-500/15' },
    reminder: { icon: CalendarClock, color: 'text-orange-400', bg: 'bg-orange-500/15' },
    achievement: { icon: TrendingUp, color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
}

// ── Helper: time ago ───────────────────────────────────────────────
function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Ahora'
    if (mins < 60) return `Hace ${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `Hace ${hrs}h`
    const days = Math.floor(hrs / 24)
    return `Hace ${days}d`
}

// ── Smart notification generator ───────────────────────────────────
async function generateSmartNotifications(): Promise<AppNotification[]> {
    const notifications: AppNotification[] = []
    const now = new Date()
    const hour = now.getHours()

    try {
        // Fetch tasks
        const tasksRes = await fetch('/api/tasks')
        if (tasksRes.ok) {
            const tasks = await tasksRes.json()

            // Overdue tasks
            const overdueTasks = tasks.filter((t: any) =>
                t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now
            )
            if (overdueTasks.length > 0) {
                notifications.push({
                    id: 'overdue-tasks',
                    type: 'warning',
                    title: `${overdueTasks.length} tarea${overdueTasks.length > 1 ? 's' : ''} vencida${overdueTasks.length > 1 ? 's' : ''}`,
                    body: overdueTasks.slice(0, 3).map((t: any) => t.title).join(', '),
                    timestamp: now.toISOString(),
                    read: false,
                    source: 'tasks',
                    actionUrl: '/tasks',
                })
            }

            // High-priority pending tasks
            const highPriority = tasks.filter((t: any) =>
                t.status !== 'done' && t.priority === 'high'
            )
            if (highPriority.length > 0) {
                notifications.push({
                    id: 'high-priority',
                    type: 'reminder',
                    title: `${highPriority.length} tarea${highPriority.length > 1 ? 's' : ''} de prioridad alta`,
                    body: highPriority.slice(0, 2).map((t: any) => t.title).join(', '),
                    timestamp: now.toISOString(),
                    read: false,
                    source: 'tasks',
                    actionUrl: '/tasks',
                })
            }

            // Completed today (achievement)
            const todayStart = new Date(now)
            todayStart.setHours(0, 0, 0, 0)
            const completedToday = tasks.filter((t: any) =>
                t.status === 'done' && new Date(t.updatedAt) >= todayStart
            )
            if (completedToday.length >= 3) {
                notifications.push({
                    id: 'daily-achievement',
                    type: 'achievement',
                    title: `¡${completedToday.length} tareas completadas hoy!`,
                    body: '¡Buen trabajo! Sigue así 💪',
                    timestamp: now.toISOString(),
                    read: false,
                    source: 'tasks',
                })
            }

            // Total in-progress count suggestion
            const inProgress = tasks.filter((t: any) => t.status === 'in-progress')
            if (inProgress.length > 5) {
                notifications.push({
                    id: 'too-many-wip',
                    type: 'suggestion',
                    title: 'Muchas tareas en progreso',
                    body: `Tienes ${inProgress.length} tareas en progreso. Intenta enfocarte en terminar algunas antes de empezar nuevas.`,
                    timestamp: now.toISOString(),
                    read: false,
                    source: 'tasks',
                })
            }
        }
    } catch (e) {
        // Silently fail for tasks
    }

    // Time-based suggestions
    if (hour >= 6 && hour < 9) {
        notifications.push({
            id: 'morning-greeting',
            type: 'info',
            title: '¡Buenos días! ☀️',
            body: 'Revisa tu plan del día y establece tus prioridades.',
            timestamp: now.toISOString(),
            read: false,
            source: 'system',
            actionUrl: '/today',
        })
    } else if (hour >= 22 || hour < 3) {
        notifications.push({
            id: 'night-review',
            type: 'suggestion',
            title: 'Resumen del día 🌙',
            body: 'Es buen momento para revisar lo que lograste hoy y planificar mañana.',
            timestamp: now.toISOString(),
            read: false,
            source: 'system',
            actionUrl: '/stats',
        })
    }

    return notifications
}

// ── Main Component ─────────────────────────────────────────────────
export function NotificationCenter() {
    const { status } = useSession()
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState<AppNotification[]>([])
    const [loading, setLoading] = useState(false)
    const panelRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    const unreadCount = notifications.filter(n => !n.read).length

    // Load notifications
    const loadNotifications = useCallback(async () => {
        setLoading(true)
        try {
            // Load persisted read state
            const readIds: string[] = JSON.parse(localStorage.getItem('novo-read-notifications') || '[]')
            const deletedIds: string[] = JSON.parse(localStorage.getItem('novo-deleted-notifications') || '[]')

            const generated = await generateSmartNotifications()
            const filtered = generated
                .filter(n => !deletedIds.includes(n.id))
                .map(n => ({ ...n, read: readIds.includes(n.id) }))

            setNotifications(filtered)
        } catch (e) {
            console.error('Failed to load notifications:', e)
        }
        setLoading(false)
    }, [])

    // Load on mount and periodically
    useEffect(() => {
        if (status !== 'authenticated') return
        loadNotifications()
        const interval = setInterval(loadNotifications, 5 * 60 * 1000) // Refresh every 5 min
        return () => clearInterval(interval)
    }, [status, loadNotifications])

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return
        const handleClick = (e: MouseEvent) => {
            if (
                panelRef.current && !panelRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [isOpen])

    const markAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
        const readIds: string[] = JSON.parse(localStorage.getItem('novo-read-notifications') || '[]')
        if (!readIds.includes(id)) {
            localStorage.setItem('novo-read-notifications', JSON.stringify([...readIds, id]))
        }
    }

    const markAllRead = () => {
        const ids = notifications.map(n => n.id)
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        localStorage.setItem('novo-read-notifications', JSON.stringify(ids))
    }

    const deleteNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id))
        const deletedIds: string[] = JSON.parse(localStorage.getItem('novo-deleted-notifications') || '[]')
        if (!deletedIds.includes(id)) {
            localStorage.setItem('novo-deleted-notifications', JSON.stringify([...deletedIds, id]))
        }
    }

    const clearAll = () => {
        const ids = notifications.map(n => n.id)
        setNotifications([])
        localStorage.setItem('novo-deleted-notifications', JSON.stringify(ids))
    }

    if (status !== 'authenticated') return null

    return (
        <>
            {/* ── Bell Button (fixed top-right) ── */}
            <button
                ref={buttonRef}
                onClick={() => {
                    setIsOpen(!isOpen)
                    if (!isOpen) loadNotifications()
                }}
                className="fixed top-4 right-4 z-[100] w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 flex items-center justify-center hover:bg-white/20 transition-all active:scale-95 shadow-lg"
                title="Notificaciones"
            >
                <Bell className="w-4.5 h-4.5 text-white/80" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-black/50 animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* ── Notification Panel ── */}
            {isOpen && createPortal(
                <div
                    ref={panelRef}
                    className="fixed top-16 right-4 z-[101] w-[min(400px,calc(100vw-2rem))] max-h-[min(600px,calc(100vh-5rem))] flex flex-col rounded-2xl bg-[#0B0B0F]/98 backdrop-blur-2xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8 shrink-0">
                        <div className="flex items-center gap-2.5">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-semibold text-white/90">Notificaciones</h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                                    {unreadCount} nueva{unreadCount > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {notifications.length > 0 && (
                                <>
                                    <button
                                        onClick={markAllRead}
                                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
                                        title="Marcar todo como leído"
                                    >
                                        <CheckCheck className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={clearAll}
                                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
                                        title="Limpiar todo"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Notification List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {loading && notifications.length === 0 ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                                    <Bell className="w-6 h-6 text-white/20" />
                                </div>
                                <p className="text-xs text-white/30 font-medium">No hay notificaciones</p>
                                <p className="text-[10px] text-white/20">Todo en orden 🎉</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {notifications.map(notification => {
                                    const config = typeConfig[notification.type]
                                    const Icon = config.icon

                                    return (
                                        <div
                                            key={notification.id}
                                            className={`group flex gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-default ${!notification.read ? 'bg-white/[0.02]' : ''
                                                }`}
                                            onClick={() => {
                                                markAsRead(notification.id)
                                                if (notification.actionUrl) {
                                                    window.location.href = notification.actionUrl
                                                    setIsOpen(false)
                                                }
                                            }}
                                        >
                                            {/* Icon */}
                                            <div className={`shrink-0 w-8 h-8 rounded-xl ${config.bg} flex items-center justify-center mt-0.5`}>
                                                <Icon className={`w-4 h-4 ${config.color}`} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-xs font-medium leading-snug ${notification.read ? 'text-white/50' : 'text-white/90'}`}>
                                                        {notification.title}
                                                    </p>
                                                    {!notification.read && (
                                                        <div className="shrink-0 w-2 h-2 rounded-full bg-primary mt-1" />
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-white/35 mt-0.5 leading-relaxed line-clamp-2">
                                                    {notification.body}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className="text-[9px] text-white/20 uppercase tracking-wider">
                                                        {timeAgo(notification.timestamp)}
                                                    </span>
                                                    {notification.source && (
                                                        <span className="text-[9px] text-white/15 uppercase tracking-wider">
                                                            · {notification.source}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Delete button (on hover) */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    deleteNotification(notification.id)
                                                }}
                                                className="shrink-0 p-1 rounded-md hover:bg-red-500/20 text-white/0 group-hover:text-white/30 hover:!text-red-400 transition-all"
                                                title="Eliminar"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-white/5 shrink-0">
                            <p className="text-[10px] text-white/20 text-center">
                                Las notificaciones se actualizan automáticamente
                            </p>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </>
    )
}
