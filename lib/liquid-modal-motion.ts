'use client'

import { Spring } from '@/lib/hub-surface-motion'
import { copyBridgeMaterial } from '@/lib/modal-motion'
import { getNovoMotionModeFromDOM } from '@/hooks/use-novo-motion-policy'
import { buildLiquidModalGeometry, getLiquidModalBounds, LIQUID_MODAL, modalClamp, modalSegment, resolveLiquidModalSource } from '@/lib/liquid-modal'
import type { LiquidRect } from '@/lib/liquid-notification'

export type ModalOrigin = { element: HTMLElement | null; rect: LiquidRect | null }
export type LiquidModalController = { open: () => void; close: (done: () => void) => void; destroy: () => void }
let serial = 0
const overlays = new WeakMap<HTMLElement, HTMLElement>()
export const getLiquidModalOverlay = (surface: HTMLElement) => overlays.get(surface) ?? null
const svgNS = 'http://www.w3.org/2000/svg'
const box = (element: HTMLElement): LiquidRect => {
  const r = element.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}
const visible = (r: LiquidRect) => r.width > 0 && r.height > 0 && r.left < window.innerWidth && r.top < window.innerHeight && r.left + r.width > 0 && r.top + r.height > 0
const save = (element: HTMLElement, properties: string[]) => {
  const values = properties.map((property) => [property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)])
  return () => values.forEach(([property, value, priority]) => value ? element.style.setProperty(property, value, priority) : element.style.removeProperty(property))
}

/** One progress spring owns chrome, neck, material, shared glyphs and reveal.
 * Radix keeps the real form at its final dimensions throughout the flight. */
