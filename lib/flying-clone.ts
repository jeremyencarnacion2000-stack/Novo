'use client'

import { gsap } from 'gsap'

// Shared "literal cloned DOM node that flies from A to B" primitive, used by
// both the modal container-transform (lib/modal-flip.ts) and the anchored
// Select treatment (lib/select-flip.ts) so the two don't hand-roll the same
// clone/measure/tween logic twice.

export function isSvgIcon(el: HTMLElement): boolean {
  return el.tagName.toLowerCase() === 'svg'
}

// SVGs and <img> are both "replaced elements" — sized via width/height, not
// font metrics. A book cover shared-item needs this too: it must scale from
// its small grid-thumbnail rect to the modal's larger cover rect mid-flight.
function isBoxSized(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase()
  return tag === 'svg' || tag === 'img'
}

/**
 * Clones `originEl` into a fixed-position floating element matching its
 * exact current rect/appearance. SVG icons (Lucide renders as literal
 * `<svg>`) are sized via width/height — that's what actually controls an
 * SVG's rendered size. Text elements are sized via font properties instead,
 * matching the reference exactly (resizing a text node's box doesn't change
 * its visual size; font-size does).
 */
export function createFlyingClone(originEl: HTMLElement, zIndex = 5003): HTMLElement {
  const rect = originEl.getBoundingClientRect()
  const cs = getComputedStyle(originEl)
  const clone = originEl.cloneNode(true) as HTMLElement
  clone.removeAttribute('data-shared-item')
  clone.setAttribute('data-flying-clone', '')
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    margin: '0',
    zIndex: String(zIndex),
    pointerEvents: 'none',
    transition: 'none',
  } as CSSStyleDeclaration)
  if (isBoxSized(originEl)) {
    clone.style.width = `${rect.width}px`
    clone.style.height = `${rect.height}px`
  } else {
    clone.style.fontSize = cs.fontSize
    clone.style.fontWeight = cs.fontWeight
    clone.style.color = cs.color
    clone.style.letterSpacing = cs.letterSpacing
    clone.style.lineHeight = cs.lineHeight
    clone.style.whiteSpace = 'nowrap'
  }
  document.body.appendChild(clone)
  return clone
}

/** Adds a tween animating a flying clone to match `destEl`'s current rect/style. */
export function flyTo(tl: gsap.core.Timeline, el: HTMLElement, destEl: HTMLElement, duration: number, position: number) {
  const rect = destEl.getBoundingClientRect()
  const cs = getComputedStyle(destEl)
  const vars: gsap.TweenVars = { left: rect.left, top: rect.top, duration }
  if (isBoxSized(destEl)) {
    vars.width = rect.width
    vars.height = rect.height
  } else {
    vars.fontSize = cs.fontSize
    vars.fontWeight = cs.fontWeight
    vars.color = cs.color
    vars.letterSpacing = cs.letterSpacing
  }
  tl.to(el, vars, position)
}
