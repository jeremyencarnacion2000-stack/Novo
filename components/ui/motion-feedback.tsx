'use client'

/**
 * TaskCompleteMotion
 * Wraps a task item and plays a satisfying completion animation
 * when the task transitions to "completed" state.
 *
 * Usage:
 *   <TaskCompleteMotion completed={task.status === 'completed'}>
 *     <TaskCard ... />
 *   </TaskCompleteMotion>
 */

import { motion, useAnimation } from 'framer-motion'
import { useEffect, useRef } from 'react'

interface TaskCompleteMotionProps {
  children: React.ReactNode
  completed: boolean
  className?: string
}

export function TaskCompleteMotion({
  children,
  completed,
  className,
}: TaskCompleteMotionProps) {
  const controls = useAnimation()
  const prevCompleted = useRef(completed)

  useEffect(() => {
    if (!prevCompleted.current && completed) {
      // Just became completed — play the satisfying "done" sequence
      controls.start({
        scale: [1, 1.04, 0.98, 1],
        filter: ['blur(0px)', 'blur(0px)', 'blur(0px)'],
        transition: {
          duration: 0.45,
          ease: [0.34, 1.56, 0.64, 1],
          times: [0, 0.4, 0.7, 1],
        },
      })
    }
    prevCompleted.current = completed
  }, [completed, controls])

  return (
    <motion.div
      animate={controls}
      className={className}
      style={{ willChange: 'transform' }}
    >
      {children}
    </motion.div>
  )
}

/**
 * CheckmarkBurst
 * An SVG circle that "pops" when a task is checked.
 * Drop it next to your checkbox.
 *
 * Usage:
 *   <CheckmarkBurst active={isCompleted} color="#10B981" />
 */

interface CheckmarkBurstProps {
  active: boolean
  color?: string
  size?: number
}

export function CheckmarkBurst({
  active,
  color = '#10B981',
  size = 20,
}: CheckmarkBurstProps) {
  return (
    <motion.div
      initial={false}
      animate={active ? { scale: [0, 1.3, 1], opacity: [0, 1, 0] } : { scale: 0, opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      style={{
        position: 'absolute',
        width: size * 2.4,
        height: size * 2.4,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        pointerEvents: 'none',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    />
  )
}

/**
 * HabitStreakPop
 * Plays a micro bounce + glow when a habit is marked complete,
 * communicating "streak maintained" without any copy.
 */

interface HabitStreakPopProps {
  children: React.ReactNode
  triggered: boolean
  glowColor?: string
}

export function HabitStreakPop({
  children,
  triggered,
  glowColor = 'rgba(16, 185, 129, 0.5)',
}: HabitStreakPopProps) {
  const controls = useAnimation()
  const prev = useRef(triggered)

  useEffect(() => {
    if (!prev.current && triggered) {
      controls.start({
        scale: [1, 1.08, 0.96, 1.02, 1],
        filter: [
          'drop-shadow(0 0 0px transparent)',
          `drop-shadow(0 0 12px ${glowColor})`,
          `drop-shadow(0 0 8px ${glowColor})`,
          `drop-shadow(0 0 4px ${glowColor})`,
          'drop-shadow(0 0 0px transparent)',
        ],
        transition: {
          duration: 0.6,
          ease: [0.34, 1.56, 0.64, 1],
          times: [0, 0.3, 0.55, 0.78, 1],
        },
      })
    }
    prev.current = triggered
  }, [triggered, controls, glowColor])

  return (
    <motion.div animate={controls} style={{ willChange: 'transform, filter' }}>
      {children}
    </motion.div>
  )
}
