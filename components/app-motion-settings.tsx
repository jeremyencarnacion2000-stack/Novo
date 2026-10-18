'use client'

import { useEffect, type ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import { useSettings } from '@/lib/settings-context'
import { useNovoMotionPolicy } from '@/hooks/use-novo-motion-policy'
import { trackModalOrigins } from '@/lib/modal-origin'
import { trackNavigationOrigins } from '@/lib/navigation-origin'
import { ConfirmationProvider } from '@/components/ui/confirmation-provider'

/** The lean Cognitive shell and full app share the same motion contract. */
export function AppMotionSettings({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const mode = useNovoMotionPolicy(settings.showAnimations)
  useEffect(trackModalOrigins, [])
  useEffect(trackNavigationOrigins, [])
  return (
    <MotionConfig reducedMotion={mode === 'full' ? 'never' : 'always'}>
      <ConfirmationProvider>{children}</ConfirmationProvider>
    </MotionConfig>
  )
}
