'use client'

import { motion, useReducedMotion } from 'framer-motion'

interface ScrollRevealProps {
  children: React.ReactNode
  delay?: number
  className?: string
  progressive?: boolean
}

export function ScrollReveal({ children, delay = 0, className, progressive = false }: ScrollRevealProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion || progressive ? false : { opacity: 0, transform: 'translate3d(0, 12px, 0)' }}
      whileInView={reduceMotion ? undefined : progressive
        ? { opacity: [0.92, 1], transform: ['translate3d(0, 6px, 0)', 'translate3d(0, 0, 0)'] }
        : { opacity: 1, transform: 'translate3d(0, 0, 0)' }}
      viewport={{ once: true, margin: '-36px' }}
      transition={progressive
        ? { duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: Math.min(delay, 0.12) }
        : { duration: 0.26, ease: [0.23, 1, 0.32, 1], delay: Math.min(delay, 0.12) }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
