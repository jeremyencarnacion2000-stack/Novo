'use client'

import { useLayoutEffect, useRef } from 'react'
import { createLiquidModalMotion, type LiquidModalController, type ModalOrigin } from '@/lib/liquid-modal-motion'
import type { ModalMotionPreset } from '@/lib/modal-motion'
import { readModalOrigin } from '@/lib/modal-origin'

export type NativeDialogMotionController = Pick<LiquidModalController, 'open' | 'close'>

export function useNativeDialogMotion({ surfaceRef, surfaceElement, overlayRef, enabled, registerController, originRef, anchorRef, contextualRect }: {
  surfaceRef: React.RefObject<HTMLElement | null>
  surfaceElement?: HTMLElement | null
  overlayRef: React.RefObject<HTMLElement | null>
  preset: ModalMotionPreset
  enabled: boolean
  registerController?: (controller: NativeDialogMotionController | null) => void
  originRef?: React.RefObject<ModalOrigin>
  anchorRef?: React.RefObject<HTMLElement | null>
  contextualRect?: DOMRect | null
  sheetSide?: 'top' | 'right' | 'bottom' | 'left'
}) {
  const controllerRef = useRef<LiquidModalController | null>(null)
  const originOptions = useRef({ originRef, anchorRef, contextualRect })
  originOptions.current = { originRef, anchorRef, contextualRect }
  useLayoutEffect(() => {
    if (!enabled || !surfaceRef.current) return
    const surface = surfaceRef.current
    const options = originOptions.current
    const snapshot = options.originRef?.current ?? readModalOrigin()
    const origin = options.anchorRef?.current ?? snapshot.element
    const controller = createLiquidModalMotion({ surface, overlay: overlayRef.current, origin,
      originRect: options.contextualRect ?? snapshot.rect })
    controllerRef.current = controller
    registerController?.(controller)
    controller.open()
    return () => { registerController?.(null); controller.destroy(); controllerRef.current = null }
  }, [enabled, overlayRef, registerController, surfaceRef, surfaceElement])
  return controllerRef
}
