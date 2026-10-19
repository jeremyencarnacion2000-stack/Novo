'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  X, CheckCheck, Trash2, RefreshCw
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useAnimation,
} from 'framer-motion'
import { sileo, subscribeSileoBell, markSileoBellPresented, type BellToast } from '@/lib/sileo-bell'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { AnimatedSVGIcon, type IconState } from '@/components/ui/AnimatedSVGIcon'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { appleLiquidMotion } from '@/lib/design-tokens'
import { LiquidNotification } from '@/components/ui/liquid-notification'
import { useNovoMotionPolicy } from '@/hooks/use-novo-motion-policy'

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
  { iconState: IconState; color: string; colorHex: string; bg: string }
> = {
  info:        { iconState: 'sync',       color: 'text-foreground/70', colorHex: 'rgba(255,255,255,0.7)', bg: 'bg-foreground/[0.06]' },
  warning:     { iconState: 'recovery',   color: 'text-amber-400',     colorHex: '#fbbf24',               bg: 'bg-amber-500/12' },
  success:     { iconState: 'execution',  color: 'text-primary',       colorHex: 'rgb(var(--primary-rgb))', bg: 'bg-primary/12' },
  suggestion:  { iconState: 'prediction', color: 'text-primary',       colorHex: 'rgb(var(--primary-rgb))', bg: 'bg-primary/12' },
  reminder:    { iconState: 'calendar',   color: 'text-amber-400',     colorHex: '#fbbf24',               bg: 'bg-amber-500/12' },
  achievement: { iconState: 'thinking',   color: 'text-primary',       colorHex: 'rgb(var(--primary-rgb))', bg: 'bg-primary/12' },
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
      className="relative overflow-hidden rounded-[18px]"
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
        className={`group relative flex items-stretch gap-2.5 overflow-hidden rounded-[18px] border px-3.5 py-3 transition-colors ${
          notification.read
            ? 'border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.055]'
            : 'border-white/[0.11] bg-white/[0.055] hover:bg-white/[0.075]'
        }`}
      >
        <button
          type="button"
          aria-label={`${notification.title}. ${notification.read ? 'Leída' : 'No leída'}`}
          className="flex min-w-0 flex-1 items-start gap-3 text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          onClick={() => {
            onRead(notification.id)
            if (notification.actionUrl) {
              window.location.href = notification.actionUrl
            }
          }}
        >
          <motion.div
            className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[14px] ${config.bg}`}
            whileHover={{ scale: 1.1 }}
          >
            <AnimatedSVGIcon state={config.iconState} size={16} color={config.colorHex} />
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className={`text-[13px] font-semibold leading-snug ${
                notification.read ? 'text-foreground/70' : 'text-foreground/95'
              }`}>
                {notification.title}
              </p>
              {!notification.read && (
                <span
                  aria-label="Nueva"
                  className="mt-1.5 size-2 shrink-0 rounded-full bg-primary shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.12)]"
                />
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-foreground/65 line-clamp-2">
              {notification.body}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-medium text-foreground/60">
                {timeAgo(notification.timestamp)}
              </span>
              {notification.source && (
                <span className="text-[10px] text-foreground/60">
                  · {notification.source === 'tasks' ? 'Tareas' : notification.source === 'system' ? 'Sistema' : notification.source}
                </span>
              )}
            </div>
          </div>
        </button>

        <motion.button
            type="button"
            onClick={() => onDelete(notification.id)}
            aria-label={`Eliminar notificación: ${notification.title}`}
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center self-start rounded-full text-foreground/60 transition-colors hover:bg-red-500/15 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            whileHover={{ scale: appleLiquidMotion.hoverScale }}
            whileTap={{ scale: appleLiquidMotion.pressScale }}
            transition={appleLiquidMotion.pressTransition}
            title="Eliminar"
          >
            <X className="size-4" />
        </motion.button>
      </motion.div>

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
  const { data: session, status } = useSession()
  const notificationStorageKey = session?.user?.id
    ? `user:${session.user.id}`
    : null
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [prevUnread, setPrevUnread] = useState(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const bellControls = useAnimation()
  const motionMode = useNovoMotionPolicy()

  const unreadCount = notifications.filter(n => !n.read).length

  // Bell bounce when new unread arrives
  useEffect(() => {
    if (unreadCount > prevUnread && motionMode === 'full') {
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
      if (toast && motionMode === 'full') {
        bellControls.start({
          rotate: [0, -14, 12, -8, 4, 0],
          transition: { duration: 0.5, ease: 'easeInOut' },
        })
      }
    })
  }, [bellControls, motionMode])

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

  // Read/deleted markers are account-private. Clear the in-memory cache when
  // the session changes so a second account never inherits the first account's
  // notification list or unread count.
  useEffect(() => {
    setNotifications([])
    sileo.clear()
    setSileoToast(null)
    setIsOpen(false)
    setPrevUnread(0)
    cachedNotificationsRef.current = []
    lastFetchTimeRef.current = 0
  }, [notificationStorageKey])

  const loadNotifications = useCallback(async (force = false) => {
    if (!notificationStorageKey) return
    setLoading(true)
    try {
      const readIds: string[] = JSON.parse(localStorage.getItem(
        `novo-read-notifications:${notificationStorageKey}`
      ) || '[]')
      const deletedIds: string[] = JSON.parse(localStorage.getItem(
        `novo-deleted-notifications:${notificationStorageKey}`
      ) || '[]')
      
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
  }, [notificationStorageKey])

  useEffect(() => {
    if (status !== 'authenticated') return

    // Notifications enrich the shell but are not needed to paint or interact
    // with the current route. Delay the first task scan so the bell does not
    // compete with route data, glass setup and the first user gesture.
    let interval: ReturnType<typeof setInterval> | null = null
    let initialTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      initialTimer = null
      void loadNotifications()
      interval = setInterval(loadNotifications, 5 * 60 * 1000)
    }, 1800)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (initialTimer) {
          clearTimeout(initialTimer)
          initialTimer = null
        }
        void loadNotifications()
        if (!interval) interval = setInterval(loadNotifications, 5 * 60 * 1000)
      } else {
        if (initialTimer) {
          clearTimeout(initialTimer)
          initialTimer = null
        }
        if (interval) {
          clearInterval(interval)
          interval = null
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (initialTimer) clearTimeout(initialTimer)
      if (interval) clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [status, loadNotifications])

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
    if (!notificationStorageKey) return
    const key = `novo-read-notifications:${notificationStorageKey}`
    const ids: string[] = JSON.parse(localStorage.getItem(key) || '[]')
    if (!ids.includes(id)) localStorage.setItem(key, JSON.stringify([...ids, id]))
  }

  const markAllRead = () => {
    const ids = notifications.map(n => n.id)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    if (notificationStorageKey) {
      localStorage.setItem(`novo-read-notifications:${notificationStorageKey}`, JSON.stringify(ids))
    }
  }

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (!notificationStorageKey) return
    const key = `novo-deleted-notifications:${notificationStorageKey}`
    const ids: string[] = JSON.parse(localStorage.getItem(key) || '[]')
    if (!ids.includes(id)) localStorage.setItem(key, JSON.stringify([...ids, id]))
  }

  const clearAll = () => {
    const ids = notifications.map(n => n.id)
    setNotifications([])
    if (notificationStorageKey) {
      localStorage.setItem(`novo-deleted-notifications:${notificationStorageKey}`, JSON.stringify(ids))
    }
  }

  if (status !== 'authenticated') return null

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        setIsOpen(nextOpen)
        if (nextOpen) loadNotifications()
      }}
    >
      {/* The bell stays available while its notice detaches and returns. */}
      <motion.button
        ref={buttonRef as any}
        data-flip-from="notifications"
        transition={appleLiquidMotion.pressTransition}
        onClick={() => {
          setIsOpen(prev => !prev)
          if (!isOpen) loadNotifications()
          if (sileoToast) sileo.dismiss(sileoToast.id)
        }}
        aria-label="Notificaciones"
        whileHover={{ scale: appleLiquidMotion.hoverScale }}
        whileTap={{ scale: appleLiquidMotion.pressScale }}
        className="fixed top-4 right-3 sm:right-6 z-[200] size-9 rounded-full flex items-center justify-center shadow-lg"
        style={{ isolation: 'isolate' }}
      >
        {/* Liquid glass background overlay */}
        <GlassSurface
          preset={sileoToast ? "status" : "control"}
          refractive
          refractivePriority={sileoToast ? "critical" : "interactive"}
          refractiveActive={Boolean(sileoToast || isOpen)}
          backgroundColor="rgba(10, 10, 15, 0.35)"
          elevation="low"
          aria-hidden
          className="pointer-events-none"
          style={{ position: 'absolute', inset: 0, borderRadius: '9999px', zIndex: 0 }}
        />

        {/* Icon above glass — morphs to the toast's icon during Sileo phase */}
        <motion.div animate={bellControls} className="relative z-10 shrink-0">
          <AnimatedSVGIcon
            state={sileoToast ? sileoIconState : 'notification'}
            size={18}
            color={sileoColor}
          />
        </motion.div>

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

      <LiquidNotification key={notificationStorageKey} noticeKey={sileoToast?.id ?? null} sourceRef={buttonRef} onDismiss={() => sileo.dismiss(sileoToast?.id)} onPresented={() => { if (sileoToast) markSileoBellPresented(sileoToast.id) }} urgent={sileoToast?.type === 'error'}>
        {sileoToast && (
          <div className="flex items-start gap-3 p-4">
            <div className="mt-1 shrink-0 rounded-full bg-foreground/5 p-2">
              <AnimatedSVGIcon state={sileoIconState} size={20} color={sileoColor} />
            </div>
            <div className="min-w-0 flex-1 py-1">
              <p className="text-sm font-semibold leading-snug">{sileoToast.title}</p>
              {sileoToast.description && <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{sileoToast.description}</div>}
              {sileoToast.button && (
                <button type="button" onClick={() => { sileoToast.button!.onClick(); sileo.dismiss(sileoToast.id) }} className="mt-3 min-h-9 rounded-full bg-foreground/10 px-4 text-xs font-medium transition-colors hover:bg-foreground/15">
                  {sileoToast.button.title}
                </button>
              )}
            </div>
            <button type="button" aria-label="Cerrar aviso" onClick={() => sileo.dismiss(sileoToast.id)} className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10"><X className="size-4" /></button>
          </div>
        )}
      </LiquidNotification>

          <DialogContent
            motionPreset="anchored"
            motionId="notifications"
            mobilePresentation="sheet"
        anchorRef={buttonRef}
        showCloseButton={false}
        aria-label="Notificaciones"
        className="!z-[201] !w-[calc(100vw-1.5rem)] !max-w-[420px] !max-h-[min(70dvh,620px)] !overflow-hidden !rounded-[28px] !border-0 !p-0 !shadow-[0_-8px_40px_rgba(0,0,0,0.25),0_30px_80px_rgba(0,0,0,0.55)] !mb-[4.5rem] sm:!mt-[164px] sm:!mb-0"
      >
        <DialogTitle className="sr-only">Notificaciones</DialogTitle>
              {/* Single dark glass shell keeps the panel distinct from bright dashboard surfaces. */}
              <div className="relative flex w-full flex-1 flex-col overflow-hidden rounded-[28px] border border-white/[0.12] bg-[rgba(10,10,18,0.86)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl max-h-[min(70dvh,620px)] sm:max-h-[min(620px,calc(100vh-5rem))]">
                {/* Subtle top shimmer line */}
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px rounded-full"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.34), rgba(var(--primary-rgb),0.35), transparent)' }}
                />
                {/* Header */}
                <div className="flex min-h-[68px] shrink-0 items-center justify-between border-b border-white/[0.09] px-3 sm:px-5">
                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/[0.09] sm:size-9">
                      <AnimatedSVGIcon state="prediction" size={17} color="#b9a5ff" />
                    </div>
                    <h3 className="text-sm font-semibold tracking-[-0.015em] text-foreground/95 sm:text-[15px]">Notificaciones</h3>
                    <AnimatePresence>
                      {unreadCount > 0 && (
                        <motion.span
                          key="unread-pill"
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.7 }}
                          className="hidden rounded-full border border-primary/25 bg-primary/[0.12] px-2.5 py-1 text-[10px] font-semibold text-primary sm:inline-flex"
                        >
                          {unreadCount} {unreadCount === 1 ? 'nueva' : 'nuevas'}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <AnimatePresence>
                      {notifications.length > 0 && (
                        <motion.div
                          key="header-actions"
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          className="flex items-center gap-1"
                        >
                          <motion.button
                            type="button"
                            onClick={markAllRead}
                            disabled={unreadCount === 0}
                            aria-label="Marcar todas como leídas"
                            className="flex size-9 items-center justify-center rounded-full text-foreground/65 transition-colors hover:bg-white/[0.09] hover:text-foreground disabled:cursor-default disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                            whileHover={{ scale: appleLiquidMotion.hoverScale }}
                            whileTap={{ scale: appleLiquidMotion.pressScale }}
                            transition={appleLiquidMotion.pressTransition}
                            title="Marcar todo como leído"
                          >
                            <CheckCheck className="size-4" />
                          </motion.button>
                          <motion.button
                            type="button"
                            onClick={clearAll}
                            aria-label="Eliminar todas las notificaciones"
                            className="flex size-9 items-center justify-center rounded-full text-foreground/65 transition-colors hover:bg-red-500/15 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70"
                            whileHover={{ scale: appleLiquidMotion.hoverScale }}
                            whileTap={{ scale: appleLiquidMotion.pressScale }}
                            transition={appleLiquidMotion.pressTransition}
                            title="Limpiar todo"
                          >
                            <Trash2 className="size-4" />
                          </motion.button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <motion.button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      aria-label="Cerrar notificaciones"
                      className="flex size-9 items-center justify-center rounded-full text-foreground/65 transition-colors hover:bg-white/[0.09] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                      whileHover={{ scale: appleLiquidMotion.hoverScale, rotate: 90 }}
                      whileTap={{ scale: appleLiquidMotion.pressScale }}
                      transition={appleLiquidMotion.pressTransition}
                    >
                      <X className="size-4" />
                    </motion.button>
                  </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3.5 custom-scrollbar sm:p-4" data-lenis-prevent>
                  <AnimatePresence mode="wait">
                    {loading && notifications.length === 0 ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center gap-3 py-14"
                      >
                        <motion.div
                          className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        />
                        <span className="text-xs text-foreground/65">Cargando avisos…</span>
                      </motion.div>
                    ) : notifications.length === 0 ? (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        className="flex flex-col items-center justify-center gap-3 py-14"
                      >
                        <motion.div
                          className="flex size-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.045]"
                        >
                          <AnimatedSVGIcon state="sync" size={21} color="rgba(255,255,255,0.62)" />
                        </motion.div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground/85">Todo en orden</p>
                          <p className="mt-1 text-xs text-foreground/60">Sin notificaciones pendientes</p>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="list"
                        className="flex flex-col gap-2.5"
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
                <motion.div
                  key="footer"
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex min-h-[60px] shrink-0 items-center justify-between gap-3 border-t border-white/[0.09] px-4 sm:px-5"
                >
                  <p className="text-[11px] text-foreground/60">
                    Se actualiza cada 5 min
                  </p>
                  <motion.button
                    onClick={() => loadNotifications(true)}
                    type="button"
                    disabled={loading}
                    aria-label="Actualizar notificaciones"
                    className="flex min-h-9 items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.035] px-3 text-xs font-medium text-foreground/80 transition-colors hover:border-white/[0.16] hover:bg-white/[0.08] hover:text-foreground disabled:cursor-wait disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    whileHover={{ scale: appleLiquidMotion.hoverScale }}
                    whileTap={{ scale: appleLiquidMotion.pressScale }}
                    transition={appleLiquidMotion.pressTransition}
                  >
                    <motion.span
                      animate={loading ? { rotate: 360 } : { rotate: 0 }}
                      transition={loading ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : {}}
                      className="inline-flex"
                    >
                      <RefreshCw className="size-3.5" />
                    </motion.span>
                    {loading ? 'Actualizando' : 'Actualizar'}
                  </motion.button>
                </motion.div>
              </div>
      </DialogContent>
    </Dialog>
  )
}
