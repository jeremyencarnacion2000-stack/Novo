/**
 * Novo SVG Morphing Engine & NIX Architecture v1.0
 *
 * Direct entrypoint that exports NIX modules and utilities.
 */

// Re-export NIX JSX components and Framer Motion elements
export * from './morph'

// ─── LEVEL 1: View Transition API Fallback Wrapper ──────────────────────────────

/**
 * startMorphTransition
 * Triggers document view transition if supported, otherwise performs callback synchronously.
 */
export function startMorphTransition(callback: () => void | Promise<void>) {
  if (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    typeof (document as any).startViewTransition === 'function'
  ) {
    ;(document as any).startViewTransition(callback)
  } else {
    const res = callback()
    if (res instanceof Promise) {
      res.catch((err) => console.error('[NIX] startViewTransition failed', err))
    }
  }
}

// ─── LEVEL 2: FLIP Animation helper ─────────────────────────────────────────────

/**
 * calculateFLIPRects
 * Captures initial position, performs DOM updates, then animates layout changes.
 */
export function calculateFLIPRects(element: HTMLElement) {
  const first = element.getBoundingClientRect()
  return {
    animate: (nextElement: HTMLElement) => {
      const last = nextElement.getBoundingClientRect()
      const invertX = first.left - last.left
      const invertY = first.top - last.top
      const invertScaleX = first.width / last.width
      const invertScaleY = first.height / last.height

      nextElement.style.transform = `translate(${invertX}px, ${invertY}px) scale(${invertScaleX}, ${invertScaleY})`
      nextElement.style.transition = 'none'

      requestAnimationFrame(() => {
        nextElement.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)'
        nextElement.style.transform = ''
      })
    },
  }
}
