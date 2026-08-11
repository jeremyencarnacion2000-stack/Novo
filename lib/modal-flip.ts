'use client'

import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { createFlyingClone, flyTo } from './flying-clone'

// Shared-element ("Container Transform") modal animation.
//
// Configuration matches the reference HTML exactly:
//   - CustomEase "appleFluid"  (M0,0 C0.16,1 0.3,1 1,1)  — box morph
//   - CustomEase "contentEntrance" (M0,0 C0.18,1 0.26,1 1,1) — content in
//   - CustomEase "contentExit"  (M0,0 C0.35,0 0.15,1 1,1)  — content out
//   - Open  : 0.52s total | content reveals at 0.12s for 0.44s | stagger 0.05
//   - Close : 0.48s total | content hides first for 0.18s
//   - Viewport depth effect: parent app-root scales 0.94/0.97 with 28px radius
//   - Inner content: y:28 scale:0.91 blur:16px → y:0 scale:1 blur:0
//   - Backdrop: rgba(9,13,22,0.65), no blur, 0.38s open / 0.35s close

// ─── Register plugins once ─────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  gsap.registerPlugin(CustomEase)
  CustomEase.create('appleFluid',      'M0,0 C0.16,1 0.3,1 1,1')
  CustomEase.create('contentEntrance', 'M0,0 C0.18,1 0.26,1 1,1')
  CustomEase.create('contentExit',     'M0,0 C0.35,0 0.15,1 1,1')
}

const EASE_FLUID    = 'appleFluid'
const EASE_ENTRANCE = 'contentEntrance'
const EASE_EXIT     = 'contentExit'

// Open timing — matches reference exactly
const OPEN_DURATION          = 0.52
const OPEN_CONTENT_AT        = 0.12   // content starts revealing at 120 ms
const OPEN_CONTENT_DURATION  = 0.44
const OPEN_CONTENT_STAGGER   = 0.05
const OPEN_BACKDROP_DURATION = 0.38

// Close timing — matches reference exactly
const CLOSE_DURATION          = 0.48
const CLOSE_CONTENT_DURATION  = 0.18
const CLOSE_BACKDROP_DURATION = 0.35

// Viewport depth effect — matches reference exactly
const VIEWPORT_SCALE_MOBILE  = 0.94
const VIEWPORT_SCALE_DESKTOP = 0.97
const VIEWPORT_RADIUS        = '28px'
const VIEWPORT_Y_MOBILE      = -8

function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth < 640
}

