'use client'

import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { gsap } from 'gsap'
import { getNovoMotionModeFromDOM, type NovoMotionMode } from '@/hooks/use-novo-motion-policy'
import {
  getSharedSurfaceMorphEase,
  SHARED_SURFACE_CLOSE_EASE as SHARED_SURFACE_CLOSE_EASE_BASE,
  SHARED_SURFACE_OPEN_EASE as SHARED_SURFACE_OPEN_EASE_BASE,
} from '@/lib/modal-motion'

export { createSharedSurfaceSpring as criticalSpring } from '@/lib/modal-motion'

export type SharedSurfaceMorphState = 'idle' | 'capsule' | 'notification' | 'expanded'

export type SharedSurfaceShape = {
  width: number
  height: number
  radius: number
}

export const SHARED_SURFACE_SHAPES: Record<SharedSurfaceMorphState, SharedSurfaceShape> = {
  idle: { width: 8, height: 80, radius: 20 },
  capsule: { width: 46, height: 190, radius: 9999 },
  notification: { width: 352, height: 118, radius: 30 },
  expanded: { width: 360, height: 420, radius: 28 },
}

export const SHARED_SURFACE_TIMING = {
  full: { open: 0.59, close: 0.52 },
  lowPower: { open: 0.57, close: 0.5 },
  reduced: { open: 0.18, close: 0.16 },
} as const

/** Preserve the hook exports used by existing call sites and tests. */
export const SHARED_SURFACE_OPEN_EASE = SHARED_SURFACE_OPEN_EASE_BASE
export const SHARED_SURFACE_CLOSE_EASE = SHARED_SURFACE_CLOSE_EASE_BASE

function clampStageSize() {
  if (typeof window === 'undefined') return { width: 360, height: 420 }
  return {
    width: Math.min(360, Math.max(46, window.innerWidth - 24)),
    height: Math.min(420, Math.max(118, (window.visualViewport?.height ?? window.innerHeight) - 32)),
  }
}

function stableSurfaceRadius() {
  if (typeof window === 'undefined') return 30
  return window.matchMedia('(max-width: 560px)').matches ? 28 : 30
}

function clipForShape(
  shape: SharedSurfaceShape,
  stage: { width: number; height: number },
  radius = shape.radius,
) {
  const left = Math.max(0, stage.width - shape.width)
  const top = 0
  const right = Math.max(0, stage.width - (left + shape.width))
  const bottom = Math.max(0, stage.height - shape.height)
  // The capsule contract keeps 9999 as a semantic pill token, but clip-path
  // must use the actual geometry radius. Feeding 9999 here is what caused the
  // visible corner re-adjustment when the Hub opened on desktop.
  const normalizedRadius = Math.min(Math.max(0, radius), shape.width / 2, shape.height / 2)
  return `inset(${top}px ${right}px ${bottom}px ${left}px round ${normalizedRadius}px)`
}

function resolveShape(state: SharedSurfaceMorphState, stage: { width: number; height: number }) {
  const base = SHARED_SURFACE_SHAPES[state]
  return {
    ...base,
    width: Math.min(base.width, stage.width),
    height: Math.min(base.height, stage.height),
  }
}

function isLowPower() {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { deviceMemory?: number }
  return matchMedia('(pointer: coarse)').matches && Number(nav.deviceMemory ?? 8) <= 4
}

function timingFor(mode: NovoMotionMode, closing: boolean) {
  if (mode === 'off') return { duration: 0, ease: (value: number) => value }
  if (mode === 'reduced') {
    return { duration: closing ? SHARED_SURFACE_TIMING.reduced.close : SHARED_SURFACE_TIMING.reduced.open, ease: (value: number) => value }
  }
  const lowPower = isLowPower()
  const duration = closing
    ? (lowPower ? SHARED_SURFACE_TIMING.lowPower.close : SHARED_SURFACE_TIMING.full.close)
    : (lowPower ? SHARED_SURFACE_TIMING.lowPower.open : SHARED_SURFACE_TIMING.full.open)
  return {
    duration,
    ease: getSharedSurfaceMorphEase(closing ? 'close' : 'open'),
  }
}

