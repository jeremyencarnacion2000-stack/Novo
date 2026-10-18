'use client'

import type { ModalOrigin } from '@/lib/liquid-modal-motion'

let last: (ModalOrigin & { at: number }) | null = null
let listeners = 0
export function rememberModalOrigin(element: HTMLElement | null) {
  if (!element || element === document.body) { last = null; return }
  const r = element.getBoundingClientRect()
  last = { element, rect: { left: r.left, top: r.top, width: r.width, height: r.height }, at: performance.now() }
}
export function readModalOrigin(): ModalOrigin {
  return last && performance.now() - last.at < 1500 ? { element: last.element, rect: last.rect } : { element: null, rect: null }
}
export function restoreModalOriginFocus(event: Event, origin: HTMLElement | null | undefined) {
  if (event.defaultPrevented || !origin?.isConnected || origin.matches(':disabled') || origin.closest('[inert]')) return
  const focusTarget = origin.closest<HTMLElement>('button,a[href],input,textarea,select,[tabindex]')
  if (!focusTarget) return
  event.preventDefault()
  focusTarget.focus({ preventScroll: true })
}
function onActivation(event: Event) {
  if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') {
    if (event.metaKey || event.ctrlKey || event.key === 'Escape') last = null
    return
  }
  const target = event.target instanceof Element ? event.target : null
  rememberModalOrigin(target?.closest<HTMLElement>('[data-flip-from],button,a,[role="button"],[role="menuitem"]') ?? null)
}
/** Reference-counted so split bundles and nested providers cannot add duplicates. */
export function trackModalOrigins() {
  if (++listeners === 1) {
    document.addEventListener('pointerdown', onActivation, true)
    document.addEventListener('click', onActivation, true)
    document.addEventListener('keydown', onActivation, true)
  }
  return () => {
    if (--listeners !== 0) return
    document.removeEventListener('pointerdown', onActivation, true)
    document.removeEventListener('click', onActivation, true)
    document.removeEventListener('keydown', onActivation, true)
    last = null
  }
}
