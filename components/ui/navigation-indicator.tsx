'use client'

import { motion } from 'framer-motion'
import { useNovoMotionPolicy } from '@/hooks/use-novo-motion-policy'
import { cn } from '@/lib/utils'

/** A thin selection overlay on the navigation material, never another lens. */
export function NavigationIndicator({ layoutId, className }: { layoutId?: string; className?: string }) {
  const mode = useNovoMotionPolicy()
  return (
    <motion.span
      aria-hidden="true"
      data-nav-selection
      layoutId={mode === 'full' ? layoutId : undefined}
      initial={false}
      transition={mode === 'full'
        ? { type: 'spring', stiffness: 420, damping: 36, mass: 0.8 }
        : { duration: mode === 'off' ? 0 : 0.12 }}
      className={cn('novo-nav-selection pointer-events-none absolute inset-0', className)}
    />
  )
}