export function useSharedSurfaceMorph({
  surfaceRef,
  state,
  enabled = true,
}: {
  surfaceRef: RefObject<HTMLElement | null>
  state: SharedSurfaceMorphState
  enabled?: boolean
}) {
  const [stageSize, setStageSize] = useState(clampStageSize)
  const previousStateRef = useRef<SharedSurfaceMorphState>(state)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)

  useLayoutEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const update = () => setStageSize(clampStageSize())
    update()
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [enabled])

  useLayoutEffect(() => {
    const surface = surfaceRef.current
    if (!surface || !enabled) return

    const previous = previousStateRef.current
    const nextShape = resolveShape(state, stageSize)
    const previousShape = resolveShape(previous, stageSize)
    const surfaceRadius = stableSurfaceRadius()
    const mode = getNovoMotionModeFromDOM()
    const closing = state === 'capsule' || state === 'idle'
    const timing = timingFor(mode, closing)
    const targetOpacity = state === 'idle' ? 0.55 : 1
    const targetExpandedSkin = state === 'expanded' || state === 'notification'

    // Read the in-flight clip before replacing the timeline. This is the
    // interruptible part of the delivered prototype: rapid state changes
    // continue from the current physical surface instead of snapping back to
    // the previous rectangle and re-running a second animation.
    const running = timelineRef.current?.isActive() ?? false
    const styleWithWebkit = surface.style as CSSStyleDeclaration & { webkitClipPath?: string }
    const currentClip = surface.style.clipPath || styleWithWebkit.webkitClipPath
    const fromClip = running && currentClip && currentClip !== 'none'
      ? currentClip
      : clipForShape(previousShape, stageSize)
    const toClip = clipForShape(nextShape, stageSize, surfaceRadius)

    timelineRef.current?.kill()
    timelineRef.current = null

    // Keep the chrome at its final geometry. Only the clip changes; the
    // content frame remains stable and is never scaled or stretched.
    gsap.set(surface, {
      clipPath: fromClip,
      webkitClipPath: fromClip,
      borderRadius: surfaceRadius,
      overflow: 'visible',
      filter: 'blur(0px)',
      willChange: mode === 'full' ? 'clip-path, opacity' : 'opacity',
    })

    const compactSkin = surface.querySelector<HTMLElement>('[data-hub-skin="compact"]')
    const expandedSkin = surface.querySelector<HTMLElement>('[data-hub-skin="expanded"]')
    const skinTargets: Array<{ element: HTMLElement; opacity: number }> = []
    if (compactSkin) skinTargets.push({ element: compactSkin, opacity: targetExpandedSkin ? 0 : 1 })
    if (expandedSkin) skinTargets.push({ element: expandedSkin, opacity: targetExpandedSkin ? 0.72 : 0 })

    if (mode === 'off' || previous === state) {
      gsap.set(surface, {
        clipPath: toClip,
        webkitClipPath: toClip,
        opacity: targetOpacity,
        willChange: 'auto',
      })
      skinTargets.forEach(({ element, opacity }) => gsap.set(element, { opacity }))
    } else if (mode === 'reduced') {
      // Reduced motion keeps the final geometry deterministic and uses only a
      // short crossfade. No spatial travel, depth, or temporary blur.
      gsap.set(surface, { clipPath: toClip, webkitClipPath: toClip })
      const timeline = gsap.timeline({
        onComplete: () => {
          gsap.set(surface, { willChange: 'auto', filter: 'blur(0px)' })
          timelineRef.current = null
        },
      })
      timeline.to(surface, { opacity: targetOpacity, duration: timing.duration, ease: 'power2.out' }, 0)
      skinTargets.forEach(({ element, opacity }) => {
        timeline.to(element, { opacity, duration: timing.duration, ease: 'power2.out' }, 0)
      })
      timelineRef.current = timeline
    } else {
      const timeline = gsap.timeline({
        onComplete: () => {
          gsap.set(surface, { willChange: 'auto', filter: 'blur(0px)' })
          timelineRef.current = null
        },
      })
      timeline.to(surface, {
        clipPath: toClip,
        webkitClipPath: toClip,
        opacity: targetOpacity,
        duration: timing.duration,
        ease: timing.ease,
      }, 0)
      // Match the prototype's two lightweight skins: the material itself is
      // one physical surface, while compact/expanded chrome crossfades over it.
      skinTargets.forEach(({ element, opacity }) => {
        timeline.to(element, { opacity, duration: timing.duration * 0.7, ease: 'power2.out' }, timing.duration * 0.28)
      })
      // Motion blur is a bounded shoulder on the wrapper only. The optical
      // displacement and backdrop blur remain stable for a clean 60fps path.
      timeline.to(surface, { filter: 'blur(0.52px)', duration: timing.duration * 0.12, ease: 'power1.out' }, timing.duration * 0.06)
      timeline.to(surface, { filter: 'blur(0px)', duration: timing.duration * 0.18, ease: 'power2.out' }, timing.duration * 0.24)
      timelineRef.current = timeline
    }

    previousStateRef.current = state
  }, [enabled, stageSize, state, surfaceRef])

  // Kill only when the surface really unmounts. The transition effect above
  // intentionally has no cleanup kill, otherwise React's dependency cleanup
  // would cancel the current timeline before the next state can reverse it.
  useLayoutEffect(() => () => {
    timelineRef.current?.kill()
    timelineRef.current = null
  }, [])

  return {
    stageSize,
    surfaceRadius: stableSurfaceRadius(),
    shape: resolveShape(state, stageSize),
    contentStyle: {
      width: resolveShape(state, stageSize).width,
      height: resolveShape(state, stageSize).height,
      borderRadius: stableSurfaceRadius(),
    },
  }
}
