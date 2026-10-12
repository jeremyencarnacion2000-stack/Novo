'use client'

import { useCallback, useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { getNovoMotionModeFromDOM } from '@/hooks/use-novo-motion-policy'
import { MODAL_CUSTOM_EASE, MODAL_EASE, MODAL_MOTION, type ModalMotionPreset } from '@/lib/modal-motion'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(CustomEase)
  CustomEase.create('novoModalFluid', MODAL_CUSTOM_EASE.fluid)
}

const EASE_FLUID = 'novoModalFluid'

export type NativeDialogMotionController = {
  open: () => void
  close: (onComplete: () => void) => void
}

function getClosedState(
  preset: ModalMotionPreset,
  fullMotion: boolean,
  sheetSide: 'top' | 'right' | 'bottom' | 'left',
): gsap.TweenVars {
  if (!fullMotion) return { opacity: 0, y: 0, scale: 1 }
  if (preset === 'sheet') {
    if (sheetSide === 'right') return { opacity: 1, xPercent: 100, yPercent: 0, scale: 1 }
    if (sheetSide === 'left') return { opacity: 1, xPercent: -100, yPercent: 0, scale: 1 }
    if (sheetSide === 'top') return { opacity: 1, xPercent: 0, yPercent: -100, scale: 1 }
    return { opacity: 1, xPercent: 0, yPercent: 100, scale: 1 }
  }
  if (preset === 'fullscreen') return { opacity: 0, y: 8, scale: 0.985 }
  if (preset === 'command') return { opacity: 0, y: -8, scale: 0.97 }
  if (preset === 'anchored') return { opacity: 0, y: 8, scale: 0.96 }
  if (preset === 'alert') return { opacity: 0, y: 6, scale: 0.96 }
  return { opacity: 0, y: 10, scale: 0.94 }
}

export function useNativeDialogMotion({
  surfaceRef,
  overlayRef,
  preset,
  enabled,
  registerController,
  sheetSide = 'bottom',
}: {
  surfaceRef: React.RefObject<HTMLElement | null>
  overlayRef: React.RefObject<HTMLElement | null>
  preset: ModalMotionPreset
  enabled: boolean
  registerController?: (controller: NativeDialogMotionController | null) => void
  sheetSide?: 'top' | 'right' | 'bottom' | 'left'
}) {
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const closeCompleteRef = useRef<(() => void) | null>(null)

  const open = useCallback(() => {
    const timeline = timelineRef.current
    if (!timeline) return
    const surface = surfaceRef.current
    const overlay = overlayRef.current
    if (surface) surface.dataset.modalMotionState = 'opening'
    if (overlay) overlay.dataset.modalMotionState = 'opening'
    closeCompleteRef.current = null
    timeline.eventCallback('onReverseComplete', null)
    timeline.timeScale(1).play()
  }, [])

  const close = useCallback((onComplete: () => void) => {
    const timeline = timelineRef.current
    if (!timeline) {
      onComplete()
      return
    }
    const surface = surfaceRef.current
    const overlay = overlayRef.current
    if (surface) surface.dataset.modalMotionState = 'closing'
    if (overlay) overlay.dataset.modalMotionState = 'closing'
    closeCompleteRef.current = onComplete
    const enterDuration = Math.max(MODAL_MOTION[preset].enter, 0.001)
    const exitDuration = Math.max(MODAL_MOTION[preset].exit, 0.001)
    timeline.eventCallback('onReverseComplete', () => {
      const done = closeCompleteRef.current
      closeCompleteRef.current = null
      done?.()
    })
    timeline.timeScale(enterDuration / exitDuration).reverse()
  }, [preset])

  useLayoutEffect(() => {
    if (!enabled) {
      registerController?.(null)
      return
    }
    const surface = surfaceRef.current
    if (!surface) return

    const overlay = overlayRef.current
    const mode = getNovoMotionModeFromDOM()
    const fullMotion = mode === 'full'
    const duration = mode === 'off' ? 0 : mode === 'reduced' ? 0.16 : MODAL_MOTION[preset].enter

    // The in-app switch is a hard stop. Do not briefly apply opacity:0 and
    // wait for a zero-duration GSAP tick; settle the first frame visibly so
    // Settings and every other dialog remain usable when motion is off.
    if (mode === 'off') {
      surface.dataset.modalMotionState = 'open'
      surface.style.opacity = '1'
      surface.style.transform = 'none'
      if (overlay) {
        overlay.dataset.modalMotionState = 'open'
        overlay.style.opacity = '1'
      }
      registerController?.({ open: () => undefined, close: (done) => done() })
      return () => registerController?.(null)
    }

    const closedState = getClosedState(preset, fullMotion, sheetSide)

    try {
      surface.dataset.modalMotionState = 'preparing'
      if (overlay) overlay.dataset.modalMotionState = 'preparing'
      gsap.set(surface, {
        ...closedState,
        transformOrigin: preset === 'sheet' ? '50% 100%' : '50% 50%',
        willChange: 'transform,opacity',
      })
      if (overlay) gsap.set(overlay, { opacity: 0 })
    } catch {
      // A missing GSAP runtime must degrade to a usable, visible dialog.
      surface.dataset.modalMotionState = 'open'
      surface.style.opacity = '1'
      surface.style.transform = 'none'
      if (overlay) {
        overlay.dataset.modalMotionState = 'open'
        overlay.style.opacity = '1'
      }
      registerController?.({
        open: () => undefined,
        close: (done) => done(),
      })
      return
    }

    let timeline: gsap.core.Timeline
    try {
      timeline = gsap.timeline({ paused: true })
    } catch {
      surface.dataset.modalMotionState = 'open'
      surface.style.opacity = '1'
      surface.style.transform = 'none'
      if (overlay) {
        overlay.dataset.modalMotionState = 'open'
        overlay.style.opacity = '1'
      }
      registerController?.({ open: () => undefined, close: (done) => done() })
      return
    }
    timeline.to(surface, {
      opacity: 1,
      x: 0,
      xPercent: 0,
      y: 0,
      yPercent: 0,
      scale: 1,
      duration,
      ease: preset === 'sheet' ? MODAL_EASE.sheet : EASE_FLUID,
    }, 0)
    if (overlay) {
      timeline.to(overlay, { opacity: 1, duration: Math.min(duration, 0.22), ease: 'power3.out' }, 0)
    }

    timeline.eventCallback('onStart', () => {
      surface.dataset.modalMotionState = 'opening'
      if (overlay) overlay.dataset.modalMotionState = 'opening'
    })
    timeline.eventCallback('onComplete', () => {
      surface.dataset.modalMotionState = 'open'
      surface.style.opacity = '1'
      if (overlay) {
        overlay.dataset.modalMotionState = 'open'
        overlay.style.opacity = '1'
      }
    })
    timelineRef.current = timeline
    registerController?.({ open, close })
    timeline.play(0)

    return () => {
      registerController?.(null)
      timeline.kill()
      timelineRef.current = null
      surface.dataset.modalMotionState = 'open'
      gsap.set(surface, { clearProps: 'opacity,transform,transformOrigin,willChange' })
      surface.style.opacity = '1'
      if (overlay) {
        overlay.dataset.modalMotionState = 'open'
        gsap.set(overlay, { clearProps: 'opacity' })
        overlay.style.opacity = '1'
      }
    }
  }, [close, enabled, open, overlayRef, preset, registerController, sheetSide, surfaceRef])

  return { open, close }
}
