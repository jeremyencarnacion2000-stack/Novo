'use client'

import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

interface DragToDismissOptions {
  onDismiss: () => void
  enabled?: boolean
}

/**
 * Native iOS Sheet Drag-to-Dismiss Gesture Hook.
 * Matches the reference HTML behavior exactly:
 *  - Real-time interactive tracking of modal offset, viewport un-scaling, and backdrop fading
 *  - Elastic rubber-banding when dragging upward
 *  - Velocity-based flick detection (fast swipe down dismisses even on short distance)
 *  - Spring snap-back with ease 'back.out(1.2)' when gesture is cancelled
 */
export function useDragToDismiss<T extends HTMLElement = HTMLDivElement>({
  onDismiss,
  enabled = true,
}: DragToDismissOptions) {
  const handleRef = useRef<T | null>(null)
  const isDraggingRef = useRef(false)
  const startYRef = useRef(0)
  const currentYRef = useRef(0)
  const lastYRef = useRef(0)
  const lastTimeRef = useRef(0)
  const velocityYRef = useRef(0)

  useEffect(() => {
    const handleEl = handleRef.current
    if (!handleEl || !enabled) return

    const isMobile = () => window.innerWidth < 640

    const getAppViewport = () =>
      document.querySelector<HTMLElement>('[data-app-viewport]') ??
      document.querySelector<HTMLElement>('#appViewport')

    const getModalEl = (): HTMLElement | null =>
      handleEl.closest('.modal-flip-target, .app-modal, [role="dialog"]') as HTMLElement | null

    const getBackdropEl = (): HTMLElement | null =>
      document.querySelector<HTMLElement>('.modal-flip-overlay, .backdrop-overlay')

    const onPointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true
      startYRef.current = e.clientY
      currentYRef.current = e.clientY
      lastYRef.current = e.clientY
      lastTimeRef.current = performance.now()
      velocityYRef.current = 0
      try {
        handleEl.setPointerCapture(e.pointerId)
      } catch (err) {}
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return
      currentYRef.current = e.clientY
      const now = performance.now()
      const dt = now - lastTimeRef.current

      if (dt > 0) {
        velocityYRef.current = (currentYRef.current - lastYRef.current) / dt
        lastYRef.current = currentYRef.current
        lastTimeRef.current = now
      }

      const delta = currentYRef.current - startYRef.current
      const modalEl = getModalEl()
      if (!modalEl) return

      const modalHeight = modalEl.offsetHeight || 400
      const appViewport = getAppViewport()
      const backdrop = getBackdropEl()

      if (delta > 0) {
        // Dragging downward: interactive viewport expansion + backdrop fade
        const dragProgress = Math.min(1, delta / (modalHeight * 0.7))
        const baseScale = isMobile() ? 0.94 : 0.97
        const currentScale = baseScale + (1 - baseScale) * dragProgress
        const currentRadius = 28 * (1 - dragProgress)
        const currentViewportY = (isMobile() ? -8 : 0) * (1 - dragProgress)

        gsap.set(modalEl, { y: delta })

        if (appViewport) {
          gsap.set(appViewport, {
            scale: currentScale,
            borderRadius: `${currentRadius}px`,
            y: currentViewportY,
          })
        }

        if (backdrop) {
          gsap.set(backdrop, { opacity: Math.max(0, 1 - dragProgress) })
        }
      } else {
        // Dragging upward: apply elastic rubber-banding resistance
        const resistance = -Math.pow(-delta, 0.75)
        gsap.set(modalEl, { y: resistance })
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      try {
        handleEl.releasePointerCapture(e.pointerId)
      } catch (err) {}

      const delta = currentYRef.current - startYRef.current
      const isFastFlick = velocityYRef.current > 0.35 && delta > 15
      const modalEl = getModalEl()
      const appViewport = getAppViewport()
      const backdrop = getBackdropEl()

      if (delta > 95 || isFastFlick) {
        onDismiss()
      } else if (modalEl) {
        // Cancelled gesture: spring snap back
        const baseScale = isMobile() ? 0.94 : 0.97
        gsap.to(modalEl, { y: 0, duration: 0.35, ease: 'back.out(1.2)' })

        if (appViewport) {
          gsap.to(appViewport, {
            scale: baseScale,
            borderRadius: '28px',
            y: isMobile() ? -8 : 0,
            duration: 0.35,
            ease: 'power3.out',
          })
        }

        if (backdrop) {
          gsap.to(backdrop, { opacity: 1, duration: 0.3 })
        }
      }

      startYRef.current = 0
      currentYRef.current = 0
    }

    handleEl.addEventListener('pointerdown', onPointerDown)
    handleEl.addEventListener('pointermove', onPointerMove)
    handleEl.addEventListener('pointerup', onPointerUp)
    handleEl.addEventListener('pointercancel', onPointerUp)

    return () => {
      handleEl.removeEventListener('pointerdown', onPointerDown)
      handleEl.removeEventListener('pointermove', onPointerMove)
      handleEl.removeEventListener('pointerup', onPointerUp)
      handleEl.removeEventListener('pointercancel', onPointerUp)
    }
  }, [onDismiss, enabled])

  return handleRef
}
