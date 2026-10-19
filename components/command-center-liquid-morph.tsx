'use client'

import { useEffect, useId, useLayoutEffect, useRef, type RefObject } from 'react'
import type { MotionValue } from 'framer-motion'
import { useNovoMotionPolicy } from '@/hooks/use-novo-motion-policy'
import { liquidNeckProfile } from '@/lib/liquid-notification'
import { NAV_MORPH_REST_EVENT } from '@/lib/mobile-nav-motion'

/**
 * Physical, reversible progress driver ported from command-center-liquid-nav
 * / apple-liquid-morph-lab. React owns whether the menu is logically open;
 * this controller owns only compositor-safe visual properties between states.
 */
export const LIQUID_MORPH_CONFIG = {
  spring: {
    openResponse: 0.56,
    closeResponse: 0.50,
    damping: 0.90,
  },
  phases: {
    approach: [0, 0.24],
    neck: [0.08, 0.34],
    absorb: [0.24, 0.48],
    expand: [0.40, 1],
    content: [0.63, 0.88],
  },
  deformation: 0.82,
} as const

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number }
type Geometry = { source: Rect; rail: Rect; fab: Rect; target: Rect; close: Rect | null; glyph: Rect | null }

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress
const smoothstep = (from: number, to: number, value: number) => {
  const progress = clamp((value - from) / (to - from || 1))
  return progress * progress * (3 - 2 * progress)
}
const toRect = (rect: DOMRect): Rect => ({
  left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height,
})

export class LiquidMorphSpring {
  value = 0
  velocity = 0
  target = 0
  private frame = 0
  private last = 0

  constructor(
    private readonly onUpdate: (value: number, velocity: number) => void,
    private readonly onRest?: (target: number) => void,
  ) {}

  setTarget(target: number) {
    this.target = target
    if (this.frame) return
    this.last = performance.now()
    this.frame = requestAnimationFrame(this.tick)
  }

  setImmediate(target: number) {
    if (this.frame) cancelAnimationFrame(this.frame)
    this.frame = 0
    this.target = target
    this.value = target
    this.velocity = 0
    this.onUpdate(this.value, 0)
    this.onRest?.(target)
  }

  private tick = (now: number) => {
    const elapsed = Math.min(0.05, Math.max(1 / 300, (now - this.last) / 1000))
    this.last = now
    // The lab uses substeps so a dropped mobile frame cannot destabilise the spring.
    const steps = Math.max(1, Math.ceil(elapsed / (1 / 120)))
    const dt = elapsed / steps
    const response = this.target === 1
      ? LIQUID_MORPH_CONFIG.spring.openResponse
      : LIQUID_MORPH_CONFIG.spring.closeResponse
    const omega = (2 * Math.PI) / response
    const stiffness = omega * omega
    const damping = 2 * LIQUID_MORPH_CONFIG.spring.damping * omega
    for (let step = 0; step < steps; step += 1) {
      const acceleration = stiffness * (this.target - this.value) - damping * this.velocity
      this.velocity += acceleration * dt
      this.value += this.velocity * dt
    }
    this.onUpdate(this.value, this.velocity)
    const atRest = Math.abs(this.target - this.value) < 0.00045 && Math.abs(this.velocity) < 0.0035
    if (atRest) {
      this.value = this.target
      this.velocity = 0
      this.onUpdate(this.value, 0)
      this.frame = 0
      this.onRest?.(this.target)
      return
    }
    this.frame = requestAnimationFrame(this.tick)
  }

  destroy() {
    if (this.frame) cancelAnimationFrame(this.frame)
    this.frame = 0
  }
}

function clearStyles(...elements: Array<HTMLElement | SVGElement | null>) {
  elements.forEach((element) => {
    if (!element) return
    element.style.removeProperty('opacity')
    element.style.removeProperty('transform')
    element.style.removeProperty('transform-origin')
    element.style.removeProperty('clip-path')
    element.style.removeProperty('-webkit-clip-path')
    element.style.removeProperty('will-change')
    element.style.removeProperty('overflow')
    element.style.removeProperty('left')
    element.style.removeProperty('top')
    element.style.removeProperty('width')
    element.style.removeProperty('height')
  })
}

