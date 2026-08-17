'use client'

/**
 * PageTransition
 * Wraps any page content and applies route-level motion.
 * Usage:
 *   <PageTransition variant="default">
 *     {children}
 *   </PageTransition>
 */

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { pageTransitions, type PageTransitionVariant } from '@/lib/design-tokens'
import { usePathname } from 'next/navigation'
import { useSettings } from '@/lib/settings-context'

interface PageTransitionProps {
  children: React.ReactNode
  variant?: PageTransitionVariant
  className?: string
}

export function PageTransition({
  children,
  variant = 'default',
  className,
}: PageTransitionProps) {
  const pathname = usePathname()
  const preset = pageTransitions[variant]
  const reducedMotion = useReducedMotion()
  const { settings } = useSettings()
  const shouldReduceMotion = reducedMotion || !settings.showAnimations
  const transition = shouldReduceMotion ? { duration: 0.01 } : preset.transition

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={shouldReduceMotion ? false : preset.initial}
        animate={shouldReduceMotion ? { opacity: 1 } : preset.animate}
        exit={shouldReduceMotion ? { opacity: 1 } : preset.exit}
        transition={transition}
        className={className}
        style={{ willChange: 'opacity, transform, filter' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
