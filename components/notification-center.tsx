'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X, CheckCheck, Trash2, Sparkles, Zap
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useAnimation,
} from 'framer-motion'
import { sileo, subscribeSileoBell, type BellToast } from '@/lib/sileo-bell'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { AnimatedSVGIcon, type IconState } from '@/components/ui/AnimatedSVGIcon'
import { useDragToDismiss } from '@/hooks/use-drag-to-dismiss'

// ── Mobile drag handle for notifications panel ─────────────────────────────
function MobileNotifDragHandle() {
  return (
    <div
      aria-hidden="true"
      className="flex sm:hidden justify-center pt-3 pb-1 pointer-events-none select-none shrink-0 -mx-1"
    >
      <motion.div
        className="w-10 h-[5px] rounded-full bg-foreground/20"
        whileHover={{ scaleX: 1.15, backgroundColor: 'rgba(var(--primary-rgb),0.5)' }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      />
    </div>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────
export type NotificationType =
  | 'info'
  | 'warning'
  | 'success'
  | 'suggestion'
  | 'reminder'
  | 'achievement'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  timestamp: string
  read: boolean
  icon?: string
  actionUrl?: string
  source?: string
}

// ── Icon + colour map ──────────────────────────────────────────────────────────
// Restrained 3-tone system (matches dashboard-shell's TwinInsight card:
// critical=red, warning=amber, default=foreground/primary) instead of one
// saturated hue per type — the prior 6-color rainbow was the reported
// inconsistency with the app's otherwise monochrome + accent aesthetic.
const typeConfig: Record<
  NotificationType,
  { iconState: IconState; color: string; colorHex: string; bg: string; bloom: string }
> = {
  info:        { iconState: 'sync',       color: 'text-foreground/70', colorHex: 'rgba(255,255,255,0.7)', bg: 'bg-foreground/[0.06]', bloom: 'rgba(255,255,255,0.12)' },
  warning:     { iconState: 'recovery',   color: 'text-amber-400',     colorHex: '#fbbf24',               bg: 'bg-amber-500/12',      bloom: 'rgba(245,158,11,0.22)' },
  success:     { iconState: 'execution',  color: 'text-primary',       colorHex: 'rgb(var(--primary-rgb))', bg: 'bg-primary/12',  bloom: 'rgba(var(--primary-rgb), 0.22)' },
  suggestion:  { iconState: 'prediction', color: 'text-primary',       colorHex: 'rgb(var(--primary-rgb))', bg: 'bg-primary/12',  bloom: 'rgba(var(--primary-rgb), 0.22)' },
  reminder:    { iconState: 'calendar',   color: 'text-amber-400',     colorHex: '#fbbf24',               bg: 'bg-amber-500/12',      bloom: 'rgba(245,158,11,0.22)' },
  achievement: { iconState: 'thinking',   color: 'text-primary',       colorHex: 'rgb(var(--primary-rgb))', bg: 'bg-primary/12',  bloom: 'rgba(var(--primary-rgb), 0.22)' },
}

// ── Time helper ────────────────────────────────────────────────────────────────
function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'Ahora'
  if (mins < 60) return `Hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `Hace ${hrs}h`
  return `Hace ${Math.floor(hrs / 24)}d`
}

// ── Smart notifications ────────────────────────────────────────────────────────
async function generateSmartNotifications(): Promise<AppNotification[]> {
  const notifications: AppNotification[] = []
  const now = new Date()
  const hour = now.getHours()
  // Every id below is date-scoped. "read"/"deleted" state is persisted forever
  // in localStorage by id (see loadNotifications) — a static id like
  // 'overdue-tasks' meant swiping away today's overdue-tasks notice silently
  // suppressed that entire category forever, even with completely different
  // overdue tasks next week. Stamping the day onto the id makes dismissal
  // scoped to "today's version of this notification", not the category.
  const day = now.toISOString().slice(0, 10)

  try {
    const tasksRes = await fetch('/api/tasks')
    if (tasksRes.ok) {
      const tasks = await tasksRes.json()

      const overdue = tasks.filter((t: any) =>
        t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now
      )
      if (overdue.length > 0) {
        notifications.push({
          id: `overdue-tasks-${day}`, type: 'warning', read: false,
          title: `${overdue.length} tarea${overdue.length > 1 ? 's' : ''} vencida${overdue.length > 1 ? 's' : ''}`,
          body: overdue.slice(0, 3).map((t: any) => t.title).join(', '),
          timestamp: now.toISOString(), source: 'tasks', actionUrl: '/tasks',
        })
      }

      const highPriority = tasks.filter((t: any) =>
        t.status !== 'done' && t.priority === 'high'
      )
      if (highPriority.length > 0) {
        notifications.push({
          id: `high-priority-${day}`, type: 'reminder', read: false,
          title: `${highPriority.length} tarea${highPriority.length > 1 ? 's' : ''} de prioridad alta`,
          body: highPriority.slice(0, 2).map((t: any) => t.title).join(', '),
          timestamp: now.toISOString(), source: 'tasks', actionUrl: '/tasks',
        })
      }

      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
      const completedToday = tasks.filter((t: any) =>
        t.status === 'done' && new Date(t.updatedAt) >= todayStart
      )
      if (completedToday.length >= 3) {
        notifications.push({
          id: `daily-achievement-${day}`, type: 'achievement', read: false,
          title: `${completedToday.length} tareas completadas hoy`,
          body: 'Excelente avance. Sigue enfocado.',
          timestamp: now.toISOString(), source: 'tasks',
        })
      }

      const inProgress = tasks.filter((t: any) => t.status === 'in-progress')
      if (inProgress.length > 5) {
        notifications.push({
          id: `too-many-wip-${day}`, type: 'suggestion', read: false,
          title: 'Muchas tareas en progreso',
          body: `Tienes ${inProgress.length} tareas en progreso. Enfócate en terminar algunas.`,
          timestamp: now.toISOString(), source: 'tasks',
        })
      }
    }
  } catch { /* silent */ }

  if (hour >= 6 && hour < 9) {
    notifications.push({
      id: `morning-greeting-${day}`, type: 'info', read: false,
      title: 'Buenos días',
      body: 'Revisa tu plan del día y establece tus prioridades.',
      timestamp: now.toISOString(), source: 'system', actionUrl: '/today',
    })
  } else if (hour >= 22 || hour < 3) {
    notifications.push({
      id: `night-review-${day}`, type: 'suggestion', read: false,
      title: 'Resumen del día',
      body: 'Es buen momento para revisar lo que lograste hoy.',
      timestamp: now.toISOString(), source: 'system', actionUrl: '/analytics',
    })
  }

  return notifications
}

// ── Swipeable Notification Row ─────────────────────────────────────────────────
function NotificationRow({
  notification,
  index,
  onRead,
  onDelete,
}: {
  notification: AppNotification
  index: number
  onRead: (id: string) => void
  onDelete: (id: string) => void
}) {
  const config = typeConfig[notification.type]
  const x = useMotionValue(0)
  const opacity = useTransform(x, [-160, -80, 0], [0, 0.5, 1])
  const background = useTransform(
    x,
    [-160, -60, 0],
    ['rgba(239,68,68,0.15)', 'rgba(239,68,68,0.08)', 'rgba(255,255,255,0)']
  )

  return (
    <motion.div
      key={notification.id}
      layout
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -40, scale: 0.95, transition: { duration: 0.22 } }}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 30,
        delay: index * 0.055,
      }}
      style={{ background }}
      className="relative overflow-hidden p-1"
    >
      <GlassSurface
        radius={16}
        depth={6}
        blur={1}
        strength={30}
        chromaticAberration={4}
        backgroundColor="transparent"
        className="w-full border border-foreground/[0.04]"
      >
        <motion.div
          drag="x"
          dragConstraints={{ left: -180, right: 0 }}
          dragElastic={{ left: 0.15, right: 0 }}
          style={{ x }}
          onDragEnd={(_, info) => {
            if (info.offset.x < -100) onDelete(notification.id)
            else x.set(0)
          }}
          className={`group flex gap-3 px-4 py-3.5 cursor-default select-none transition-colors hover:bg-foreground/[0.025] ${
            !notification.read ? 'bg-foreground/[0.018]' : ''
          }`}
          onClick={() => {
            onRead(notification.id)
            if (notification.actionUrl) {
              window.location.href = notification.actionUrl
            }
          }}
        >
          {/* Icon */}
          <motion.div
            className={`shrink-0 w-8 h-8 rounded-xl ${config.bg} flex items-center justify-center mt-0.5`}
            whileHover={{ scale: 1.1 }}
            style={{
              boxShadow: !notification.read ? `0 0 10px ${config.bloom}` : 'none',
            }}
          >
            <AnimatedSVGIcon state={config.iconState} size={16} color={config.colorHex} />
          </motion.div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className={`text-xs font-medium leading-snug ${
                notification.read ? 'text-foreground/45' : 'text-foreground/90'
              }`}>
                {notification.title}
              </p>
              {!notification.read && (
                <motion.div
                  className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5"
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </div>
            <p className="text-[11px] text-foreground/35 mt-0.5 leading-relaxed line-clamp-2">
              {notification.body}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[9px] text-foreground/20 uppercase tracking-wider">
                {timeAgo(notification.timestamp)}
              </span>
              {notification.source && (
                <span className="text-[9px] text-foreground/15 uppercase tracking-wider">
                  · {notification.source}
                </span>
              )}
            </div>
          </div>

          {/* Delete btn */}
          <motion.button
            onClick={(e) => { e.stopPropagation(); onDelete(notification.id) }}
            aria-label="Delete notification"
            className="shrink-0 p-1 rounded-md text-foreground/0 group-hover:text-foreground/25 hover:!text-red-400 hover:bg-red-500/15 transition-colors"
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            title="Eliminar"
          >
            <X className="w-3 h-3" />
          </motion.button>
        </motion.div>
      </GlassSurface>

      {/* Swipe-delete hint bar */}
      <motion.div
        className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-red-400/80 pointer-events-none"
        style={{ opacity: useTransform(x, [-160, -60, 0], [1, 0.4, 0]) }}
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span className="text-[10px] font-medium">eliminar</span>
      </motion.div>
    </motion.div>
  )
}


// ── Main Component ─────────────────────────────────────────────────────────────
export function NotificationCenter() {
  const { status } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [prevUnread, setPrevUnread] = useState(0)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const bellControls = useAnimation()
  const dismissPanel = useCallback(() => setIsOpen(false), [])
  const dragSurfaceRef = useDragToDismiss<HTMLDivElement>({
    onDismiss: dismissPanel,
    enabled: isOpen,
  })
  const setPanelRef = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node
    dragSurfaceRef.current = node
  }, [dragSurfaceRef])

  const unreadCount = notifications.filter(n => !n.read).length

  // Bell bounce when new unread arrives
  useEffect(() => {
    if (unreadCount > prevUnread) {
      bellControls.start({
        rotate: [0, -18, 16, -12, 8, -4, 0],
        transition: { duration: 0.65, ease: 'easeInOut' },
      })
    }
    setPrevUnread(unreadCount)
  }, [unreadCount])

  // ── Sileo morph: the bell physically expands into the incoming toast HUD ──
  // Actions (tracker completed, task created, cognitive phase change, voice
  // command result) fire `sileo` (the real npm package's API shape, bridged
  // through lib/sileo-bell) → the button itself is the notification's origin.
  const [sileoToast, setSileoToast] = useState<BellToast | null>(null)

  useEffect(() => {
    return subscribeSileoBell(toast => {
      setSileoToast(toast)
      if (toast) {
        bellControls.start({
          rotate: [0, -14, 12, -8, 4, 0],
          transition: { duration: 0.5, ease: 'easeInOut' },
        })
      }
    })
  }, [])

  const sileoColor =
    sileoToast?.type === 'success' ? '#34d399'
    : sileoToast?.type === 'warning' ? '#f59e0b'
    : sileoToast?.type === 'error' ? '#ef4444'
    : sileoToast?.type === 'action' ? '#a855f7'
    : sileoToast?.type === 'loading' ? 'rgba(255, 255, 255, 0.6)'
    : 'rgba(255, 255, 255, 0.85)'

  const sileoIconState: IconState =
    sileoToast?.type === 'success' ? 'recovery'
    : sileoToast?.type === 'warning' ? 'notification'
    : sileoToast?.type === 'error' ? 'notification'
    : sileoToast?.type === 'action' ? 'prediction'
    : sileoToast?.type === 'loading' ? 'sync'
    : 'sync'

  const lastFetchTimeRef = useRef<number>(0)
  const cachedNotificationsRef = useRef<AppNotification[]>([])

  const loadNotifications = useCallback(async (force = false) => {
    setLoading(true)
    try {
      const readIds: string[]    = JSON.parse(localStorage.getItem('novo-read-notifications')    || '[]')
      const deletedIds: string[] = JSON.parse(localStorage.getItem('novo-deleted-notifications') || '[]')
      
      let generated: AppNotification[] = []
      const now = Date.now()
      if (!force && now - lastFetchTimeRef.current < 30000 && cachedNotificationsRef.current.length > 0) {
        generated = cachedNotificationsRef.current
      } else {
        generated = await generateSmartNotifications()
        cachedNotificationsRef.current = generated
        lastFetchTimeRef.current = now
      }

      const filtered  = generated
        .filter(n => !deletedIds.includes(n.id))
        .map(n => ({ ...n, read: readIds.includes(n.id) }))
      
      setNotifications(prev => {
        if (prev.length > 0) {
          filtered.forEach(n => {
            const isNew = !prev.some(p => p.id === n.id)
            if (isNew && !n.read) {
              const options = {
                title: n.title,
                description: n.body,
                duration: 5000,
              }
              if (n.type === 'success' || n.type === 'achievement') {
                sileo.success(options)
              } else if (n.type === 'warning') {
                sileo.warning(options)
              } else if (n.type === 'reminder') {
                sileo.warning(options)
              } else {
                sileo.info(options)
              }
            }
          })
        }
        return filtered
      })
    } catch (e) {
      console.error('Failed to load notifications:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    loadNotifications()
    let interval: ReturnType<typeof setInterval> | null = setInterval(loadNotifications, 5 * 60 * 1000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadNotifications()
        if (!interval) interval = setInterval(loadNotifications, 5 * 60 * 1000)
      } else if (interval) {
        clearInterval(interval)
        interval = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (interval) clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [status, loadNotifications])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  // open-notifications custom event — fired by the mobile nav bell button
  useEffect(() => {
    const handler = () => {
      setIsOpen(true)
      loadNotifications()
    }
    window.addEventListener('open-notifications', handler)
    return () => window.removeEventListener('open-notifications', handler)
  }, [loadNotifications])

  // ── Actions ────────────────────────────────────────────────────────
  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    const ids: string[] = JSON.parse(localStorage.getItem('novo-read-notifications') || '[]')
    if (!ids.includes(id)) localStorage.setItem('novo-read-notifications', JSON.stringify([...ids, id]))
  }

  const markAllRead = () => {
    const ids = notifications.map(n => n.id)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    localStorage.setItem('novo-read-notifications', JSON.stringify(ids))
  }

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    const ids: string[] = JSON.parse(localStorage.getItem('novo-deleted-notifications') || '[]')
    if (!ids.includes(id)) localStorage.setItem('novo-deleted-notifications', JSON.stringify([...ids, id]))
  }

  const clearAll = () => {
    const ids = notifications.map(n => n.id)
    setNotifications([])
    localStorage.setItem('novo-deleted-notifications', JSON.stringify(ids))
  }

  if (status !== 'authenticated') return null

  return (
    <>
      {/* ── Bell Button — two physical phases: idle pill ↔ Sileo HUD ──── */}
      <motion.button
        ref={buttonRef as any}
        layout
        transition={{ layout: { type: 'spring', stiffness: 400, damping: 30 } }}
        onClick={() => {
          setIsOpen(prev => !prev)
          if (!isOpen) loadNotifications()
          if (sileoToast) sileo.dismiss(sileoToast.id)
        }}
        aria-label="Notifications"
        whileHover={{ scale: sileoToast ? 1.02 : 1.1 }}
        whileTap={{ scale: 0.95 }}
        className={
          sileoToast
            ? "fixed top-4 right-3 sm:right-6 z-[200] h-11 max-w-[min(360px,calc(100vw-1.5rem))] rounded-full flex items-center gap-3 pl-3 pr-4 shadow-lg"
            : "fixed top-4 right-3 sm:right-6 z-[200] size-9 rounded-full flex items-center justify-center shadow-lg"
        }
        style={{ isolation: 'isolate' }}
      >
        {/* Liquid glass background overlay */}
        <GlassSurface
          radius={9999}
          depth={4}
          blur={1}
          strength={20}
          chromaticAberration={sileoToast ? 10 : 8}
          backgroundColor="rgba(10, 10, 15, 0.35)"
          elevation="low"
          aria-hidden
          className="pointer-events-none"
          style={{ position: 'absolute', inset: 0, borderRadius: '9999px', zIndex: 0 }}
        />

        {/* Icon above glass — morphs to the toast's icon during Sileo phase */}
        <motion.div layout="position" animate={bellControls} className="relative z-10 shrink-0">
          <AnimatedSVGIcon
            state={sileoToast ? sileoIconState : 'notification'}
            size={18}
            color={sileoColor}
          />
        </motion.div>

        {/* Sileo HUD content — title + description reveal inside the capsule */}
        <AnimatePresence mode="popLayout">
          {sileoToast && (
            <motion.div
              key={sileoToast.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0, transition: { delay: 0.14, duration: 0.25 } }}
              exit={{ opacity: 0, x: 6, transition: { duration: 0.12 } }}
              className="relative z-10 flex items-center gap-2.5 min-w-0"
            >
              <div className="flex flex-col items-start min-w-0 text-left">
                <span className="text-[11px] font-semibold text-foreground/90 truncate max-w-[230px] leading-tight">
                  {sileoToast.title}
                </span>
                {sileoToast.description && (
                  <span className="text-[9px] text-foreground/45 truncate max-w-[230px] leading-tight mt-0.5">
                    {sileoToast.description}
                  </span>
                )}
              </div>
              {sileoToast.button && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    sileoToast.button!.onClick()
                    sileo.dismiss(sileoToast.id)
                  }}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground/85 text-[9px] font-semibold transition-colors cursor-pointer"
                >
                  {sileoToast.button.title}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Badge */}
        <AnimatePresence>
          {unreadCount > 0 && !sileoToast && (
            <motion.span
              key="badge"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-black/40 z-20"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Panel Portal ──────────────────────────────────────────────── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={setPanelRef}
              key="notification-panel"
              // Desktop: dropdown from top-right. Mobile: bottom sheet rising from bottom
              initial={typeof window !== 'undefined' && window.innerWidth < 640
                ? { opacity: 0, y: 32, scale: 0.97 }
                : { opacity: 0, y: -16, scale: 0.94, transformOrigin: 'top right' }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={typeof window !== 'undefined' && window.innerWidth < 640
                ? { opacity: 0, y: 24, scale: 0.97, transition: { duration: 0.22 } }
                : { opacity: 0, y: -10, scale: 0.96, transition: { duration: 0.18 } }
              }
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              // top-[188px] (not 104px): clears the Pomodoro widget's compact
              // pill (components/pomodoro-widget.tsx, `top-6 right-16`,
              // ~24-176px tall) when a focus session is active at the same
              // time notifications are opened — same fix, same reasoning as
              // lib/cognitive-context.tsx's FatigueNavigationWarning.
              className="fixed z-[201] flex flex-col overflow-hidden
                bottom-[4.5rem] left-3 right-3 rounded-3xl
                sm:bottom-auto sm:top-[188px] sm:left-auto sm:right-4 sm:w-[min(400px,calc(100vw-2rem))]
                max-h-[min(70dvh,620px)] sm:max-h-[min(620px,calc(100vh-9rem))]"
              style={{
                boxShadow: '0 -8px 40px rgba(0,0,0,0.25), 0 30px 80px rgba(0,0,0,0.55)',
              }}
            >
              {/* Backdrop blur glass shell — theme-aware, no hardcoded dark bg */}
              <div className="relative w-full flex-1 flex flex-col bg-background/92 dark:bg-[rgba(10,10,18,0.92)] backdrop-blur-2xl border border-border/20 dark:border-white/[0.07] rounded-3xl overflow-hidden max-h-[min(70dvh,620px)] sm:max-h-[min(620px,calc(100vh-5rem))]">
                {/* Subtle top shimmer line */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[1px] rounded-full pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--primary-rgb),0.4), transparent)' }}
                />
                {/* Mobile drag handle — above header */}
                <MobileNotifDragHandle />
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/[0.07] shrink-0">
                  <div className="flex items-center gap-2.5">
                    <motion.div
                      animate={{ rotate: [0, 15, -10, 5, 0] }}
                      transition={{ duration: 1.5, delay: 0.3, ease: 'easeInOut' }}
                    >
                      <AnimatedSVGIcon state="prediction" size={16} color="#a78bfa" />
                    </motion.div>
                    <h3 className="text-sm font-semibold text-foreground/90 tracking-tight">Notificaciones</h3>
                    <AnimatePresence>
                      {unreadCount > 0 && (
                        <motion.span
                          key="unread-pill"
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.7 }}
                          className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold"
                        >
                          {unreadCount} nueva{unreadCount > 1 ? 's' : ''}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <AnimatePresence>
                      {notifications.length > 0 && (
                        <motion.div
                          key="header-actions"
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          className="flex items-center gap-0.5"
                        >
                          <motion.button
                            onClick={markAllRead}
                            aria-label="Mark all as read"
                            className="p-1.5 rounded-lg hover:bg-foreground/10 text-foreground/35 hover:text-foreground/75 transition-colors"
                            whileHover={{ scale: 1.12 }}
                            whileTap={{ scale: 0.9 }}
                            title="Marcar todo como leído"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                          </motion.button>
                          <motion.button
                            onClick={clearAll}
                            aria-label="Clear all notifications"
                            className="p-1.5 rounded-lg hover:bg-red-500/15 text-foreground/35 hover:text-red-400 transition-colors"
                            whileHover={{ scale: 1.12 }}
                            whileTap={{ scale: 0.9 }}
                            title="Limpiar todo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </motion.button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <motion.button
                      onClick={() => setIsOpen(false)}
                      aria-label="Close notifications"
                      className="p-1.5 rounded-lg hover:bg-foreground/10 text-foreground/35 hover:text-foreground/75 transition-colors"
                      whileHover={{ scale: 1.12, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2" data-lenis-prevent>
                  <AnimatePresence mode="wait">
                    {loading && notifications.length === 0 ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-14 gap-3"
                      >
                        <motion.div
                          className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        />
                        <span className="text-[11px] text-foreground/25">Cargando…</span>
                      </motion.div>
                    ) : notifications.length === 0 ? (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        className="flex flex-col items-center justify-center py-14 gap-3"
                      >
                        <motion.div
                          className="w-14 h-14 rounded-2xl bg-foreground/[0.04] border border-foreground/[0.06] flex items-center justify-center"
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          <AnimatedSVGIcon state="sync" size={24} color="rgba(255,255,255,0.25)" />
                        </motion.div>
                        <div className="text-center">
                          <p className="text-xs text-foreground/30 font-medium">Todo en orden</p>
                          <p className="text-[10px] text-foreground/18 mt-0.5">Sin notificaciones pendientes</p>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="list"
                        className="flex flex-col gap-2"
                      >
                        <AnimatePresence initial={false}>
                          {notifications.map((n, i) => (
                            <NotificationRow
                              key={n.id}
                              notification={n}
                              index={i}
                              onRead={markAsRead}
                              onDelete={deleteNotification}
                            />
                          ))}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer */}
                <AnimatePresence>
                  {notifications.length > 0 && (
                    <motion.div
                      key="footer"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="px-5 py-3.5 border-t border-foreground/[0.06] shrink-0 flex items-center justify-between"
                    >
                      <p className="text-[10px] text-foreground/18">
                        Se actualiza cada 5 min
                      </p>
                      <motion.button
                        onClick={() => loadNotifications(true)}
                        className="text-[10px] text-foreground/25 hover:text-primary transition-colors flex items-center gap-1"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <motion.span
                          animate={loading ? { rotate: 360 } : { rotate: 0 }}
                          transition={loading ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : {}}
                          className="inline-block"
                        >
                          ↺
                        </motion.span>
                        Actualizar
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