export function CommandCenterLiquidMorph({
  active,
  mounted,
  sourceRef,
  railRef,
  fabRef,
  plusGlyphRef,
}: {
  active: boolean
  mounted: boolean
  sourceRef: RefObject<HTMLElement | null>
  railRef: RefObject<HTMLElement | null>
  fabRef: RefObject<HTMLElement | null>
  plusGlyphRef: RefObject<SVGSVGElement | null>
}) {
  const motionMode = useNovoMotionPolicy()
  const springRef = useRef<LiquidMorphSpring | null>(null)
  const logicalTargetRef = useRef(active)
  const modeRef = useRef(motionMode)
  logicalTargetRef.current = active
  modeRef.current = motionMode

  useEffect(() => {
    document.querySelector('[data-liquid-morph-panel]')?.removeAttribute('data-liquid-morph-settled')
    const hiddenOnDesktop = !active && window.matchMedia?.('(min-width: 768px)').matches
    if (motionMode === 'full' && !hiddenOnDesktop) springRef.current?.setTarget(active ? 1 : 0)
    else springRef.current?.setImmediate(active ? 1 : 0)
  }, [active, motionMode])

  useLayoutEffect(() => {
    if (!mounted) return
    const source = sourceRef.current
    const rail = railRef.current
    const fab = fabRef.current
    const plusGlyph = plusGlyphRef.current
    if (!source || !rail || !fab) return

    let geometry: Geometry | null = null
    let panel: HTMLElement | null = null
    let material: HTMLElement | null = null
    let content: HTMLElement | null = null
    let closeButton: HTMLElement | null = null
    let handle: HTMLElement | null = null
    const bridge = source.querySelector<HTMLElement>('[data-liquid-merge-geometry]')
    let observer: ResizeObserver | null = null
    let observedPanel: HTMLElement | null = null
    let contentTop = 0
    let portalObserver: MutationObserver | null = null
    const flightGlyph = plusGlyph?.cloneNode(true) as SVGSVGElement | undefined
    if (flightGlyph) {
      flightGlyph.removeAttribute('data-shared-item')
      flightGlyph.setAttribute('aria-hidden', 'true')
      flightGlyph.dataset.liquidNavGlyph = 'true'
      Object.assign(flightGlyph.style, {
        position: 'fixed', pointerEvents: 'none', zIndex: '5002', margin: '0',
        visibility: 'hidden', color: getComputedStyle(plusGlyph!).color,
      })
      document.body.appendChild(flightGlyph)
    }

    const measure = () => {
      panel = document.querySelector<HTMLElement>('[data-liquid-morph-panel]')
      if (!panel) return
      // Read the undeformed endpoints. A transform must never become the next
      // measurement's origin after a resize or a late portal commit.
      const saved = [rail, fab, plusGlyph, closeButton, content].filter(Boolean).map(element => {
        const node = element as HTMLElement | SVGSVGElement
        const transform = node.style.transform
        node.style.transform = 'none'
        return { node, transform }
      })
      const sourceRect = toRect(source.getBoundingClientRect())
      const railRect = toRect(rail.getBoundingClientRect())
      const fabRect = toRect(fab.getBoundingClientRect())
      const targetRect = toRect(panel.getBoundingClientRect())
      closeButton = panel.querySelector<HTMLElement>('[data-slot="dialog-close"]')
      content = panel.querySelector<HTMLElement>('[data-modal-content]')
      material = panel.querySelector<HTMLElement>('[data-liquid-panel-material]')
      handle = panel.querySelector<HTMLElement>('[data-liquid-panel-handle]')
      const closeRect = closeButton ? toRect(closeButton.getBoundingClientRect()) : null
      const glyphRect = plusGlyph ? toRect(plusGlyph.getBoundingClientRect()) : null
      contentTop = content ? content.getBoundingClientRect().top - targetRect.top : 0
      saved.forEach(({ node, transform }) => { node.style.transform = transform })
      portalObserver?.disconnect()
      if (!sourceRect.width || !targetRect.width || !targetRect.height) return
      geometry = {
        source: sourceRect,
        rail: railRect,
        fab: fabRect,
        target: targetRect,
        close: closeRect,
        glyph: glyphRect,
      }
      if (observedPanel !== panel) {
        observer?.disconnect()
        observer = new ResizeObserver(() => {
          measure()
          render(spring.value, spring.velocity)
        })
        observer.observe(source)
        observer.observe(rail)
        observer.observe(fab)
        observer.observe(panel)
        observedPanel = panel
      }
    }

    const render = (rawProgress: number, velocity: number) => {
      if (!geometry) measure()
      if (!geometry || !panel) return
      const progress = clamp(rawProgress)
      const { source: sourceRect, rail: railRect, fab: fabRect, target: targetRect, close, glyph } = geometry
      const approach = smoothstep(...LIQUID_MORPH_CONFIG.phases.approach, progress)
      const neck = liquidNeckProfile(progress / 0.82)
      const absorb = smoothstep(...LIQUID_MORPH_CONFIG.phases.absorb, progress)
      const expand = smoothstep(...LIQUID_MORPH_CONFIG.phases.expand, progress)
      const reveal = smoothstep(...LIQUID_MORPH_CONFIG.phases.content, progress)
      const energy = Math.min(1, Math.abs(velocity) / 4.2)

      const width = lerp(sourceRect.width, targetRect.width, expand)
      const height = lerp(sourceRect.height, targetRect.height, expand)
      const x = lerp(sourceRect.left - targetRect.left, 0, expand)
      const y = lerp(sourceRect.top - targetRect.top, 0, expand)
      const scaleX = width / targetRect.width
      const scaleY = height / targetRect.height
      const radius = lerp(sourceRect.height / 2, 28, expand)

      // Source material stays visible through approach/neck. Only after the
      // common surface exists does it get absorbed by the panel material.
      rail.style.opacity = String(1 - smoothstep(0.38, 0.64, progress))
      rail.style.transformOrigin = '100% 50%'
      const railBulge = 1 + 0.1028 * neck * (1 - smoothstep(0.35, 0.5, progress))
      rail.style.transform = `translate3d(0,0,0) scaleX(${railBulge.toFixed(4)})`
      const gap = Math.max(0, fabRect.left - railRect.right)
      fab.style.opacity = String(1 - smoothstep(0.62, 0.80, progress))
      fab.style.overflow = 'visible'
      const plusSquashX = lerp(1, 1.18, neck) * lerp(1, 0.82, absorb)
      const plusSquashY = lerp(1, 0.88, neck) * lerp(1, 0.84, absorb)
      fab.style.transform = `translate3d(${(-gap * approach).toFixed(2)}px,0,0) scale(${plusSquashX.toFixed(4)},${plusSquashY.toFixed(4)})`
      if (bridge) {
        const bridgeWidth = (gap + Math.min(fabRect.width * 0.46, 26)) * neck * (1 - smoothstep(0.42, 0.60, progress))
        const bridgeHeight = lerp(14, Math.min(31, fabRect.height * 0.54), neck)
        bridge.style.left = `${(railRect.right - sourceRect.left - 2).toFixed(2)}px`
        bridge.style.top = `${(railRect.top - sourceRect.top + railRect.height / 2).toFixed(2)}px`
        bridge.style.width = `${bridgeWidth.toFixed(2)}px`
        bridge.style.height = `${bridgeHeight.toFixed(2)}px`
        bridge.style.opacity = String(
          smoothstep(0.06, 0.2, progress) * (1 - smoothstep(0.46, 0.62, progress)),
        )
        bridge.style.transformOrigin = 'left center'
        bridge.style.transform = `translate3d(0,-50%,0) scaleY(${(1 - energy * 0.05).toFixed(3)})`
      }

      // The optical shell is a sibling of the fading content. No opacity,
      // clip-path or will-change:opacity ancestor can flatten its backdrop.
      // Only this empty material is stretched; page labels stay at full size.
      if (material) {
        material.style.visibility = progress < 0.40 ? 'hidden' : 'visible'
        material.style.transformOrigin = '0 0'
        material.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${scaleX.toFixed(4)},${scaleY.toFixed(4)})`
        material.style.borderRadius = `${(radius / scaleX).toFixed(2)}px / ${(radius / scaleY).toFixed(2)}px`
        material.style.willChange = progress > 0 && progress < 1 ? 'transform' : 'auto'
      }
      if (content) {
        content.style.opacity = String(reveal)
        content.style.transform = `translate3d(0,${lerp(9, 0, reveal).toFixed(2)}px,0)`
        // Clip only the readable layer to the growing contour. The optical
        // sibling continues sampling the wallpaper outside this text mask.
        content.style.clipPath = `inset(${Math.max(0, y - contentTop).toFixed(2)}px ${Math.max(0, targetRect.width - x - width).toFixed(2)}px 0 ${Math.max(0, x).toFixed(2)}px round 12px)`
        content.style.willChange = progress === 1 && velocity === 0 ? 'auto' : 'transform, opacity'
        content.style.pointerEvents = logicalTargetRef.current && reveal > 0.85 ? '' : 'none'
      }
      if (handle) handle.style.opacity = String(reveal)
      if (closeButton) {
        closeButton.style.opacity = String(reveal)
        closeButton.style.transform = `translate3d(0,${lerp(5, 0, reveal).toFixed(2)}px,0)`
      }
      if (plusGlyph && flightGlyph && close && glyph) {
        const flight = smoothstep(0.28, 0.72, progress)
        const dx = close.left + close.width / 2 - (glyph.left + glyph.width / 2)
        const dy = close.top + close.height / 2 - (glyph.top + glyph.height / 2)
        // A portal glyph uses viewport coordinates, independent of the FAB's
        // simultaneous squash and translation.
        plusGlyph.style.visibility = progress > 0 ? 'hidden' : ''
        Object.assign(flightGlyph.style, {
          left: `${glyph.left}px`, top: `${glyph.top}px`,
          width: `${glyph.width}px`, height: `${glyph.height}px`,
          visibility: progress > 0 && progress < 0.88 ? 'visible' : 'hidden',
          opacity: String(1 - smoothstep(0.72, 0.88, progress)),
          transform: `translate3d(${(dx * flight).toFixed(2)}px,${(dy * flight).toFixed(2)}px,0) rotate(${(45 * flight).toFixed(2)}deg)`,
        })
      }
    }

    const spring = new LiquidMorphSpring(render, (target) => {
      if (target !== (logicalTargetRef.current ? 1 : 0)) return
      if (!panel) measure()
      if (target === 1) {
        clearStyles(material, content, closeButton)
        if (material) material.style.borderRadius = ''
        panel?.setAttribute('data-liquid-morph-settled', 'open')
      } else {
        clearStyles(rail, fab)
        if (plusGlyph) plusGlyph.style.visibility = ''
        panel?.setAttribute('data-liquid-morph-settled', 'closed')
        panel?.dispatchEvent(new Event(NAV_MORPH_REST_EVENT))
      }
    })
    springRef.current = spring
    // Write the compact first frame before the portaled Dialog is painted.
    // This is what makes the panel feel born from the rail rather than
    // briefly appearing as a second surface.
    measure()
    render(spring.value, spring.velocity)
    // Radix portals can commit one turn after the + handler. Observe only
    // child-list changes so the first measured geometry is never skipped.
    portalObserver = new MutationObserver(() => {
      measure()
      if (panel) render(spring.value, spring.velocity)
    })
    if (!panel) portalObserver.observe(document.body, { childList: true, subtree: true })
    const timeout = window.setTimeout(measure, 0)
    const remeasure = () => { measure(); render(spring.value, spring.velocity) }
    window.addEventListener('resize', remeasure)
    window.visualViewport?.addEventListener('resize', remeasure)
    if (modeRef.current === 'full') spring.setTarget(logicalTargetRef.current ? 1 : 0)
    else spring.setImmediate(logicalTargetRef.current ? 1 : 0)

    return () => {
      window.clearTimeout(timeout)
      spring.destroy()
      portalObserver?.disconnect()
      window.removeEventListener('resize', remeasure)
      window.visualViewport?.removeEventListener('resize', remeasure)
      if (springRef.current === spring) springRef.current = null
      observer?.disconnect()
      clearStyles(rail, fab, bridge, material, content, closeButton)
      if (plusGlyph) plusGlyph.style.visibility = ''
      flightGlyph?.remove()
    }
  }, [mounted, sourceRef, railRef, fabRef, plusGlyphRef])

  return null
}

type PomodoroMorphGeometry = {
  sourceOffsetX: number
  sourceOffsetY: number
  hubTop: number
  hubRight: number
  stageWidth: number
  stageHeight: number
  widgetWidth: number
  widgetHeight: number
  widgetTop: number
  widgetLeft: number
  layerLeft: number
  layerTop: number
}

export function PomodoroDetachMorph({
  open,
  motionMode,
  hubRef,
  sourceRef,
  widgetRef,
  hubContentRef,
  position,
  stageSize,
  onSettled,
}: {
  open: boolean
  motionMode: 'full' | 'reduced' | 'off'
  hubRef: RefObject<HTMLDivElement | null>
  sourceRef: RefObject<HTMLDivElement | null>
  widgetRef: RefObject<HTMLDivElement | null>
  hubContentRef: RefObject<HTMLDivElement | null>
  position: MotionValue<number>
  stageSize: { width: number; height: number }
  onSettled: (open: boolean) => void
}) {
  const filterId = `pomodoro-goo-${useId().replace(/:/g, '')}`
  const gooLayerRef = useRef<HTMLDivElement | null>(null)
  const hubBlobRef = useRef<HTMLDivElement | null>(null)
  const bridgeRef = useRef<HTMLDivElement | null>(null)
  const widgetBlobRef = useRef<HTMLDivElement | null>(null)
  const geometryRef = useRef<PomodoroMorphGeometry | null>(null)
  const measureRef = useRef<() => void>(() => {})
  const renderRef = useRef<(progress: number) => void>(() => {})
  const stageSizeRef = useRef(stageSize)
  const springRef = useRef<LiquidMorphSpring | null>(null)
  const openRef = useRef(open)
  const previousOpenRef = useRef(open)
  const movingRef = useRef(false)
  const modeRef = useRef(motionMode)
  const onSettledRef = useRef(onSettled)
  openRef.current = open
  onSettledRef.current = onSettled
  modeRef.current = motionMode
  stageSizeRef.current = stageSize

  useLayoutEffect(() => {
    const hub = hubRef.current
    const widget = widgetRef.current
    if (!hub || !widget) return

    const setGeometry = () => {
      const source = sourceRef.current
      const hubRect = hub.getBoundingClientRect()
      const visualHeight = window.visualViewport?.height ?? window.innerHeight
      const widgetWidth = Math.min(160, Math.max(132, window.innerWidth - 118))
      const widgetHeight = 148
      const right = Math.min(64, Math.max(12, window.innerWidth - widgetWidth - 58))
      const widgetTop = Math.min(
        Math.max(12, hubRect.top + (190 - widgetHeight) / 2),
        Math.max(12, visualHeight - widgetHeight - 12),
      )
      const widgetLeft = Math.max(12, window.innerWidth - right - widgetWidth)
      let safeWidgetTop = widgetTop
      if (window.innerWidth < 768) {
        const primaryHeading = document.querySelector<HTMLElement>('main h1')
        const headingRect = primaryHeading?.getBoundingClientRect()
        const overlapsHeading = headingRect
          && widgetLeft < headingRect.right
          && widgetLeft + widgetWidth > headingRect.left
          && widgetTop < headingRect.bottom
          && widgetTop + widgetHeight > headingRect.top

        if (headingRect && overlapsHeading) {
          const maxTop = Math.max(12, visualHeight - widgetHeight - 12)
          const candidates = [
            headingRect.bottom + 12,
            headingRect.top - widgetHeight - 12,
            maxTop,
          ].filter((top) => (
            top >= 12
            && top + widgetHeight <= visualHeight - 12
            && (top + widgetHeight <= headingRect.top || top >= headingRect.bottom)
          ))
          safeWidgetTop = candidates.sort((a, b) => Math.abs(a - widgetTop) - Math.abs(b - widgetTop))[0] ?? maxTop
        }
      }
      // Keep the original attachment point during reversals; the React panel
      // may already be entering/exiting while the physical spring is moving.
      const sourceRect = !movingRef.current ? source?.getBoundingClientRect() : null
      const current = geometryRef.current
      const sourceX = sourceRect
        ? sourceRect.right - Math.min(24, sourceRect.width * 0.12)
        : current ? hubRect.right + current.sourceOffsetX : hubRect.right - 36
      const sourceY = sourceRect
        ? sourceRect.top + sourceRect.height / 2
        : current ? hubRect.top + current.sourceOffsetY : hubRect.top + hubRect.height / 2
      const stageWidth = stageSizeRef.current.width
      const stageHeight = stageSizeRef.current.height
      const filterPadding = 72
      const layerLeft = Math.min(hubRect.right - stageWidth, widgetLeft) - filterPadding
      const layerTop = Math.min(hubRect.top, safeWidgetTop) - filterPadding
      const layerRight = Math.max(hubRect.right, widgetLeft + widgetWidth) + filterPadding
      const layerBottom = Math.max(hubRect.top + stageHeight, safeWidgetTop + widgetHeight) + filterPadding

      geometryRef.current = {
        sourceOffsetX: sourceX - hubRect.right,
        sourceOffsetY: sourceY - hubRect.top,
        hubTop: hubRect.top,
        hubRight: hubRect.right,
        stageWidth,
        stageHeight,
        widgetWidth,
        widgetHeight,
        widgetTop: safeWidgetTop,
        widgetLeft,
        layerLeft,
        layerTop,
      }
      const gooLayer = gooLayerRef.current
      if (gooLayer) {
        gooLayer.style.left = `${layerLeft}px`
        gooLayer.style.top = `${layerTop}px`
        gooLayer.style.width = `${layerRight - layerLeft}px`
        gooLayer.style.height = `${layerBottom - layerTop}px`
      }
      widget.style.left = `${widgetLeft}px`
      widget.style.right = 'auto'
      widget.style.top = `${safeWidgetTop}px`
      widget.style.width = `${widgetWidth}px`
      widget.style.height = `${widgetHeight}px`
    }

    const render = (rawProgress: number) => {
      const geometry = geometryRef.current
      const hubElement = hubRef.current
      const widgetElement = widgetRef.current
      if (!geometry || !hubElement || !widgetElement) return

      const progress = clamp(rawProgress)
      const approach = smoothstep(...LIQUID_MORPH_CONFIG.phases.approach, progress)
      const neck = liquidNeckProfile(progress / 0.82)
      const absorb = smoothstep(...LIQUID_MORPH_CONFIG.phases.absorb, progress)
      const expand = smoothstep(...LIQUID_MORPH_CONFIG.phases.expand, progress)
      const reveal = smoothstep(...LIQUID_MORPH_CONFIG.phases.content, progress)

      const hubWidth = lerp(geometry.stageWidth, 46, expand)
      const hubHeight = lerp(geometry.stageHeight, 190, expand)
      const hubRadius = lerp(28, 23, expand)
      hubElement.style.width = `${hubWidth}px`
      hubElement.style.height = `${hubHeight}px`
      hubElement.style.borderRadius = `${hubRadius}px`
      hubElement.style.willChange = 'width, height'
      hubElement.style.removeProperty('clip-path')
      hubElement.style.removeProperty('-webkit-clip-path')

      const sourceX = geometry.hubRight + geometry.sourceOffsetX
      const sourceY = geometry.hubTop + geometry.sourceOffsetY
      const targetX = geometry.widgetLeft + geometry.widgetWidth / 2
      const targetY = geometry.widgetTop + geometry.widgetHeight / 2
      const travel = smoothstep(0, LIQUID_MORPH_CONFIG.phases.approach[1] + LIQUID_MORPH_CONFIG.phases.absorb[1], progress)
      const centerX = lerp(sourceX, targetX, travel)
      const centerY = lerp(sourceY, targetY, travel) - Math.sin(Math.PI * travel) * 8
      const mergeStretch = neck * (1 - absorb)
      const blobWidth = lerp(38, geometry.widgetWidth, expand) + mergeStretch * 6
      const blobHeight = lerp(38, geometry.widgetHeight, expand) - mergeStretch * 3
      const blobLeft = centerX - blobWidth / 2
      const blobTop = centerY - blobHeight / 2
      const blobRadius = lerp(19, 24, expand)

      const hubBlob = hubBlobRef.current
      if (hubBlob) {
        Object.assign(hubBlob.style, {
          left: `${geometry.hubRight - hubWidth - geometry.layerLeft}px`,
          top: `${geometry.hubTop - geometry.layerTop}px`,
          width: `${hubWidth}px`,
          height: `${hubHeight}px`,
          borderRadius: `${hubRadius}px`,
          opacity: '1',
        })
      }

      const widgetBlob = widgetBlobRef.current
      if (widgetBlob) {
        Object.assign(widgetBlob.style, {
          left: `${blobLeft - geometry.layerLeft}px`,
          top: `${blobTop - geometry.layerTop}px`,
          width: `${blobWidth}px`,
          height: `${blobHeight}px`,
          borderRadius: `${blobRadius}px`,
          opacity: String(approach),
        })
      }

      const bridge = bridgeRef.current
      if (bridge) {
        const hubCenterX = geometry.hubRight - hubWidth / 2
        const hubCenterY = geometry.hubTop + hubHeight / 2
        const deltaX = hubCenterX - centerX
        const deltaY = hubCenterY - centerY
        const distance = Math.hypot(deltaX, deltaY)
        const bridgeHeight = lerp(14, 31, neck) * (1 - smoothstep(0.78, 0.96, progress))
        Object.assign(bridge.style, {
          left: `${centerX - geometry.layerLeft}px`,
          top: `${centerY - geometry.layerTop}px`,
          width: `${distance}px`,
          height: `${bridgeHeight}px`,
          borderRadius: '999px',
          opacity: String(smoothstep(0.06, 0.20, progress) * (1 - smoothstep(0.86, 0.98, progress))),
          transform: `translate3d(0,-50%,0) rotate(${Math.atan2(deltaY, deltaX)}rad)`,
          transformOrigin: 'left center',
        })
      }

      const insetX = Math.max(0, (geometry.widgetWidth - blobWidth) / 2)
      const insetY = Math.max(0, (geometry.widgetHeight - blobHeight) / 2)
      const widgetClip = `inset(${insetY.toFixed(2)}px ${insetX.toFixed(2)}px ${insetY.toFixed(2)}px ${insetX.toFixed(2)}px round ${blobRadius.toFixed(2)}px)`
      widgetElement.style.transform = `translate3d(${(centerX - targetX).toFixed(2)}px,${(centerY - targetY).toFixed(2)}px,0)`
      widgetElement.style.clipPath = widgetClip
      ;(widgetElement.style as CSSStyleDeclaration & { webkitClipPath: string }).webkitClipPath = widgetClip
      widgetElement.style.opacity = String(approach)
      widgetElement.style.pointerEvents = openRef.current && reveal > 0.98 ? 'auto' : 'none'
      widgetElement.style.willChange = 'clip-path, transform, opacity'

      const widgetContent = widgetElement.querySelector<HTMLElement>('[data-pomodoro-content]')
      if (widgetContent) {
        widgetContent.style.opacity = String(reveal)
        widgetContent.style.transform = `translate3d(0,${lerp(8, 0, reveal).toFixed(2)}px,0)`
        widgetContent.style.pointerEvents = reveal > 0.98 ? 'auto' : 'none'
      }
      if (hubContentRef.current) {
        hubContentRef.current.style.opacity = String(1 - smoothstep(0.12, 0.34, progress))
      }
    }

    const spring = new LiquidMorphSpring(
      (value) => render(value),
      (target) => {
        movingRef.current = false
        if (gooLayerRef.current) gooLayerRef.current.style.visibility = 'hidden'
        hub.style.removeProperty('will-change')
        widget.style.removeProperty('will-change')
        if (target === 1) {
          widget.style.removeProperty('clip-path')
          widget.style.removeProperty('-webkit-clip-path')
        }
        onSettledRef.current(target === 1)
      },
    )
    springRef.current = spring
    measureRef.current = setGeometry
    renderRef.current = render

    const start = () => {
      setGeometry()
      movingRef.current = true
      const gooLayer = gooLayerRef.current
      if (gooLayer) gooLayer.style.visibility = 'visible'
      if (modeRef.current === 'full') {
        spring.setTarget(openRef.current ? 1 : 0)
      } else {
        spring.setImmediate(openRef.current ? 1 : 0)
      }
    }

    if (open) start()
    const resize = () => {
      // Once closed, the shared Hub morph owns its DOM again. A scroll must
      // never repaint progress=0 (an expanded panel) over its compact state.
      if (!movingRef.current && !openRef.current) return
      setGeometry()
      if (movingRef.current) render(spring.value)
    }
    window.addEventListener('resize', resize)
    window.addEventListener('scroll', resize, true)
    window.visualViewport?.addEventListener('resize', resize)
    const unsubscribe = position.on('change', resize)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', resize, true)
      window.visualViewport?.removeEventListener('resize', resize)
      unsubscribe()
      spring.destroy()
      springRef.current = null
    }
  // One spring instance owns both directions so reversals preserve velocity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubRef, sourceRef, widgetRef, hubContentRef, position])

  useLayoutEffect(() => {
    const spring = springRef.current
    if (!spring) return
    if (previousOpenRef.current === open) {
      if (movingRef.current && motionMode !== 'full') spring.setImmediate(open ? 1 : 0)
      return
    }
    previousOpenRef.current = open
    const hub = hubRef.current
    const widget = widgetRef.current
    if (!hub || !widget) return
    measureRef.current()
    movingRef.current = true
    renderRef.current(spring.value)
    openRef.current = open
    const gooLayer = gooLayerRef.current
    if (gooLayer) gooLayer.style.visibility = 'visible'
    if (motionMode === 'full') {
      spring.setTarget(open ? 1 : 0)
    } else {
      spring.setImmediate(open ? 1 : 0)
    }
  }, [open, motionMode, hubRef, sourceRef, widgetRef])

  return (
    <div
      ref={gooLayerRef}
      aria-hidden="true"
      className="pomodoro-liquid-geometry pointer-events-none absolute z-[1]"
      style={{ filter: `url(#${filterId}) drop-shadow(0 12px 24px rgba(0,0,0,0.28))`, visibility: 'hidden' }}
    >
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <defs>
          <filter id={filterId} x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="liquid-blur" />
            <feColorMatrix in="liquid-blur" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 24 -11" />
            <feComponentTransfer><feFuncA type="linear" slope="0.58" /></feComponentTransfer>
          </filter>
        </defs>
      </svg>
      <div ref={hubBlobRef} className="pomodoro-liquid-blob" />
      <div ref={bridgeRef} className="pomodoro-liquid-blob" />
      <div ref={widgetBlobRef} className="pomodoro-liquid-blob" />
    </div>
  )
}
