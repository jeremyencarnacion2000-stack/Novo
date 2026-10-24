'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { useNovoMotionPolicy } from '@/hooks/use-novo-motion-policy'
import {
  createLiquidNavigationPath,
  LiquidNavigationMotion,
  NAV_LIQUID_MOTION,
  type LiquidNavigationMode,
  type LiquidNavigationRect,
} from '@/lib/liquid-navigation-motion'
import { clamp } from '@/lib/hub-surface-motion'

type LiquidNavigationSelectionProps = {
  containerRef: RefObject<HTMLElement | null>
  activeKey: string
  selector?: string
  refractiveActive?: boolean
}

type SelectionBounds = LiquidNavigationRect

const finiteRect = (rect: DOMRect, container: HTMLElement): LiquidNavigationRect | null => {
  if (rect.width <= 0 || rect.height <= 0) return null
  const containerRect = container.getBoundingClientRect()
  return {
    left: rect.left - containerRect.left + container.scrollLeft - container.clientLeft,
    top: rect.top - containerRect.top + container.scrollTop - container.clientTop,
    width: rect.width,
    height: rect.height,
  }
}

const unionBounds = (from: LiquidNavigationRect, to: LiquidNavigationRect): SelectionBounds => {
  const padding = NAV_LIQUID_MOTION.deformation.leadingEdgeOffset
    + NAV_LIQUID_MOTION.deformation.trailingEdgeOffset
    + 3
  const left = Math.min(from.left, to.left) - padding
  const top = Math.min(from.top, to.top) - padding
  const right = Math.max(from.left + from.width, to.left + to.width) + padding
  const bottom = Math.max(from.top + from.height, to.top + to.height) + padding
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }
}

