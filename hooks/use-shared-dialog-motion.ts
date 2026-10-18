'use client'

import { useCallback, useLayoutEffect, useRef } from 'react'
import { modalFlip } from '@/lib/modal-flip'
import type { NativeDialogMotionController } from '@/hooks/use-native-dialog-motion'
import type { ModalOrigin } from '@/lib/liquid-modal-motion'

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
  originRef,
}: {
  motionId: string
  enabled: boolean
  registerController?: (controller: NativeDialogMotionController | null) => void
  originRef?: React.RefObject<ModalOrigin>
}) {
  const isLiquidNav = motionId === 'mobile-nav-panel'
  const exitTimer = useRef<number | null>(null)
  const open = useCallback(() => {
    if (!motionId) return
    if (isLiquidNav) {
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current)
      exitTimer.current = null
      return
    }
    modalFlip.setOrigin(motionId, originRef?.current)
    modalFlip.toggle(motionId)
  }, [isLiquidNav, motionId, originRef])

  const close = useCallback((onComplete: () => void) => {
    if (isLiquidNav) {
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current)
      // CommandCenterLiquidMorph owns the rail, + and panel geometry. Keep
      // the portal present through its return; never start a second animator.
      exitTimer.current = window.setTimeout(() => {
        exitTimer.current = null
        onComplete()
      }, 760)
      return
    }
    if (!motionId) {
      onComplete()
      return
    }
    modalFlip.untoggle(motionId, onComplete)
  }, [isLiquidNav, motionId])

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
    if (isLiquidNav) start()
    else if (typeof queueMicrotask === 'function') queueMicrotask(start)
    else Promise.resolve().then(start)

    return () => {
      cancelled = true
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current)
      exitTimer.current = null
      if (!isLiquidNav) modalFlip.cancel(motionId)
      registerController?.(null)
    }
  }, [close, enabled, isLiquidNav, motionId, open, registerController])

  return { open, close }
}
