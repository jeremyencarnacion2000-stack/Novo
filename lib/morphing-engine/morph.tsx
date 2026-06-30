/**
 * NIX Engine JSX Components
 */

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassSurface } from '@/components/ui/GlassSurface'

// ─── Easing and Physics Dictionaries ───────────────────────────────────────────

export const NIX_EASINGS = {
  'novo-spring': {
    type: 'spring',
    stiffness: 350,
    damping: 28,
    mass: 1,
  },
  'novo-cognitive': {
    type: 'spring',
    stiffness: 220,
    damping: 24,
    mass: 1.2,
  },
  'ease-out': {
    type: 'tween',
    ease: [0.16, 1, 0.3, 1], // Cubic Deceleration
  },
} as const

export type NixEasingType = keyof typeof NIX_EASINGS

// ─── LEVEL 1 & 2: MotionMorph Component ────────────────────────────────────────

export interface MotionMorphProps {
  from: string | React.CSSProperties
  to: string | React.CSSProperties
  duration?: number
  easing?: NixEasingType
  layoutId: string
  children: React.ReactNode
  activeState: 'from' | 'to'
  className?: string
  style?: React.CSSProperties
}

export const MotionMorph: React.FC<MotionMorphProps> = ({
  from,
  to,
  duration = 0.45,
  easing = 'novo-spring',
  layoutId,
  children,
  activeState,
  className = '',
  style = {},
}) => {
  const isFrom = activeState === 'from'
  const currentStyles = isFrom
    ? (typeof from === 'object' ? from : {})
    : (typeof to === 'object' ? to : {})
  const currentClass = isFrom
    ? (typeof from === 'string' ? from : '')
    : (typeof to === 'string' ? to : '')

  const transitionConfig = {
    ...NIX_EASINGS[easing],
    duration,
  }

  return (
    <motion.div
      layoutId={layoutId}
      layout
      transition={transitionConfig}
      className={`${currentClass} ${className}`}
      style={{ ...currentStyles, ...style }}
    >
      {children}
    </motion.div>
  )
}

// ─── LEVEL 3: NotificationMorph Component ──────────────────────────────────────

export interface NotificationMorphProps {
  semantic: 'task-created' | 'google-calendar-sync' | 'sync' | 'recovery' | 'execution'
  origin?: DOMRect | null
  destination?: DOMRect | null
  children: React.ReactNode
  onComplete?: () => void
}

export const NotificationMorph: React.FC<NotificationMorphProps> = ({
  semantic,
  origin,
  destination,
  children,
  onComplete,
}) => {
  const [coords, setCoords] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null)

  React.useEffect(() => {
    if (origin) {
      setCoords({
        x: origin.left,
        y: origin.top,
        w: origin.width,
        h: origin.height,
      })
    }
  }, [origin])

  React.useEffect(() => {
    if (destination && coords) {
      const timer = setTimeout(() => {
        setCoords({
          x: destination.left,
          y: destination.top,
          w: destination.width,
          h: destination.height,
        })
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [destination])

  if (!coords) return <>{children}</>

  return (
    <motion.div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: coords.w,
        height: coords.h,
        x: coords.x,
        y: coords.y,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
      animate={{
        x: coords.x,
        y: coords.y,
        width: coords.w,
        height: coords.h,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 26,
      }}
      onAnimationComplete={onComplete}
    >
      <GlassSurface radius={16} depth={4} blur={1} strength={20} chromaticAberration={3}>
        <div className="p-3 text-xs flex items-center justify-between">
          <span className="capitalize font-semibold text-white/90">{semantic.replace(/-/g, ' ')}</span>
          {children}
        </div>
      </GlassSurface>
    </motion.div>
  )
}

// ─── LEVEL 4: TaskMorph Component ──────────────────────────────────────────────

export interface TaskMorphProps {
  semantic: 'google-calendar-sync' | 'execution-momentum' | 'sync' | 'dopamine'
  isActive?: boolean
  children?: React.ReactNode
}

export const TaskMorph: React.FC<TaskMorphProps> = ({ semantic, isActive = true, children }) => {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 p-4 bg-black/40">
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={NIX_EASINGS['novo-spring']}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-indigo-500/20 text-indigo-400">
                {semantic === 'google-calendar-sync' ? (
                  <motion.svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <motion.path
                      d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
                      animate={{ pathLength: [0, 1] }}
                      transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
                    />
                    <motion.path
                      d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"
                      animate={{ pathLength: [0, 1] }}
                      transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
                    />
                    <motion.path d="M16 3v5h-5" />
                  </motion.svg>
                ) : (
                  <span className="text-xs font-bold">⚡</span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-white/95">
                  {semantic === 'google-calendar-sync' ? 'Google Calendar Syncing' : 'Execution Engine Active'}
                </span>
                <span className="text-[10px] text-white/40">Continuity Morph Pipeline Engaged</span>
              </div>
            </div>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── LEVEL 3: SVG Path Morphing ────────────────────────────────────────────────

export const MorphPath: React.FC<{
  d: string
  color?: string
  strokeWidth?: number
  duration?: number
}> = ({ d, color = 'currentColor', strokeWidth = 2, duration = 0.45 }) => {
  return (
    <motion.path
      d={d}
      stroke={color}
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      animate={{ d }}
      transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
    />
  )
}

export { AnimatePresence }
