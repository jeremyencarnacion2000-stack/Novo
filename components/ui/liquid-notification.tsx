'use client'

import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { animate, motion, useDragControls, useMotionValue, type MotionValue } from 'framer-motion'
import { useNovoMotionPolicy } from '@/hooks/use-novo-motion-policy'
import { buildLiquidNoticeGeometry, getLiquidNoticeLayout, LIQUID_NOTICE, type LiquidNoticeLayout } from '@/lib/liquid-notification'

/** One retained notice, one queued replacement, and one owner for the entire flight. */
export function LiquidNotification({
  noticeKey, sourceRef, children, onDismiss, onPresented, sourcePosition, side = 'below', urgent = false,
}: {
  noticeKey: string | null
  sourceRef: RefObject<HTMLElement | null>
  children: ReactNode
  onDismiss: () => void
  onPresented?: () => void
  sourcePosition?: MotionValue<number>
  side?: 'below' | 'left'
  urgent?: boolean
}) {
  const mode = useNovoMotionPolicy()
  const filterId = `novo-notice-${useId().replace(/:/g, '')}`
  const latest = useRef({ key: noticeKey, content: children })
  latest.current = { key: noticeKey, content: children }
  const [notice, setNotice] = useState<{ key: string; content: ReactNode } | null>(null)
  const [visible, setVisible] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const blobRef = useRef<SVGRectElement>(null)
  const neckRef = useRef<SVGPathElement>(null)
  const originRef = useRef<SVGRectElement>(null)
  const layoutRef = useRef<LiquidNoticeLayout | null>(null)
  const paintRef = useRef<() => void>(() => {})
  const drop = useMotionValue(0)
  const expand = useMotionValue(0)
  const reveal = useMotionValue(0)
  const dragY = useMotionValue(0)
  const dragControls = useDragControls()
  const presented = useRef<string | null>(null)
  const onPresentedRef = useRef(onPresented)
  onPresentedRef.current = onPresented

  useLayoutEffect(() => {
    if (!notice && noticeKey) {
      setNotice({ key: noticeKey, content: latest.current.content })
      setVisible(true)
    } else if (notice) setVisible(notice.key === noticeKey)
  }, [noticeKey, notice])

  const exitComplete = useCallback(() => {
    const next = latest.current
    setNotice(next.key ? { key: next.key, content: next.content } : null)
    setVisible(Boolean(next.key))
    dragY.set(0)
  }, [dragY])

  useLayoutEffect(() => {
    if (!notice) return
    const card = cardRef.current
    const svg = svgRef.current
    const content = contentRef.current
    if (!card || !svg || !content) return
    const paint = () => {
      const layout = layoutRef.current
      if (!layout) return
      const geometry = buildLiquidNoticeGeometry(drop.get(), expand.get(), layout)
      const drag = dragY.get()
      const r = Math.min(1, Math.max(0, reveal.get()))
      // Only the three decorative shapes enter the goo filter. Text stays sharp.
      blobRef.current?.setAttribute('x', String(geometry.x))
      blobRef.current?.setAttribute('y', String(geometry.y + drag))
      blobRef.current?.setAttribute('width', String(geometry.width))
      blobRef.current?.setAttribute('height', String(geometry.height))
      blobRef.current?.setAttribute('rx', String(geometry.radius))
      neckRef.current?.setAttribute('d', `M${geometry.sourceX},${geometry.sourceY} L${geometry.centerX},${geometry.centerY + drag}`)
      neckRef.current?.setAttribute('stroke-width', String(geometry.neckWidth))
      svg.style.visibility = mode === 'full' && drop.get() > 0.001 && r < 0.999 ? 'visible' : 'hidden'
      svg.style.opacity = String(1 - r)
      card.style.opacity = String(r)
      card.style.visibility = r > 0.001 ? 'visible' : 'hidden'
      card.style.pointerEvents = visible && r > 0.8 ? 'auto' : 'none'
      const x = mode === 'full' ? geometry.offsetX : 0
      const y = mode === 'full' ? geometry.offsetY : 0
      card.style.translate = `${x}px ${y}px`
      card.dataset.liquidPhase = visible ? (r > 0.999 ? 'visible' : 'entering') : 'exiting'
    }
    paintRef.current = paint
    const measure = () => {
      const box = sourceRef.current?.getBoundingClientRect()
      if (!box || !box.width || !box.height) return
      const topPosition = sourcePosition?.get() ?? box.top
      const source = { left: box.left, top: topPosition, width: box.width, height: box.height, right: box.right, bottom: topPosition + box.height }
      const viewport = { width: window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight }
      let layout = getLiquidNoticeLayout(source, viewport, side)
      card.style.width = `${layout.card.width}px`
      layout = getLiquidNoticeLayout(source, viewport, side, content.scrollHeight)
      if (!visible && layoutRef.current) layout.card = { ...layoutRef.current.card }
      // Both real origins can notify at once. Reserve the other notice's final
      // rectangle, not its currently travelling presentation rectangle.
      document.querySelectorAll<HTMLElement>('[data-liquid-notice]').forEach(other => {
        if (other === card) return
        const left = parseFloat(other.style.left), top = parseFloat(other.style.top)
        const width = parseFloat(other.style.width), height = parseFloat(other.style.height)
        const box = layout.card
        if (box.left < left + width + 12 && box.left + box.width + 12 > left && box.top < top + height + 12 && box.top + box.height + 12 > top) {
          const below = top + height + 12
          const above = top - box.height - 12
          if (below + box.height <= viewport.height - 16) box.top = below
          else if (above >= 16) box.top = above
        }
      })
      layoutRef.current = layout
      Object.assign(card.style, { left: `${layout.card.left}px`, top: `${layout.card.top}px`, height: `${layout.card.height}px` })
      // Bound the filter to the flight corridor rather than a screen-sized texture.
      const padding = 48
      const left = Math.min(source.left, layout.card.left) - padding
      const top = Math.min(source.top, layout.card.top) - padding
      const width = Math.max(source.right, layout.card.left + layout.card.width) - left + padding
      const height = Math.max(source.bottom, layout.card.top + layout.card.height) - top + padding
      Object.assign(svg.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` })
      svg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`)
      const inset = LIQUID_NOTICE.blur * 0.26
      originRef.current?.setAttribute('x', String(source.left + inset))
      originRef.current?.setAttribute('y', String(source.top + inset))
      originRef.current?.setAttribute('width', String(Math.max(1, source.width - inset * 2)))
      originRef.current?.setAttribute('height', String(Math.max(1, source.height - inset * 2)))
      originRef.current?.setAttribute('rx', String(Math.min(source.width, source.height) / 2))
      paint()
    }
    measure()
    const unsubscribes = [drop, expand, reveal, dragY].map(value => value.on('change', paint))
    if (sourcePosition) unsubscribes.push(sourcePosition.on('change', measure))
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(content)
    if (sourceRef.current) observer?.observe(sourceRef.current)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe())
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [notice?.key, sourceRef, sourcePosition, side, mode, visible, drop, expand, reveal, dragY])

  useLayoutEffect(() => {
    if (!notice) return
    let cancelled = false
    const finish = () => {
      if (cancelled) return
      if (!visible) exitComplete()
      else if (presented.current !== notice.key) {
        presented.current = notice.key
        onPresentedRef.current?.()
      }
    }
    const controls: Array<{ stop: () => void }> = []
    if (mode !== 'full') {
      drop.set(visible ? 1 : 0)
      expand.set(visible ? 1 : 0)
      const control = animate(reveal, visible ? 1 : 0, { duration: mode === 'off' ? 0 : 0.16 })
      controls.push(control)
      void control.then(finish)
    } else if (visible) {
      controls.push(animate(drop, 1, LIQUID_NOTICE.springs.drop))
      controls.push(animate(expand, 1, { ...LIQUID_NOTICE.springs.expand, delay: LIQUID_NOTICE.enter.expand / 1000 }))
      const revealing = animate(reveal, 1, { ...LIQUID_NOTICE.springs.reveal, delay: LIQUID_NOTICE.enter.reveal / 1000 })
      controls.push(revealing)
      void revealing.then(finish)
    } else {
      controls.push(animate(reveal, 0, LIQUID_NOTICE.springs.fade))
      controls.push(animate(dragY, 0, LIQUID_NOTICE.springs.fade))
      controls.push(animate(expand, 0, { ...LIQUID_NOTICE.springs.collapse, delay: LIQUID_NOTICE.exit.collapse / 1000 }))
      const returning = animate(drop, 0, { ...LIQUID_NOTICE.springs.return, delay: LIQUID_NOTICE.exit.drop / 1000 })
      controls.push(returning)
      void returning.then(finish)
    }
    paintRef.current()
    return () => { cancelled = true; controls.forEach(control => control.stop()) }
  }, [visible, notice?.key, mode, drop, expand, reveal, dragY, exitComplete])

  if (!notice || typeof document === 'undefined') return null
  return createPortal(
    <div className="novo-liquid-notice" data-liquid-notice-origin={side}>
      <svg ref={svgRef} aria-hidden="true" className="fixed pointer-events-none z-[202]" style={{ visibility: 'hidden', overflow: 'visible' }}>
        <defs>
          <filter id={filterId} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={LIQUID_NOTICE.blur} />
            <feColorMatrix type="matrix" values={`1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${LIQUID_NOTICE.gain} ${-LIQUID_NOTICE.gain * LIQUID_NOTICE.threshold}`} />
          </filter>
        </defs>
        <g filter={`url(#${filterId})`} fill="currentColor" stroke="currentColor">
          <rect ref={originRef} stroke="none" />
          <path ref={neckRef} strokeLinecap="round" fill="none" />
          <rect ref={blobRef} stroke="none" />
        </g>
      </svg>
      <motion.div ref={cardRef} data-liquid-notice data-liquid-phase="entering" className="novo-liquid-notice-card fixed z-[203] rounded-[28px] border border-border/60 bg-background/95 text-foreground shadow-2xl"
          style={{ y: dragY, visibility: 'hidden', opacity: 0, pointerEvents: 'none' }} inert={!visible}
          drag={mode === 'full' ? 'y' : false} dragControls={dragControls} dragListener={false} dragConstraints={{ top: -120, bottom: 24 }} dragElastic={0.15}
          onDragEnd={(_, info) => {
            if (info.offset.y < -18 || info.velocity.y < -420) onDismiss()
            else animate(dragY, 0, { type: 'spring', duration: 0.56, bounce: 0.3 })
          }}
        >
          <div ref={contentRef} role={urgent ? 'alert' : 'status'} aria-live={urgent ? 'assertive' : 'polite'} aria-atomic="true" style={{ touchAction: 'pan-y' }}>
            {mode === 'full' && <span aria-hidden="true" onPointerDown={event => dragControls.start(event)} className="absolute left-1/2 top-0 z-10 flex h-5 w-16 -translate-x-1/2 cursor-grab justify-center pt-1.5 active:cursor-grabbing" style={{ touchAction: 'none' }}><span className="h-[3px] w-6 rounded-full bg-foreground/15" /></span>}
            {notice.key === noticeKey ? children : notice.content}
          </div>
      </motion.div>
    </div>, document.body,
  )
}