/** The single page-root element that shrinks to create depth on modal open. */
function getAppViewport(): HTMLElement | null {
  // Prefer an explicit marker so any wrapper can opt-in without selector magic.
  return (
    document.querySelector<HTMLElement>('[data-app-viewport]') ??
    document.querySelector<HTMLElement>('#appViewport') ??
    null
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function findPair(id: string) {
  const origin  = document.querySelector<HTMLElement>(`[data-flip-from="${id}"]`)
  const target  = document.querySelector<HTMLElement>(`[data-flip-to="${id}"]`)
  const overlay = document.querySelector<HTMLElement>(`[data-flip-overlay="${id}"]`)
  return { origin, target, overlay }
}

interface SharedItemPair {
  originEl: HTMLElement
  targetEl: HTMLElement
}

function findSharedItemPairs(origin: HTMLElement, target: HTMLElement): SharedItemPair[] {
  const originItems = origin.querySelectorAll<HTMLElement>('[data-shared-item]')
  const targetItems = Array.from(target.querySelectorAll<HTMLElement>('[data-shared-item]'))
  const pairs: SharedItemPair[] = []
  originItems.forEach((originEl) => {
    const key = originEl.dataset.sharedItem
    const targetEl = targetItems.find((t) => t.dataset.sharedItem === key)
    if (targetEl) pairs.push({ originEl, targetEl })
  })
  return pairs
}

interface FlyingItem {
  el: HTMLElement
  originEl: HTMLElement
  targetEl: HTMLElement
}

// Timelines that can be killed on a rapid double-toggle.
const activeTimelines = new Map<string, gsap.core.Timeline>()
// Flying clones persist from open through close — they are hidden (opacity 0)
// while the modal is open and reactivate for the return trip on close.
const flyingRegistry  = new Map<string, FlyingItem[]>()

function cleanupFlying(id: string) {
  flyingRegistry.get(id)?.forEach((f) => f.el.remove())
  flyingRegistry.delete(id)
}

function killActive(id: string) {
  activeTimelines.get(id)?.kill()
  activeTimelines.delete(id)
}

// ─── Public API ────────────────────────────────────────────────────────────

export const modalFlip = {
  /** Animates the dialog content growing out of the origin element. */
  toggle(id: string, onDone?: () => void, retries = 3) {
    if (typeof window === 'undefined') { onDone?.(); return }

    const { origin, target, overlay } = findPair(id)

    // If target (Radix Portal content) hasn't mounted into DOM yet, retry next frame
    if (!target && retries > 0) {
      requestAnimationFrame(() => {
        modalFlip.toggle(id, onDone, retries - 1)
      })
      return
    }

    if (!target) {
      onDone?.()
      return
    }

    killActive(id)
    cleanupFlying(id)

    // Mark target and overlay active so CSS keeps them visible
    target.classList.add('modal-flip-active')
    if (overlay) overlay.classList.add('modal-flip-active')

    // If origin is missing, perform a smooth modal scale/fade entrance fallback
    if (!origin) {
      gsap.set(target, { opacity: 0, scale: 0.94, y: 8 })
      if (overlay) gsap.set(overlay, { opacity: 0 })

      const tlFallback = gsap.timeline({
        onComplete: () => {
          gsap.set(target, { clearProps: 'transform' })
          activeTimelines.delete(id)
          onDone?.()
        },
      })
      tlFallback.to(target, { opacity: 1, scale: 1, y: 0, duration: 0.28, ease: EASE_ENTRANCE }, 0)
      if (overlay) tlFallback.to(overlay, { opacity: 1, duration: 0.25 }, 0)

      activeTimelines.set(id, tlFallback)
      return
    }

    // Hide origin instantly so it doesn't remain visible under flying clones
    origin.classList.add('modal-flip-source-active')
    gsap.set(origin, { opacity: 0, filter: 'blur(8px)' })

    const originRect   = origin.getBoundingClientRect()
    const originRadius = getComputedStyle(origin).borderRadius
    const naturalRect  = target.getBoundingClientRect()
    const naturalRadius = getComputedStyle(target).borderRadius
    const sharedPairs  = findSharedItemPairs(origin, target)

    const flyingItems: FlyingItem[] = sharedPairs.map(({ originEl, targetEl }) => ({
      el: createFlyingClone(originEl),
      originEl,
      targetEl,
    }))
    flyingRegistry.set(id, flyingItems)

    // Hide real icon/label copies — flying clones bridge them visually
    gsap.set([
      ...sharedPairs.map((p) => p.originEl),
      ...sharedPairs.map((p) => p.targetEl),
    ], { opacity: 0 })

    // Inner content children — cascade-reveal with blur + scale (matches reference)
    const innerContent = target.querySelector<HTMLElement>(
      '[data-modal-content],' +
      '#filterInnerContent,' +
      '#txModalContent,' +
      '.py-5'
    )
    const innerChildren = innerContent
      ? (Array.from(innerContent.children) as HTMLElement[])
      : (Array.from(target.children) as HTMLElement[])

    gsap.set(innerChildren, {
      opacity: 0,
      y: 28,
      scale: 0.91,
      filter: 'blur(16px)',
    })

    const tl = gsap.timeline({
      defaults: { ease: EASE_FLUID, duration: OPEN_DURATION },
      onComplete: () => {
        gsap.set(target, {
          clearProps: 'position,left,top,width,height,borderRadius,overflow,zIndex,transition',
        })
        gsap.set(innerChildren, { clearProps: 'all' })
        gsap.set(target, { opacity: 1 })
        if (overlay) gsap.set(overlay, { opacity: 1 })
        gsap.set(sharedPairs.map((p) => p.targetEl), { opacity: 1 })
        flyingItems.forEach((f) => { f.el.style.opacity = '0' })
        activeTimelines.delete(id)
        onDone?.()
      },
    })

    // Measure shared-item destinations BEFORE squashing target to origin size
    flyingItems.forEach(({ el, targetEl }) => flyTo(tl, el, targetEl, OPEN_DURATION, 0, { blur: 0 }))

    // The container's surface is visible from frame one; only content waits.
    gsap.set(target, {
      position: 'fixed',
      left:         originRect.left,
      top:          originRect.top,
      width:        originRect.width,
      height:       originRect.height,
      borderRadius: originRadius,
      opacity:      1,
      overflow:     'hidden',
      zIndex:       5002,
      transition:   'none',
    })
    gsap.set(innerChildren, { transition: 'none' })

    // Animate container to natural size
    tl.to(target, {
      left:         naturalRect.left,
      top:          naturalRect.top,
      width:        naturalRect.width,
      height:       naturalRect.height,
      borderRadius: naturalRadius,
    }, 0)

    // Viewport depth effect — matches reference's appViewport scale
    const appViewport = getAppViewport()
    if (appViewport) {
      tl.to(appViewport, {
        scale:        isMobile() ? VIEWPORT_SCALE_MOBILE : VIEWPORT_SCALE_DESKTOP,
        y:            isMobile() ? VIEWPORT_Y_MOBILE : 0,
        borderRadius: VIEWPORT_RADIUS,
        duration:     0.5,
        ease:         EASE_FLUID,
      }, 0)
    }

    // Backdrop fade-in — same timeline, one shared clock
    if (overlay) tl.to(overlay, { opacity: 1, duration: OPEN_BACKDROP_DURATION }, 0)

    // Cascade-reveal inner content: y:28 scale:0.91 blur:16 → clean
    tl.to(innerChildren, {
      opacity:  1,
      y:        0,
      scale:    1,
      filter:   'blur(0px)',
      duration: OPEN_CONTENT_DURATION,
      stagger:  OPEN_CONTENT_STAGGER,
      ease:     EASE_ENTRANCE,
    }, OPEN_CONTENT_AT)

    activeTimelines.set(id, tl)
  },

  /** Animates the dialog content shrinking back into the origin element. */
  untoggle(id: string, onDone?: () => void) {
    if (typeof window === 'undefined') { onDone?.(); return }

    const { origin, target, overlay } = findPair(id)
    if (!origin || !target) { onDone?.(); return }

    killActive(id)

    let called = false
    const safeDone = () => {
      if (called) return
      called = true
      origin.classList.remove('modal-flip-source-active')
      onDone?.()
    }

    const originRect   = origin.getBoundingClientRect()
    const originRadius = getComputedStyle(origin).borderRadius
    const currentRect  = target.getBoundingClientRect()

    const sharedPairs  = findSharedItemPairs(origin, target)
    const flyingItems  = flyingRegistry.get(id) || []

    // Reactivate flying clones for the return trip
    gsap.set(flyingItems.map((f) => f.el), { opacity: 1 })
    gsap.set(sharedPairs.map((p) => p.targetEl), { opacity: 0 })

    const innerContent = target.querySelector<HTMLElement>(
      '[data-modal-content],' +
      '#filterInnerContent,' +
      '#txModalContent,' +
      '.py-5'
    )
    const innerChildren = innerContent
      ? (Array.from(innerContent.children) as HTMLElement[])
      : (Array.from(target.children) as HTMLElement[])

    gsap.set(target, {
      position:  'fixed',
      left:      currentRect.left,
      top:       currentRect.top,
      width:     currentRect.width,
      height:    currentRect.height,
      overflow:  'hidden',
      zIndex:    5002,
      transition:'none',
    })
    gsap.set(innerChildren, { transition: 'none' })

    const tl = gsap.timeline({
      defaults: { ease: EASE_FLUID, duration: CLOSE_DURATION },
      onComplete: () => {
        target.classList.remove('modal-flip-active')
        if (overlay) overlay.classList.remove('modal-flip-active')
        cleanupFlying(id)
        gsap.set([origin, ...sharedPairs.map((p) => p.originEl)], { opacity: 1, clearProps: 'filter' })
        activeTimelines.delete(id)
        safeDone()
      },
    })

    // Content disappears first — quick exit before the container contracts
    tl.to(innerChildren, {
      opacity:  0,
      y:        12,
      filter:   'blur(8px)',
      duration: CLOSE_CONTENT_DURATION,
      ease:     EASE_EXIT,
    }, 0)

    // Container contracts back to origin
    tl.to(target, {
      left:         originRect.left,
      top:          originRect.top,
      width:        originRect.width,
      height:       originRect.height,
      borderRadius: originRadius,
    }, 0)

    // Viewport depth — restore to normal
    const appViewport = getAppViewport()
    if (appViewport) {
      tl.to(appViewport, {
        scale:        1,
        y:            0,
        borderRadius: '0px',
        duration:     0.46,
        ease:         EASE_FLUID,
      }, 0)
    }

    // Backdrop fade-out
    if (overlay) tl.to(overlay, { opacity: 0, duration: CLOSE_BACKDROP_DURATION }, 0)

    // Flying clones return to origin
    // Let the source button materialize beneath the returning clone with a
    // brief blur settle, so the trigger never pops in as a sharp duplicate.
    tl.to(origin, { opacity: 1, filter: 'blur(0px)', duration: 0.14, ease: EASE_ENTRANCE }, CLOSE_DURATION - 0.14)
    flyingItems.forEach(({ el, originEl }) => flyTo(tl, el, originEl, CLOSE_DURATION, 0, { blur: 8 }))

    activeTimelines.set(id, tl)

    // Fallback guarantee — dialog closes even if tween is interrupted
    setTimeout(safeDone, CLOSE_DURATION * 1000 + 150)
  },
}
