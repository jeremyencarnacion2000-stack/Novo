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
//   - Inner content: y:28 scale:0.91 → y:0 scale:1 (kept crisp during the handoff)
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

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
const completionTimers = new Map<string, ReturnType<typeof setTimeout>>()
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
  const timer = completionTimers.get(id)
  if (timer) {
    clearTimeout(timer)
    completionTimers.delete(id)
  }
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

    // Keep the shared-element geometry and focus order intact for people who
    // request less motion, but collapse the visual travel to an immediate,
    // readable state change. This also prevents blur/scale from becoming a
    // disorienting flash on reduced-motion devices.
    const reducedMotion = prefersReducedMotion()
    const openDuration = reducedMotion ? 0.01 : OPEN_DURATION
    const openContentAt = reducedMotion ? 0 : OPEN_CONTENT_AT
    const openContentDuration = reducedMotion ? 0.01 : OPEN_CONTENT_DURATION
    const openBackdropDuration = reducedMotion ? 0.01 : OPEN_BACKDROP_DURATION

    // Mark target and overlay active so CSS keeps them visible
    target.classList.add('modal-flip-active')
    if (overlay) overlay.classList.add('modal-flip-active')

    // If origin is missing, perform a smooth modal scale/fade entrance fallback
    if (!origin) {
      gsap.set(target, { opacity: 0, x: 0, y: 8, scaleX: 0.96, scaleY: 0.96, transformOrigin: '50% 50%' })
      if (overlay) gsap.set(overlay, { opacity: 0 })

      const tlFallback = gsap.timeline({
        onComplete: () => {
          gsap.set(target, { clearProps: 'transform,transformOrigin,opacity' })
          activeTimelines.delete(id)
          onDone?.()
        },
      })
      tlFallback.to(target, { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, duration: reducedMotion ? 0.01 : 0.32, ease: EASE_ENTRANCE }, 0)
      if (overlay) tlFallback.to(overlay, { opacity: 1, duration: reducedMotion ? 0.01 : 0.25 }, 0)

      activeTimelines.set(id, tlFallback)
      return
    }

    // Hide origin instantly so it doesn't remain visible under flying clones
    origin.classList.add('modal-flip-source-active')
    // Let the source disappear cleanly. Blurring the live trigger while a
    // second blurred clone is flying over it creates a visible muddy cut on
    // low-power GPUs and makes the handoff feel like a teleport.
    gsap.set(origin, { opacity: 0 })

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

    // Inner content children — cascade-reveal with a restrained translate/scale.
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
      y: reducedMotion ? 0 : 28,
      scale: reducedMotion ? 1 : 0.91,
      filter: 'none',
    })

    const tl = gsap.timeline({
      defaults: { ease: EASE_FLUID, duration: openDuration },
      onComplete: () => {
        gsap.set(target, {
          clearProps: 'position,left,top,width,height,borderRadius,overflow,zIndex,transition,transform,transformOrigin,opacity',
        })
        gsap.set(innerChildren, { clearProps: 'opacity,transform,filter,willChange' })
        if (overlay) gsap.set(overlay, { opacity: 1 })
        gsap.set(sharedPairs.map((p) => p.targetEl), { opacity: 1 })
        flyingItems.forEach((f) => { f.el.style.opacity = '0' })
        activeTimelines.delete(id)
        onDone?.()
      },
    })

    // Measure shared-item destinations BEFORE squashing target to origin size
    flyingItems.forEach(({ el, targetEl }) => flyTo(tl, el, targetEl, openDuration, 0, { blur: 0 }))

    // Keep the surface at its natural layout size and animate only compositor
    // properties. Animating left/top/width/height reflows the portal every
    // frame, which is what made the previous transition feel cut on slower
    // GPUs and when the user reopened it quickly.
    gsap.set(target, {
      position: 'fixed',
      left:         naturalRect.left,
      top:          naturalRect.top,
      width:        naturalRect.width,
      height:       naturalRect.height,
      borderRadius: naturalRadius,
      opacity:      1,
      overflow:     'hidden',
      zIndex:       5002,
      transition:   'none',
      transformOrigin: 'top left',
    })
    gsap.set(target, {
      x: originRect.left - naturalRect.left,
      y: originRect.top - naturalRect.top,
      scaleX: naturalRect.width ? originRect.width / naturalRect.width : 1,
      scaleY: naturalRect.height ? originRect.height / naturalRect.height : 1,
    })
    gsap.set(innerChildren, { transition: 'none' })

    // Animate the container from the trigger's presentation rect to its
    // resting rect. This is the web equivalent of a native container
    // transform: the user can see where the modal came from and where it will
    // return, without a layout-property jump.
    tl.to(target, {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      borderRadius: naturalRadius,
    }, 0)

    // Viewport depth effect — matches reference's appViewport scale
    const appViewport = getAppViewport()
    if (appViewport) {
      tl.to(appViewport, {
        scale:        isMobile() ? VIEWPORT_SCALE_MOBILE : VIEWPORT_SCALE_DESKTOP,
        y:            isMobile() ? VIEWPORT_Y_MOBILE : 0,
        borderRadius: VIEWPORT_RADIUS,
        duration:     reducedMotion ? 0.01 : 0.5,
        ease:         EASE_FLUID,
      }, 0)
    }

    // Backdrop fade-in — same timeline, one shared clock
    if (overlay) tl.to(overlay, { opacity: 1, duration: openBackdropDuration }, 0)

    // Cascade-reveal inner content without a filter handoff that can smear text.
    tl.to(innerChildren, {
      opacity:  1,
      y:        0,
      scale:    1,
      filter:   'none',
      duration: openContentDuration,
      stagger:  reducedMotion ? 0 : OPEN_CONTENT_STAGGER,
      ease:     EASE_ENTRANCE,
    }, openContentAt)

    activeTimelines.set(id, tl)
  },

  /** Animates the dialog content shrinking back into the origin element. */
  untoggle(id: string, onDone?: () => void) {
    if (typeof window === 'undefined') { onDone?.(); return }

    const { origin, target, overlay } = findPair(id)
    if (!origin || !target) {
      // Radix can remove a portal during a rapid route change. Always restore
      // the viewport depth state before handing control back to React.
      const appViewport = getAppViewport()
      if (appViewport) {
        gsap.to(appViewport, {
          scale: 1,
          y: 0,
          borderRadius: '0px',
          duration: prefersReducedMotion() ? 0.01 : 0.24,
          ease: EASE_FLUID,
          overwrite: 'auto',
          onComplete: () => gsap.set(appViewport, { clearProps: 'transform,transformOrigin' }),
        })
      }
      onDone?.()
      return
    }

    killActive(id)
    const reducedMotion = prefersReducedMotion()
    const closeDuration = reducedMotion ? 0.01 : CLOSE_DURATION
    const closeContentDuration = reducedMotion ? 0.01 : CLOSE_CONTENT_DURATION
    const closeBackdropDuration = reducedMotion ? 0.01 : CLOSE_BACKDROP_DURATION

    let called = false
    const safeDone = () => {
      if (called) return
      called = true
      completionTimers.delete(id)
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
      transformOrigin: 'top left',
    })
    gsap.set(target, { x: 0, y: 0, scaleX: 1, scaleY: 1 })
    gsap.set(innerChildren, { transition: 'none' })

    const appViewport = getAppViewport()

    const tl = gsap.timeline({
      defaults: { ease: EASE_FLUID, duration: closeDuration },
      onComplete: () => {
        target.classList.remove('modal-flip-active')
        if (overlay) overlay.classList.remove('modal-flip-active')
        cleanupFlying(id)
        gsap.set([origin, ...sharedPairs.map((p) => p.originEl)], { opacity: 1, clearProps: 'filter' })
        gsap.set(target, { clearProps: 'position,left,top,width,height,borderRadius,overflow,zIndex,transition,transform,transformOrigin,opacity' })
        gsap.set(innerChildren, { clearProps: 'opacity,transform,filter,willChange' })
        if (appViewport) gsap.set(appViewport, { clearProps: 'transform,transformOrigin' })
        activeTimelines.delete(id)
        safeDone()
      },
    })

    // Content disappears first — quick exit before the container contracts
    tl.to(innerChildren, {
      opacity:  0,
      y:        reducedMotion ? 0 : 12,
      filter:   'none',
      duration: closeContentDuration,
      ease:     EASE_EXIT,
    }, 0)

    // Contract back to the trigger using only compositor transforms. The
    // current visual rect is the starting point, so an interrupted close can
    // be reversed without a jump.
    tl.to(target, {
      x: currentRect.width ? originRect.left - currentRect.left : 0,
      y: currentRect.height ? originRect.top - currentRect.top : 0,
      scaleX: currentRect.width ? originRect.width / currentRect.width : 1,
      scaleY: currentRect.height ? originRect.height / currentRect.height : 1,
      borderRadius: originRadius,
    }, 0)

    // Viewport depth — restore to normal
    if (appViewport) {
      tl.to(appViewport, {
        scale:        1,
        y:            0,
        borderRadius: '0px',
        duration:     reducedMotion ? 0.01 : 0.46,
        ease:         EASE_FLUID,
      }, 0)
    }

    // Backdrop fade-out
    if (overlay) tl.to(overlay, { opacity: 0, duration: closeBackdropDuration }, 0)

    // Flying clones return to origin
    // Let the source button materialize beneath the returning clone with a
    // brief blur settle, so the trigger never pops in as a sharp duplicate.
    tl.to(origin, { opacity: 1, duration: reducedMotion ? 0.01 : 0.14, ease: EASE_ENTRANCE }, Math.max(0, closeDuration - (reducedMotion ? 0.01 : 0.14)))
    flyingItems.forEach(({ el, originEl }) => flyTo(tl, el, originEl, closeDuration, 0, { blur: 0 }))

    activeTimelines.set(id, tl)

    // Fallback guarantee — dialog closes even if tween is interrupted
    const timer = setTimeout(safeDone, closeDuration * 1000 + 150)
    completionTimers.set(id, timer)
  },
}
