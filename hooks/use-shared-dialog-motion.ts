'use client'

import { useCallback, useLayoutEffect } from 'react'
import { modalFlip } from '@/lib/modal-flip'
import type { NativeDialogMotionController } from '@/hooks/use-native-dialog-motion'

/**
 * Bridges the new Dialog `motionId` API to the shared-element flight engine.
 * Legacy `data-flip-to` consumers keep their existing explicit lifecycle while
 * newly migrated dialogs get deferred presence and interruptible close/reopen
 * behavior directly from the Dialog root.
 */
export function useSharedDialogMotion({
  motionId,
  enabled,
  registerController,
}: {
  motionId: string
  enabled: boolean
  registerController?: (controller: NativeDialogMotionController | null) => void
}) {
  const open = useCallback(() => {
    if (!motionId) return
    modalFlip.toggle(motionId)
  }, [motionId])

  const close = useCallback((onComplete: () => void) => {
    if (!motionId) {
      onComplete()
      return
    }
    modalFlip.untoggle(motionId, onComplete)
  }, [motionId])

  useLayoutEffect(() => {
    if (!enabled || !motionId) return

    registerController?.({ open, close })
    // Radix has committed the portal before this layout effect. The mobile
    // navigation morph must write its clipped first frame synchronously so
    // the final panel can never flash above the compact rail.
    let cancelled = false
    const start = () => {
      if (!cancelled) open()
    }
    if (motionId === 'mobile-nav-panel') start()
    else if (typeof queueMicrotask === 'function') queueMicrotask(start)
    else Promise.resolve().then(start)

    return () => {
      cancelled = true
      modalFlip.cancel(motionId)
      registerController?.(null)
    }
  }, [close, enabled, motionId, open, registerController])

  return { open, close }
}
