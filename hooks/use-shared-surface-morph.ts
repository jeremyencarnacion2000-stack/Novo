'use client'

import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Tracked } from '@/lib/hub-surface-motion'
import { getNovoMotionModeFromDOM } from '@/hooks/use-novo-motion-policy'
import {
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
  idle: { width: 12, height: 72, radius: 9999 },
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

function resolveShape(state: SharedSurfaceMorphState, stage: { width: number; height: number }) {
  const base = SHARED_SURFACE_SHAPES[state]
  return {
    ...base,
    width: Math.min(base.width, stage.width),
    height: Math.min(base.height, stage.height),
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
  const frameRef = useRef<number | null>(null)
  const trackedRef = useRef<{ width: Tracked; height: Tracked; radius: Tracked } | null>(null)
  const enabledRef = useRef(enabled)

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
    if (!surface) return
    if (!enabled) {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      enabledRef.current = false
      return
    }
    const previous = previousStateRef.current
    const shape = resolveShape(state, stageSize)
    const radius = Math.min(stableSurfaceRadius(), shape.width / 2, shape.height / 2)
    const mode = getNovoMotionModeFromDOM()
    if (!trackedRef.current || !enabledRef.current) {
      trackedRef.current = {
        width: new Tracked(parseFloat(surface.style.width) || shape.width),
        height: new Tracked(parseFloat(surface.style.height) || shape.height),
        radius: new Tracked(parseFloat(surface.style.borderRadius) || radius),
      }
    }
    enabledRef.current = true
    const tracked = trackedRef.current
    // The optical body resizes directly, exactly like the Companion. Scaling,
    // clipping and a blur on its ancestor would distort the text and refraction.
    surface.style.removeProperty('clip-path')
    surface.style.removeProperty('-webkit-clip-path')
    surface.style.removeProperty('filter')
    surface.style.opacity = '1'
    surface.style.overflow = 'hidden'
    const paint = () => {
      surface.style.width = `${Math.max(1, tracked.width.value)}px`
      surface.style.height = `${Math.max(1, tracked.height.value)}px`
      surface.style.borderRadius = `${Math.max(0, tracked.radius.value)}px`
    }
    if (mode !== 'full' || previous === state) {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      tracked.width.jump(shape.width)
      tracked.height.jump(shape.height)
      tracked.radius.jump(radius)
      paint()
      surface.style.willChange = 'auto'
    } else {
      const shrinking = shape.width * shape.height < tracked.width.value * tracked.height.value
      if (shrinking) {
        const now = performance.now()
        tracked.width.curveTowards(shape.width, 340, now)
        tracked.height.curveTowards(shape.height, 340, now)
        tracked.radius.curveTowards(radius, 340, now)
      } else {
        tracked.width.springTo(shape.width, 0.5, 0.72)
        tracked.height.springTo(shape.height, 0.5, 0.72)
        tracked.radius.springTo(radius, 0.5, 0.72)
      }
      // Reuse the live driver on reversal; no dimensions jump to a target frame.
      if (frameRef.current === null) {
        let last = performance.now()
        const tick = (now: number) => {
          const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
          last = now
          tracked.width.step(dt, now)
          tracked.height.step(dt, now)
          tracked.radius.step(dt, now)
          paint()
          if (tracked.width.animating || tracked.height.animating || tracked.radius.animating) {
            frameRef.current = requestAnimationFrame(tick)
          } else {
            frameRef.current = null
            surface.style.willChange = 'auto'
          }
        }
        frameRef.current = requestAnimationFrame(tick)
      }
      surface.style.willChange = 'width, height'
    }
    previousStateRef.current = state
  }, [enabled, stageSize, state, surfaceRef])

  useLayoutEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
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
