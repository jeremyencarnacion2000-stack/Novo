'use client'

import { motion } from 'framer-motion'
import { useNovoMotionPolicy } from '@/hooks/use-novo-motion-policy'
import { cn } from '@/lib/utils'
import { GlassSurface } from '@/components/ui/GlassSurface'

/** Shared motion with an optical lens for primary navigation, or a thin fill. */
export function NavigationIndicator({ layoutId, className, refractive = false, refractiveActive = true }: {
  layoutId?: string
  className?: string
  refractive?: boolean
  refractiveActive?: boolean
}) {
  const mode = useNovoMotionPolicy()
  return (
    <motion.div
      aria-hidden="true"
      data-nav-selection
      data-selection-refractive={refractive || undefined}
      layoutId={mode === 'full' ? layoutId : undefined}
      initial={false}
      transition={mode === 'full'
        ? { type: 'spring', stiffness: 420, damping: 36, mass: 0.8 }
        : { duration: mode === 'off' ? 0 : 0.12 }}
      className={cn('novo-nav-selection pointer-events-none absolute inset-0', className)}
    >
      {refractive && (
        <GlassSurface
          preset="navigation" navigationMaterial="bar" refractive webComponent
          refractiveActive={refractiveActive} refractivePriority="interactive"
          depth={6} strength={60} chromaticAberration={1.8} elevation="low"
          className="h-full w-full"
          style={{ borderRadius: 'inherit' }}
        />
      )}
    </motion.div>
  )
}
