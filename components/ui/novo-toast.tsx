'use client'

import * as React from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { GlassSurface } from './GlassSurface'
import { AnimatedSVGIcon, type IconState } from './AnimatedSVGIcon'
import { startMorphTransition } from '@/lib/morphing-engine'

// ── Types ──────────────────────────────────────────────────────────────────────

export type NovoToastType = 'info' | 'success' | 'warning' | 'suggestion' | 'achievement' | 'cognitive'

export interface NovoToastOptions {
  title: string
  description?: string
  duration?: number | null
  iconState?: IconState
  badge?: string // e.g. "+12%" for cognitive
  action?: {
    label: string
    onClick: () => void
  }
}

export interface NovoToastInstance extends NovoToastOptions {
  id: string
  type: NovoToastType
}

type Listener = (toasts: NovoToastInstance[]) => void

// ── State Store ────────────────────────────────────────────────────────────────

let toastList: NovoToastInstance[] = []
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((l) => l([...toastList]))
}

export const novoToast = {
  show(type: NovoToastType, opts: NovoToastOptions) {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: NovoToastInstance = {
      id,
      type,
      duration: opts.duration === undefined ? 5000 : opts.duration,
      ...opts,
    }

    startMorphTransition(() => {
      toastList = [newToast, ...toastList].slice(0, 3) // Max 3 visible
      emit()
    })

    if (newToast.duration) {
      setTimeout(() => {
        novoToast.dismiss(id)
      }, newToast.duration)
    }

    return id
  },

  success(opts: NovoToastOptions) {
    return this.show('success', { iconState: 'recovery', ...opts })
  },

  warning(opts: NovoToastOptions) {
    return this.show('warning', { iconState: 'notification', ...opts })
  },

  info(opts: NovoToastOptions) {
    return this.show('info', { iconState: 'sync', ...opts })
  },

  suggestion(opts: NovoToastOptions) {
    return this.show('suggestion', { iconState: 'prediction', ...opts })
  },

  achievement(opts: NovoToastOptions) {
    return this.show('achievement', { iconState: 'execution', ...opts })
  },

  cognitive(opts: NovoToastOptions) {
    return this.show('cognitive', { iconState: 'thinking', ...opts })
  },

  dismiss(id: string) {
    startMorphTransition(() => {
      toastList = toastList.filter((t) => t.id !== id)
      emit()
    })
  },

  clear() {
    startMorphTransition(() => {
      toastList = []
      emit()
    })
  },

  subscribe(listener: Listener) {
    listeners.add(listener)
    listener([...toastList])
    return () => {
      listeners.delete(listener)
    }
  },
}

// Global hook
export function useNovoToast() {
  const [toasts, setToasts] = React.useState<NovoToastInstance[]>([])

  React.useEffect(() => {
    return novoToast.subscribe(setToasts)
  }, [])

  return {
    toasts,
    ...novoToast,
  }
}

// ── Toaster Component ─────────────────────────────────────────────────────────

