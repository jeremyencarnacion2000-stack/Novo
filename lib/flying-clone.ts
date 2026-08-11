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
    // A short blur at the leading edge makes the shared element read as
    // motion, not as a sharp duplicate teleporting between surfaces.
    filter: 'blur(8px)',
    willChange: 'left, top, width, height, border-radius, background-color, filter',
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
  const rect = destEl.getBoundingClientRect()
  const cs = getComputedStyle(destEl)
  
  const vars: gsap.TweenVars = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
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
