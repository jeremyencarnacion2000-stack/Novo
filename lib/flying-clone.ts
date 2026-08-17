'use client'

import { gsap } from 'gsap'

// Shared "literal cloned DOM node that flies from A to B" primitive, used by
// both the modal container-transform (lib/modal-flip.ts) and the anchored
// Select treatment (lib/select-flip.ts).

export function isSvgIcon(el: HTMLElement): boolean {
  return el.tagName.toLowerCase() === 'svg'
}

function isBoxSized(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase()
  return tag === 'svg' || tag === 'img' || el.children.length > 0
}

/**
 * Clones `originEl` into a fixed-position floating element matching its
 * exact current rect/appearance. Animates position, size, font properties,
 * border-radius, and background-color for ultra-fluid native-grade morphs.
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
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    borderRadius: cs.borderRadius,
    backgroundColor: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : 'transparent',
    boxShadow: cs.boxShadow !== 'none' ? cs.boxShadow : 'none',
    zIndex: String(zIndex),
    pointerEvents: 'none',
    transition: 'none',
    // Geometry is already captured from getBoundingClientRect. Do not copy a
    // trigger's live transform and then add a second transform on top of it.
    transform: 'none',
    transformOrigin: 'top left',
    // Keep the shared element crisp. A blurred clone stacked over a blurred
    // source reads as a discontinuity rather than motion on dense surfaces.
    filter: 'none',
    // The bridge is composited with transforms. Animating layout properties
    // here forces a reflow on every frame and is the source of the visible
    // hitch when a shared element crosses into a dialog.
    willChange: 'transform, border-radius, background-color',
  } as CSSStyleDeclaration)

  if (!isBoxSized(originEl)) {
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
export function flyTo(
  tl: gsap.core.Timeline,
  el: HTMLElement,
  destEl: HTMLElement,
  duration: number,
  position: number,
  options: { blur?: number } = {},
) {
  const sourceRect = el.getBoundingClientRect()
  const rect = destEl.getBoundingClientRect()
  const cs = getComputedStyle(destEl)
  
  const vars: gsap.TweenVars = {
    x: rect.left - sourceRect.left,
    y: rect.top - sourceRect.top,
    scaleX: sourceRect.width ? rect.width / sourceRect.width : 1,
    scaleY: sourceRect.height ? rect.height / sourceRect.height : 1,
    duration,
    filter: `blur(${options.blur ?? 0}px)`,
  }

  if (cs.borderRadius && cs.borderRadius !== '0px') {
    vars.borderRadius = cs.borderRadius
  }

  if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
    vars.backgroundColor = cs.backgroundColor
  }

  if (!isBoxSized(destEl)) {
    vars.fontSize = cs.fontSize
    vars.fontWeight = cs.fontWeight
    vars.color = cs.color
    vars.letterSpacing = cs.letterSpacing
  }

  tl.to(el, vars, position)
}