export function NovoToaster() {
  const { toasts, dismiss } = useNovoToast()

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-4 pointer-events-none w-full max-w-[420px]">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layoutId={`toast-${t.id}`}
            layout
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 0.9,
              x: 100, // Morph towards screen edge on dismiss
              transition: { duration: 0.22 },
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 26,
            }}
            className="pointer-events-auto w-full"
          >
            <NovoToastItem toast={t} onDismiss={() => dismiss(t.id)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ── Toast Item Material Component ─────────────────────────────────────────────

interface NovoToastItemProps {
  toast: NovoToastInstance
  onDismiss: () => void
}

function NovoToastItem({ toast, onDismiss }: NovoToastItemProps) {
  const [hovered, setHovered] = React.useState(false)
  const [pressed, setPressed] = React.useState(false)
  const progressControls = useAnimation()

  // Sileo Sequence Animation Timers
  const [materialFormed, setMaterialFormed] = React.useState(false)
  const [iconMorphed, setIconMorphed] = React.useState(false)
  const [contentRevealed, setContentRevealed] = React.useState(false)

  React.useEffect(() => {
    // 1. Material emerges (immediately via mounting animations)
    // 2. Glass forms (blur + distortion increase)
    const t1 = setTimeout(() => setMaterialFormed(true), 200)
    // 3. Icon morphs
    const t2 = setTimeout(() => setIconMorphed(true), 400)
    // 4. Content reveal
    const t3 = setTimeout(() => setContentRevealed(true), 600)

    // Progress bar animation if duration exists
    if (toast.duration) {
      progressControls.start({
        width: '0%',
        transition: { duration: toast.duration / 1000, ease: 'linear' },
      })
    }

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [toast.duration, progressControls])

  // Material Adaptation and Color schemes based on category
  const getThemeConfig = () => {
    switch (toast.type) {
      case 'success':
        return {
          glow: 'rgba(52, 211, 153, 0.15)',
          iconColor: '#34d399',
          border: 'border-emerald-500/10',
        }
      case 'warning':
        return {
          glow: 'rgba(245, 158, 11, 0.15)',
          iconColor: '#f59e0b',
          border: 'border-amber-500/10',
        }
      case 'cognitive':
        return {
          glow: 'rgba(147, 51, 234, 0.2)',
          iconColor: '#a855f7',
          border: 'border-purple-500/15',
        }
      case 'suggestion':
        return {
          glow: 'rgba(59, 130, 246, 0.15)',
          iconColor: '#3b82f6',
          border: 'border-blue-500/10',
        }
      case 'achievement':
        return {
          glow: 'rgba(250, 204, 21, 0.2)',
          iconColor: '#eab308',
          border: 'border-yellow-500/15',
        }
      default:
        return {
          glow: 'rgba(255, 255, 255, 0.08)',
          iconColor: '#ffffff',
          border: 'border-white/10',
        }
    }
  }

  const theme = getThemeConfig()

  // Hover and Press states mapping
  // Hover: +1% elevation (scale 1.01), +2% reflection (brightness/highlights increase), SVG becomes brighter
  // Press: Material compresses (-3% scale), shadow softens, reflection contracts
  const scale = pressed ? 0.97 : hovered ? 1.01 : 1
  const reflectionOpacity = pressed ? 0.02 : hovered ? 0.08 : 0.05
  const shadowIntensity = pressed ? '0 10px 40px rgba(0,0,0,0.2)' : hovered ? '0 30px 100px rgba(0,0,0,0.45)' : '0 24px 80px rgba(0,0,0,0.35)'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        setPressed(false)
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={(e) => {
        // Prevent click trigger if action button is clicked
        if ((e.target as HTMLElement).closest('button')) return
      }}
      className="w-full relative transition-all duration-300 ease-out"
      style={{
        transform: `scale(${scale})`,
        filter: hovered ? 'brightness(1.05)' : 'none',
      }}
    >
      <GlassSurface
        radius={24}
        depth={materialFormed ? 6 : 3}
        blur={1}
        strength={25}
        chromaticAberration={hovered ? 4 : 2}
        backgroundColor="rgba(10, 10, 15, 0.85)"
        style={{
          boxShadow: shadowIntensity,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
        className={`w-full ${theme.border}`}
      >
        {/* Dynamic Highlight Overlays (Reflections) */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: `linear-gradient(135deg, rgba(255,255,255,${reflectionOpacity}) 0%, transparent 60%)`,
            zIndex: 3,
          }}
        />

        <div className="p-5 flex flex-col gap-3 relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {/* Morphing Icon Container */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ease-out"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  boxShadow: `0 0 15px ${theme.glow}`,
                  transform: iconMorphed ? 'scale(1)' : 'scale(0.8) rotate(-10deg)',
                  opacity: iconMorphed ? 1 : 0,
                }}
              >
                {toast.iconState && (
                  <AnimatedSVGIcon
                    state={toast.iconState}
                    size={22}
                    color={theme.iconColor}
                    className="transition-colors duration-300"
                  />
                )}
              </div>

              {/* Title & Badge */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-semibold text-white/90 tracking-wide transition-all duration-500"
                    style={{
                      opacity: contentRevealed ? 1 : 0,
                      transform: contentRevealed ? 'translateY(0)' : 'translateY(-4px)',
                    }}
                  >
                    {toast.title}
                  </span>
                  {toast.badge && (
                    <span
                      className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] font-bold tracking-wider animate-pulse"
                      style={{ opacity: contentRevealed ? 1 : 0 }}
                    >
                      {toast.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-white/35 font-medium uppercase tracking-wider mt-0.5">
                  {toast.type}
                </span>
              </div>
            </div>

            {/* Dismiss Button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDismiss()
              }}
              className="p-1 rounded-md text-white/20 hover:text-white/60 hover:bg-white/5 transition-all duration-200"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Description */}
          {toast.description && (
            <p
              className="text-[11px] text-white/55 leading-relaxed pl-1 transition-all duration-500"
              style={{
                opacity: contentRevealed ? 1 : 0,
                transform: contentRevealed ? 'translateY(0)' : 'translateY(4px)',
              }}
            >
              {toast.description}
            </p>
          )}

          {/* Actions Bar */}
          {toast.action && (
            <div
              className="flex justify-end gap-2 mt-1 transition-all duration-500"
              style={{
                opacity: contentRevealed ? 1 : 0,
                transform: contentRevealed ? 'translateY(0)' : 'translateY(8px)',
              }}
            >
              <button
                onClick={toast.action.onClick}
                className="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-medium text-[10px] transition-all"
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>

        {/* Life-time Progress Indicator bar */}
        {toast.duration && (
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white/[0.04]">
            <motion.div
              initial={{ width: '100%' }}
              animate={progressControls}
              className="h-full bg-white/15"
            />
          </div>
        )}
      </GlassSurface>
    </div>
  )
}