/** One measured, shared glass surface follows the active destination. */
export function LiquidNavigationSelection({
  containerRef,
  activeKey,
  selector = '[data-navigation-selection-target]',
  refractiveActive = true,
}: LiquidNavigationSelectionProps) {
  const mode = useNovoMotionPolicy()
  const [systemReducedMotion, setSystemReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const effectiveMode = mode === 'off' ? 'off' : systemReducedMotion ? 'reduced' : mode
  const modeRef = useRef<LiquidNavigationMode>(effectiveMode)
  modeRef.current = effectiveMode
  const surfaceRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const clipRef = useRef<SVGPathElement>(null)
  const mainPathRef = useRef<SVGPathElement>(null)
  const firstGhostRef = useRef<SVGPathElement>(null)
  const secondGhostRef = useRef<SVGPathElement>(null)
  const measureRef = useRef<() => void>(() => undefined)
  const id = `novo-liquid-nav-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const motionRef = useRef<LiquidNavigationMotion | null>(null)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setSystemReducedMotion(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  useLayoutEffect(() => {
    const host = containerRef.current
    const surface = surfaceRef.current
    const svg = svgRef.current
    const clip = clipRef.current
    const mainPath = mainPathRef.current
    const firstGhost = firstGhostRef.current
    const secondGhost = secondGhostRef.current
    if (!host || !surface || !svg || !clip || !mainPath || !firstGhost || !secondGhost) return

    const motion = new LiquidNavigationMotion()
    motionRef.current = motion
    let activeTarget: HTMLElement | null = null
    let hasTarget = false
    let bounds: SelectionBounds | null = null
    let animationFrame: number | null = null
    let measureFrame: number | null = null
    let previousTime: number | null = null
    let lastTrailSample = 0
    let history: string[] = []
    let targetResizeObserver: ResizeObserver | null = null
    const sampleInterval = 1000 / NAV_LIQUID_MOTION.trail.sampleHz
    const supportsPathClip = typeof CSS !== 'undefined'
      && typeof CSS.supports === 'function'
      && CSS.supports('clip-path', 'path("M 0 0 L 1 0 L 1 1 Z")')

    const localRect = (rect: LiquidNavigationRect) => ({
      ...rect,
      left: rect.left - (bounds?.left ?? 0),
      top: rect.top - (bounds?.top ?? 0),
    })

    const writeFrame = (frame: ReturnType<LiquidNavigationMotion['readFrame']>, time = performance.now()) => {
      if (!bounds) return
      const local = localRect(frame.rect)
      const path = createLiquidNavigationPath({
        rect: local,
        radius: frame.radius,
        direction: frame.direction,
        energy: frame.energy,
      })

      clip.setAttribute('d', path)
      mainPath.setAttribute('d', path)
      if (supportsPathClip) surface.style.clipPath = `path('${path}')`
      else surface.style.clipPath = `url(#${id}-clip)`

      if (frame.speed >= NAV_LIQUID_MOTION.trail.speedThreshold
        && time - lastTrailSample >= sampleInterval) {
        history.unshift(path)
        history.length = Math.min(history.length, NAV_LIQUID_MOTION.trail.historyLength)
        lastTrailSample = time
      }
      const trailVisible = frame.trailOpacity > 0 && modeRef.current === 'full'
      const firstTrail = history[Math.min(2, history.length - 1)]
      const secondTrail = history[Math.min(5, history.length - 1)]
      firstGhost.setAttribute('d', firstTrail ?? path)
      secondGhost.setAttribute('d', secondTrail ?? path)
      firstGhost.style.opacity = trailVisible && history.length > 1
        ? String(frame.trailOpacity)
        : '0'
      secondGhost.style.opacity = trailVisible && history.length > 3
        ? String((frame.trailOpacity / NAV_LIQUID_MOTION.trail.firstOpacity) * NAV_LIQUID_MOTION.trail.secondOpacity)
        : '0'

      const highlightX = clamp(
        (frame.rect.left + frame.rect.width / 2 + frame.velocity.x * NAV_LIQUID_MOTION.specular.velocityFactor - bounds.left)
          / bounds.width * 100,
        0,
        100,
      )
      const highlightY = clamp(
        (frame.rect.top + frame.rect.height / 2 + frame.velocity.y * NAV_LIQUID_MOTION.specular.velocityFactor - bounds.top)
          / bounds.height * 100,
        0,
        100,
      )
      const specularMotion = Math.min(
        NAV_LIQUID_MOTION.specular.maxOffset,
        Math.hypot(frame.velocity.x, frame.velocity.y) * NAV_LIQUID_MOTION.specular.velocityFactor,
      )
      surface.style.setProperty('--novo-nav-selection-highlight-x', `${highlightX}%`)
      surface.style.setProperty('--novo-nav-selection-highlight-y', `${highlightY}%`)
      surface.style.setProperty(
        '--novo-nav-selection-highlight-opacity',
        String(NAV_LIQUID_MOTION.specular.baseOpacity + specularMotion * NAV_LIQUID_MOTION.specular.motionOpacity / NAV_LIQUID_MOTION.specular.maxOffset),
      )
      surface.style.setProperty('--novo-nav-selection-energy', String(frame.energy))
      surface.dataset.motionMode = modeRef.current
      surface.style.visibility = 'visible'
    }

    const stopAnimation = () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
      animationFrame = null
      previousTime = null
      surface.style.willChange = 'auto'
    }

    const tick = (time: number) => {
      animationFrame = null
      const delta = previousTime === null ? 1 / 60 : (time - previousTime) / 1000
      previousTime = time
      const frame = motion.step(delta, modeRef.current)
      writeFrame(frame, time)
      if (frame.settled || modeRef.current === 'off') {
        stopAnimation()
        return
      }
      animationFrame = window.requestAnimationFrame(tick)
    }

    const startAnimation = () => {
      if (modeRef.current === 'off' || motion.settled) {
        stopAnimation()
        writeFrame(motion.readFrame())
        return
      }
      if (animationFrame !== null) return
      surface.style.willChange = 'clip-path'
      previousTime = null
      animationFrame = window.requestAnimationFrame(tick)
    }

    const measure = () => {
      const target = host.querySelector<HTMLElement>(selector)
      const targetRect = target ? finiteRect(target.getBoundingClientRect(), host) : null
      if (!target || !targetRect) {
        surface.style.visibility = 'hidden'
        targetResizeObserver?.disconnect()
        activeTarget = null
        return
      }

      const previous = hasTarget ? motion.currentRect : targetRect
      const changedTarget = activeTarget !== target
      const computed = window.getComputedStyle(target)
      const parsedRadius = Number.parseFloat(computed.borderTopLeftRadius)
        || Math.min(targetRect.height / 2, NAV_LIQUID_MOTION.deformation.defaultRadius)
      motion.retarget(targetRect, modeRef.current, parsedRadius)
      bounds = unionBounds(previous, targetRect)
      surface.style.left = `${bounds.left}px`
      surface.style.top = `${bounds.top}px`
      surface.style.width = `${bounds.width}px`
      surface.style.height = `${bounds.height}px`
      surface.style.borderRadius = `${Math.min(targetRect.height / 2, NAV_LIQUID_MOTION.deformation.defaultRadius)}px`
      svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`)
      surface.style.clipPath = supportsPathClip ? '' : `url(#${id}-clip)`
      if (changedTarget) {
        history = []
        lastTrailSample = 0
      }
      activeTarget = target
      hasTarget = true
      writeFrame(motion.readFrame())
      startAnimation()
      if (changedTarget && targetResizeObserver) {
        targetResizeObserver.disconnect()
        targetResizeObserver.observe(target)
      }
    }

    const scheduleMeasure = () => {
      if (measureFrame !== null) return
      measureFrame = window.requestAnimationFrame(() => {
        measureFrame = null
        measure()
      })
    }
    measureRef.current = measure

    const containerResizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleMeasure)
    containerResizeObserver?.observe(host)
    targetResizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleMeasure)

    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(scheduleMeasure)
    mutationObserver?.observe(host, {
      attributes: true,
      attributeFilter: ['data-navigation-selection-target'],
      childList: true,
      subtree: true,
    })
    const onViewportChange = () => scheduleMeasure()
    const onScroll = () => scheduleMeasure()
    window.addEventListener('resize', onViewportChange, { passive: true })
    window.visualViewport?.addEventListener('resize', onViewportChange, { passive: true })
    document.addEventListener('scroll', onScroll, true)

    measure()

    return () => {
      stopAnimation()
      if (measureFrame !== null) window.cancelAnimationFrame(measureFrame)
      measureFrame = null
      mutationObserver?.disconnect()
      containerResizeObserver?.disconnect()
      targetResizeObserver?.disconnect()
      window.removeEventListener('resize', onViewportChange)
      window.visualViewport?.removeEventListener('resize', onViewportChange)
      document.removeEventListener('scroll', onScroll, true)
      if (measureRef.current === measure) measureRef.current = () => undefined
      if (motionRef.current === motion) motionRef.current = null
    }
  }, [containerRef, id, selector])

  useLayoutEffect(() => {
    measureRef.current()
  }, [activeKey, effectiveMode, refractiveActive])

  return (
    <div
      ref={surfaceRef}
      aria-hidden="true"
      inert
      data-liquid-navigation-selection
      data-selection-refractive="true"
      className="novo-liquid-navigation-selection pointer-events-none absolute"
      style={{
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        zIndex: 0,
        visibility: 'hidden',
        pointerEvents: 'none',
        position: 'absolute',
        overflow: 'visible',
      }}
    >
      <GlassSurface
        aria-hidden
        preset="navigation"
        navigationMaterial="bar"
        refractive
        webComponent
        refractivePriority="interactive"
        refractiveActive={refractiveActive}
        radius={22}
        depth={8}
        strength={48}
        chromaticAberration={0}
        elevation="low"
        className="novo-liquid-navigation-selection-glass pointer-events-none absolute inset-0 h-full w-full"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 'inherit' }}
      />
      <svg
        ref={svgRef}
        aria-hidden="true"
        className="novo-liquid-navigation-selection-contour pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
      >
        <defs>
          <clipPath id={`${id}-clip`} clipPathUnits="userSpaceOnUse">
            <path ref={clipRef} d="M 0 0 L 1 0 L 1 1 Z" />
          </clipPath>
        </defs>
        <path ref={firstGhostRef} className="novo-liquid-navigation-trail novo-liquid-navigation-trail--near" d="M 0 0 L 1 0 L 1 1 Z" />
        <path ref={secondGhostRef} className="novo-liquid-navigation-trail novo-liquid-navigation-trail--far" d="M 0 0 L 1 0 L 1 1 Z" />
        <path ref={mainPathRef} className="novo-liquid-navigation-outline" d="M 0 0 L 1 0 L 1 1 Z" />
      </svg>
    </div>
  )
}
