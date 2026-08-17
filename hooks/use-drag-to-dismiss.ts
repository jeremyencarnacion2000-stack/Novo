'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

interface DragToDismissOptions<T extends HTMLElement> {
  /** Called after the surface has travelled off-screen. */
  onDismiss: (surface: T) => void
  enabled?: boolean
}

const INTENT_THRESHOLD = 9
const DISMISS_DISTANCE = 112
const FLICK_VELOCITY = 0.55 // px / ms

function isInteractiveTarget(target: HTMLElement) {
  return Boolean(target.closest(
    'button, a, input, textarea, select, option, [contenteditable="true"], [role="button"], [role="link"], [role="slider"], [data-modal-drag-ignore]',
  ))
}

function getScrollableAncestor(target: HTMLElement, surface: HTMLElement) {
  let node: HTMLElement | null = target
  while (node) {
    if (node.scrollHeight > node.clientHeight + 1) return node
    if (node === surface) break
    node = node.parentElement
  }
  return null
}

/**
 * Mobile sheet gesture shared by dialogs, drawers and lightweight panels.
 *
 * The gesture starts from any non-interactive area of the surface, rather
 * than a tiny handle. It only takes ownership after a short downward intent
 * threshold and only while the touched scroll container is already at its
 * top edge, so forms, buttons and normal reading scroll remain native.
 */
export function useDragToDismiss<T extends HTMLElement = HTMLDivElement>({
  onDismiss,
  enabled = true,
}: DragToDismissOptions<T>) {
  const surfaceRef = useRef<T | null>(null)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface || !enabled) return

    let pointerId: number | null = null
    let startedInScrollable = false
    let isDragging = false
    let startX = 0
    let startY = 0
    let surfaceStartY = 0
    let currentY = 0
    let lastY = 0
    let lastTime = 0
    let velocityY = 0
    let initialOverlayOpacity = 1

    const isMobile = () => window.matchMedia('(max-width: 639px)').matches
    const getOverlay = () => {
      const slot = surface.dataset.slot
      const selector = slot === 'sheet-content'
        ? '[data-slot="sheet-overlay"]'
        : '[data-modal-drag-overlay], [data-slot="dialog-overlay"], .modal-flip-overlay'
      return document.querySelector<HTMLElement>(selector)
    }

    const clearGesture = () => {
      pointerId = null
      startedInScrollable = false
      isDragging = false
      startX = 0
      startY = 0
      surfaceStartY = 0
      currentY = 0
      lastY = 0
      velocityY = 0
    }

    const restore = () => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const overlay = getOverlay()
      gsap.to(surface, {
        y: 0,
        duration: reducedMotion ? 0.16 : 0.42,
        ease: reducedMotion ? 'power2.out' : 'elastic.out(0.72, 0.58)',
        overwrite: 'auto',
      })
      if (overlay) {
        gsap.to(overlay, {
          opacity: initialOverlayOpacity,
          duration: reducedMotion ? 0.12 : 0.24,
          ease: 'power2.out',
          overwrite: 'auto',
        })
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      // Desktop keeps the precision-first dialog behavior. On touch devices,
      // Pointer Events provide the same path for iOS, Android and Capacitor.
      if (!isMobile() || event.pointerType === 'mouse') return

      const target = event.target instanceof HTMLElement ? event.target : null
      if (!target || isInteractiveTarget(target)) return

      const scrollable = getScrollableAncestor(target, surface)
      if (scrollable && scrollable.scrollTop > 1) return

      pointerId = event.pointerId
      startedInScrollable = Boolean(scrollable)
      isDragging = false
      startX = event.clientX
      startY = currentY = lastY = event.clientY
      lastTime = performance.now()
      velocityY = 0
      const overlay = getOverlay()
      // A running snap or dismiss can be grabbed again. Killing its tween and
      // reading the presented transform keeps the panel under the finger,
      // instead of jumping back to its logical resting position.
      gsap.killTweensOf(overlay ? [surface, overlay] : surface)
      surfaceStartY = Number(gsap.getProperty(surface, 'y')) || 0
      initialOverlayOpacity = Number.parseFloat(getComputedStyle(overlay ?? surface).opacity) || 1

      // Capture makes the panel stay connected to the finger even if it
      // crosses the sheet edge. It does not prevent native scrolling until
      // we have confirmed a downward dismiss intent below.
      surface.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return

      const deltaY = event.clientY - startY
      const deltaX = event.clientX - startX

      if (!isDragging) {
        // A vertical upward movement belongs to the content scroll. A mostly
        // horizontal movement belongs to its own child gesture, if any.
        if (deltaY < -INTENT_THRESHOLD || Math.abs(deltaX) > Math.abs(deltaY) + INTENT_THRESHOLD) {
          try { surface.releasePointerCapture(event.pointerId) } catch {}
          clearGesture()
          return
        }
        if (deltaY < INTENT_THRESHOLD) return
        isDragging = true
      }

      if (startedInScrollable) {
        const target = event.target instanceof HTMLElement ? event.target : null
        const scrollable = target ? getScrollableAncestor(target, surface) : null
        if (scrollable && scrollable.scrollTop > 1) {
          restore()
          clearGesture()
          return
        }
      }

      event.preventDefault()
      currentY = event.clientY
      const now = performance.now()
      const elapsed = Math.max(1, now - lastTime)
      velocityY = (currentY - lastY) / elapsed
      lastY = currentY
      lastTime = now

      const distance = Math.max(0, surfaceStartY + currentY - startY)
      const height = Math.max(surface.getBoundingClientRect().height, 1)
      const progress = Math.min(1, distance / (height * 0.72))
      const overlay = getOverlay()

      gsap.set(surface, { y: distance })
      if (overlay) gsap.set(overlay, { opacity: initialOverlayOpacity * (1 - progress) })
    }

    const onPointerEnd = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return
      try { surface.releasePointerCapture(event.pointerId) } catch {}

      const distance = Math.max(0, surfaceStartY + currentY - startY)
      const shouldDismiss = isDragging && (
        distance > DISMISS_DISTANCE ||
        (distance > 24 && velocityY > FLICK_VELOCITY)
      )

      if (!shouldDismiss) {
        if (isDragging) restore()
        clearGesture()
        return
      }

      const overlay = getOverlay()
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const remaining = Math.max(window.innerHeight - distance + 24, 80)
      const duration = reducedMotion ? 0.14 : Math.min(0.28, Math.max(0.14, remaining / Math.max(700, velocityY * 1000)))

      gsap.to(surface, {
        y: window.innerHeight + 24,
        duration,
        ease: 'power3.out',
        overwrite: 'auto',
        onComplete: () => onDismissRef.current(surface),
      })
      if (overlay) {
        gsap.to(overlay, { opacity: 0, duration: Math.min(duration, 0.2), ease: 'power2.out', overwrite: 'auto' })
      }
      clearGesture()
    }

    surface.addEventListener('pointerdown', onPointerDown)
    surface.addEventListener('pointermove', onPointerMove, { passive: false })
    surface.addEventListener('pointerup', onPointerEnd)
    surface.addEventListener('pointercancel', onPointerEnd)

    return () => {
      surface.removeEventListener('pointerdown', onPointerDown)
      surface.removeEventListener('pointermove', onPointerMove)
      surface.removeEventListener('pointerup', onPointerEnd)
      surface.removeEventListener('pointercancel', onPointerEnd)
      gsap.killTweensOf(surface)
    }
  }, [enabled])

  return surfaceRef
}