export function createLiquidModalMotion({ surface, overlay = null, origin = null, originRect = null, onOpened }: {
  surface: HTMLElement; overlay?: HTMLElement | null; origin?: HTMLElement | null; originRect?: LiquidRect | null
  onOpened?: () => void
}): LiquidModalController {
  const spring = new Spring(0, LIQUID_MODAL.response, LIQUID_MODAL.damping)
  if (overlay) overlays.set(surface, overlay)
  const restoreSurface = save(surface, ['opacity', 'transform', 'will-change', 'z-index'])
  const restoreOverlay = overlay ? save(overlay, ['opacity', 'z-index']) : () => undefined
  const restoreOrigin = origin ? save(origin, ['opacity', 'transition']) : () => undefined
  const positioner = surface.closest<HTMLElement>('[data-modal-positioner]')
  const restorePositioner = positioner ? save(positioner, ['z-index']) : () => undefined
  const previousLayers = [...document.querySelectorAll<HTMLElement>('[data-liquid-modal-layer]')]
  const layer = Math.max(5001, Number.parseInt(getComputedStyle(surface).zIndex) || 0,
    ...previousLayers.filter((el) => el !== surface).map((el) => (Number.parseInt(el.style.zIndex) || 5001) + 3))
  surface.dataset.liquidModalLayer = ''
  surface.style.zIndex = String(layer)
  if (positioner) positioner.style.zIndex = String(layer)
  if (overlay) overlay.style.zIndex = String(layer - 1)
  let frame: number | null = null
  let previousTime: number | null = null
  let destroyed = false
  let desired: 0 | 1 = 0
  let completion: (() => void) | null = null
  let mode = getNovoMotionModeFromDOM()
  let reducedFrom = 0
  let reducedElapsed = 0
  let bridge: HTMLElement | null = null
  let paint: ((p: number) => void) | null = null
  const cleanups: Array<() => void> = []
  let savedSource = originRect ?? (origin && visible(box(origin)) ? box(origin) : null)

  const setState = (state: string) => {
    surface.dataset.modalMotionState = state
    if (overlay) overlay.dataset.modalMotionState = state
  }
  const clearChrome = () => {
    bridge?.remove(); bridge = null; paint = null
    cleanups.splice(0).forEach((cleanup) => cleanup())
    restoreOrigin()
  }
  const makeChrome = () => {
    if (bridge || mode !== 'full') return
    const target = box(surface)
    if (target.width <= 0 || target.height <= 0) return
    const liveSource = origin?.isConnected ? box(origin) : null
    if (liveSource && visible(liveSource)) savedSource = liveSource
    const source = resolveLiquidModalSource(savedSource && visible(savedSource) ? savedSource : null, target)
    const bounds = getLiquidModalBounds(source, target)
    const sourceRadius = origin ? Number.parseFloat(getComputedStyle(origin).borderTopLeftRadius) || Math.min(source.width, source.height) / 2 : 26
    const radius = Math.min(Number.parseFloat(getComputedStyle(surface).borderTopLeftRadius) || 0, target.width / 2, target.height / 2)
    const root = document.createElement('div')
    root.dataset.liquidModalBridge = ''; root.dataset.modalMotionBridge = ''
    root.setAttribute('aria-hidden', 'true'); root.setAttribute('inert', '')
    Object.assign(root.style, { position: 'fixed', left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`, pointerEvents: 'none', zIndex: String(layer + 1), overflow: 'visible', contain: 'layout style' })
    const svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('width', String(bounds.width)); svg.setAttribute('height', String(bounds.height))
    Object.assign(svg.style, { position: 'absolute', inset: '0', overflow: 'visible' })
    const defs = document.createElementNS(svgNS, 'defs')
    const filter = document.createElementNS(svgNS, 'filter')
    const filterId = `novo-modal-goo-${++serial}`
    filter.id = filterId
    filter.setAttribute('x', '-10%'); filter.setAttribute('y', '-10%'); filter.setAttribute('width', '120%'); filter.setAttribute('height', '120%')
    const blur = document.createElementNS(svgNS, 'feGaussianBlur'); blur.setAttribute('stdDeviation', '5'); blur.setAttribute('result', 'blur')
    const matrix = document.createElementNS(svgNS, 'feColorMatrix'); matrix.setAttribute('in', 'blur'); matrix.setAttribute('type', 'matrix'); matrix.setAttribute('values', '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -9')
    filter.append(blur, matrix); defs.append(filter); svg.append(defs)
    const group = document.createElementNS(svgNS, 'g'); group.setAttribute('filter', `url(#${filterId})`)
    const color = getComputedStyle(surface).backgroundColor
    group.setAttribute('fill', color === 'rgba(0, 0, 0, 0)' || color === 'transparent' ? 'var(--background, #111113)' : color)
    const sourceBody = document.createElementNS(svgNS, 'rect')
    const neck = document.createElementNS(svgNS, 'path')
    const drop = document.createElementNS(svgNS, 'rect')
    sourceBody.setAttribute('x', String(source.left - bounds.left)); sourceBody.setAttribute('y', String(source.top - bounds.top))
    sourceBody.setAttribute('width', String(source.width)); sourceBody.setAttribute('height', String(source.height)); sourceBody.setAttribute('rx', String(sourceRadius))
    group.append(sourceBody, neck, drop); svg.append(group); root.append(svg)
    const skin = document.createElement('div')
    const compact = document.createElement('div'); const expanded = document.createElement('div')
    copyBridgeMaterial(compact, origin ?? surface); copyBridgeMaterial(expanded, surface)
    for (const item of [compact, expanded]) Object.assign(item.style, { borderRadius: 'inherit', filter: 'none', transform: 'none' })
    Object.assign(skin.style, { position: 'absolute', overflow: 'hidden', pointerEvents: 'none', boxShadow: getComputedStyle(surface).boxShadow, willChange: 'transform,width,height,border-radius' })
    skin.append(compact, expanded); root.append(skin); document.body.append(root); bridge = root
    if (origin) { origin.style.transition = 'none'; origin.style.opacity = '0' }

    // Typography crosses over at its real two sizes; glyphs are never scaled.
    const shared = origin ? [...origin.querySelectorAll<HTMLElement>('[data-shared-item]')].flatMap((from) => {
      const to = [...surface.querySelectorAll<HTMLElement>('[data-shared-item]')].find((el) => el.dataset.sharedItem === from.dataset.sharedItem)
      if (!to) return []
      const fromBox = box(from), toBox = box(to)
      if (fromBox.width <= 0 || toBox.width <= 0) return []
      const layers = [from, to].map((element, index) => {
        const copy = element.cloneNode(true) as HTMLElement
        copy.removeAttribute('id'); copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'))
        copy.removeAttribute('data-shared-item'); copy.setAttribute('aria-hidden', 'true'); copy.setAttribute('inert', '')
        copy.dataset.flyingClone = ''
        const styles = getComputedStyle(element), r = index === 0 ? fromBox : toBox
        Object.assign(copy.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0', pointerEvents: 'none', zIndex: String(layer + 2), font: styles.font, color: styles.color, letterSpacing: styles.letterSpacing, lineHeight: styles.lineHeight, transition: 'none', transform: 'none', whiteSpace: 'nowrap' })
        document.body.append(copy); return copy
      })
      const restoreFrom = save(from, ['opacity']), restoreTo = save(to, ['opacity'])
      from.style.opacity = '0'; to.style.opacity = '0'
      cleanups.push(() => { layers.forEach((el) => el.remove()); restoreFrom(); restoreTo() })
      return [{ fromBox, toBox, layers }]
    }) : []
    paint = (progress) => {
      const p = modalClamp(progress)
      const g = buildLiquidModalGeometry(p, source, target, sourceRadius, radius)
      const x = g.left - bounds.left, y = g.top - bounds.top
      Object.assign(skin.style, { width: `${g.width}px`, height: `${g.height}px`, transform: `translate3d(${x}px,${y}px,0)`, borderRadius: `${g.radius}px` })
      compact.style.opacity = String(1 - modalSegment(p, 0.06, 0.5)); expanded.style.opacity = String(modalSegment(p, 0.06, 0.5))
      for (const [name, value] of Object.entries({ x, y, width: g.width, height: g.height, rx: g.radius })) drop.setAttribute(name, String(value))
      const sx = source.left + source.width / 2 - bounds.left, sy = source.top + source.height / 2 - bounds.top
      const dx = x + g.width / 2, dy = y + g.height / 2, distance = Math.hypot(dx - sx, dy - sy)
      const amount = g.neck * (1 - modalSegment(distance, 70, 190))
      const half = Math.min(source.width, source.height, 48) * amount * 0.42
      const nx = distance > 0 ? -(dy - sy) / distance * half : half, ny = distance > 0 ? (dx - sx) / distance * half : 0
      neck.setAttribute('d', `M ${sx + nx} ${sy + ny} Q ${(sx + dx) / 2} ${(sy + dy) / 2} ${dx + nx} ${dy + ny} L ${dx - nx} ${dy - ny} Q ${(sx + dx) / 2} ${(sy + dy) / 2} ${sx - nx} ${sy - ny} Z`)
      neck.style.opacity = String(amount); sourceBody.style.opacity = String(1 - modalSegment(p, 0.14, 0.44))
      root.style.opacity = String(1 - g.reveal)
      surface.style.opacity = String(g.reveal)
      shared.forEach(({ fromBox, toBox, layers }) => {
        const travel = modalSegment(p, 0.1, 0.94), crossfade = modalSegment(p, 0.35, 0.78)
        const deltaX = toBox.left - fromBox.left, deltaY = toBox.top - fromBox.top
        layers[0].style.transform = `translate3d(${deltaX * travel}px,${deltaY * travel}px,0)`
        layers[1].style.transform = `translate3d(${deltaX * (travel - 1)}px,${deltaY * (travel - 1)}px,0)`
        layers[0].style.opacity = String(1 - crossfade); layers[1].style.opacity = String(crossfade)
      })
    }
  }
  const render = () => {
    if (mode === 'full') {
      try { makeChrome(); if (paint) paint(spring.value); else surface.style.opacity = String(modalClamp(spring.value)) }
      catch { clearChrome(); mode = 'reduced'; reducedFrom = spring.value; reducedElapsed = 0; surface.style.opacity = String(modalClamp(spring.value)) }
    }
    else surface.style.opacity = String(modalClamp(spring.value))
    if (overlay) overlay.style.opacity = String(modalSegment(spring.value, 0, 0.7))
  }
  const settle = () => {
    spring.set(desired); clearChrome()
    surface.style.opacity = desired ? '1' : '0'
    surface.style.willChange = ''
    if (overlay) overlay.style.opacity = desired ? '1' : '0'
    setState(desired ? 'open' : 'closed')
    if (desired) onOpened?.()
    if (!desired) { const done = completion; completion = null; done?.() }
  }
  const tick = (time: number) => {
    frame = null
    if (destroyed) return
    const dt = previousTime === null ? 1 / 60 : Math.min(0.1, Math.max(0, (time - previousTime) / 1000))
    previousTime = time
    if (mode === 'full') spring.step(dt)
    else { reducedElapsed += dt; spring.value = reducedFrom + (desired - reducedFrom) * modalSegment(reducedElapsed, 0, 0.16) }
    if (mode === 'off' || (mode === 'full' ? spring.settled : reducedElapsed >= 0.16)) { settle(); return }
    render(); frame = requestAnimationFrame(tick)
  }
  const retarget = (next: 0 | 1) => {
    if (destroyed) return
    desired = next; spring.target = next
    mode = getNovoMotionModeFromDOM()
    spring.configure(next ? LIQUID_MODAL.response : LIQUID_MODAL.closeResponse, LIQUID_MODAL.damping)
    reducedFrom = spring.value; reducedElapsed = 0
    setState(next ? 'opening' : 'closing')
    if (mode !== 'full') clearChrome()
    if (mode === 'off' || (spring.value === next && spring.velocity === 0)) {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null; settle(); return
    }
    surface.style.willChange = 'opacity'
    render()
    if (frame === null) { previousTime = null; frame = requestAnimationFrame(tick) }
  }
  const preferences = new MutationObserver(() => {
    const nextMode = getNovoMotionModeFromDOM()
    if (nextMode !== mode) retarget(desired)
  })
  preferences.observe(document.documentElement, { attributes: true, attributeFilter: ['data-novo-motion'] })
  const settleForViewport = () => {
    if (frame === null) return
    cancelAnimationFrame(frame); frame = null; settle()
  }
  window.addEventListener('resize', settleForViewport)
  window.visualViewport?.addEventListener('resize', settleForViewport)
  return {
    open: () => { completion = null; retarget(1) },
    close: (done) => { completion = done; retarget(0) },
    destroy: () => {
      destroyed = true; completion = null
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null; preferences.disconnect(); clearChrome()
      window.removeEventListener('resize', settleForViewport); window.visualViewport?.removeEventListener('resize', settleForViewport)
      restoreSurface(); restoreOverlay(); restorePositioner(); delete surface.dataset.liquidModalLayer
      overlays.delete(surface)
      surface.style.opacity = '1'; setState('open')
    },
  }
}
