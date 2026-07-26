'use client'

/**
 * PageTransition
 * Wraps any page content and applies route-level motion.
 * Usage:
 *   <PageTransition variant="default">
 *     {children}
 *   </PageTransition>
 */

import { motion, AnimatePresence } from 'framer-motion'
import { pageTransitions, type PageTransitionVariant } from '@/lib/design-tokens'
import { usePathname } from 'next/navigation'

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

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={preset.initial}
        animate={preset.animate}
        exit={preset.exit}
        transition={preset.transition}
        className={className}
        style={{ willChange: 'opacity, transform, filter' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
