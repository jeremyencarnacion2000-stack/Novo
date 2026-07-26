'use client'

import { gsap } from 'gsap'
import { createFlyingClone, flyTo } from './flying-clone'

// Shared-element ("Container Transform") modal animation.
//
// Ported to match the user's final reference exactly:
// - The container itself (target) does the box-model journey directly — no
//   clone needed for the surface, since it's visible from frame one and only
//   its own content (direct children) waits to reveal.
// - `data-shared-item="key"` pairs (icon + label) get their own literal
//   floating clones — real cloned DOM nodes, not transform tricks — that fly
//   from the origin's exact position/size/style to the target's, and STAY
//   ALIVE (hidden) for the entire time the modal is open, only reactivating
//   and flying back during close. This is what makes the connection feel
//   physically continuous rather than a transition effect: at no point does
//   a "real" icon appear somewhere the flying clone didn't just vacate.
//
// Timing/easing match the reference precisely: open runs 0.5s (power3.inOut)
// with content revealing 0.25→0.5s; close runs 0.4s with content hiding
// 0→0.15s. Icon/text clones travel the FULL box duration in both directions
// (not just the reveal/hide window), exactly like the reference. The
// backdrop overlay is tweened (0.3s) inside this SAME timeline rather than
// via a separate CSS transition — one shared clock for box, content, icons,
// and overlay, exactly like the reference's `tl.to(this.overlay, ...)`.

const OPEN_DURATION = 0.5
const OPEN_CONTENT_AT = 0.25
const OPEN_CONTENT_DURATION = 0.25
const CLOSE_DURATION = 0.4
const CLOSE_CONTENT_DURATION = 0.15
const EASE = 'power3.inOut'

function findPair(id: string) {
  const origin = document.querySelector<HTMLElement>(`[data-flip-from="${id}"]`)
  const target = document.querySelector<HTMLElement>(`[data-flip-to="${id}"]`)
  const overlay = document.querySelector<HTMLElement>(`[data-flip-overlay="${id}"]`)
  return { origin, target, overlay }
}

const OVERLAY_DURATION = 0.3

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
// Flying clones persist from open through close (not just during the
// transition) — this registry is what makes them "constant across the
// journey" rather than transition-only decoration.
const flyingRegistry = new Map<string, FlyingItem[]>()

function cleanupFlying(id: string) {
  flyingRegistry.get(id)?.forEach((f) => f.el.remove())
  flyingRegistry.delete(id)
}

function killActive(id: string) {
  activeTimelines.get(id)?.kill()
  activeTimelines.delete(id)
}

export const modalFlip = {
  /** Animates the dialog content growing out of the origin element. */
  toggle(id: string, onDone?: () => void) {
    if (typeof window === 'undefined') { onDone?.(); return }

    const { origin, target, overlay } = findPair(id)
    if (!origin || !target) {
      // Missing pair (e.g. a caller forgot to put data-flip-from on the
      // trigger element) must never leave the target or overlay stuck
      // invisible — reveal them plainly instead of failing invisibly.
      if (target) target.style.opacity = '1'
      if (overlay) overlay.style.opacity = '1'
      onDone?.()
      return
    }

    killActive(id)
    cleanupFlying(id)

    // NOTE: deliberately NO prefers-reduced-motion branch here. An earlier
    // version skipped the physical animation for users whose OS reports
    // reduced motion (common on low-RAM Windows machines where "Show
    // animations in Windows" is off) and played a plain 150ms opacity fade
    // instead — which read as "the animation is missing entirely." The
    // reference implementation this ports has no such branch; the container
    // transform IS the product experience, so it always runs.

    origin.classList.add('modal-flip-source-active')

    const originRect = origin.getBoundingClientRect()
    const originRadius = getComputedStyle(origin).borderRadius
    // Measure natural positions BEFORE moving anything — target and its
    // shared items are still in their real resting layout at this point.
    const naturalRect = target.getBoundingClientRect()
    const naturalRadius = getComputedStyle(target).borderRadius
    const sharedPairs = findSharedItemPairs(origin, target)

    const flyingItems: FlyingItem[] = sharedPairs.map(({ originEl, targetEl }) => ({
      el: createFlyingClone(originEl),
      originEl,
      targetEl,
    }))
    flyingRegistry.set(id, flyingItems)

    // Hide the real icon/label copies in both places — the flying clones
    // are what's visible bridging them.
    gsap.set([...sharedPairs.map((p) => p.originEl), ...sharedPairs.map((p) => p.targetEl)], { opacity: 0 })

    const contentEls = Array.from(target.children) as HTMLElement[]

    const tl = gsap.timeline({
      defaults: { ease: EASE, duration: OPEN_DURATION },
      onComplete: () => {
        gsap.set(target, { clearProps: 'position,left,top,width,height,borderRadius,overflow,zIndex,transition' })
        gsap.set(contentEls, { clearProps: 'opacity,transition' })
        // Reveal the real target copies and hide the flying clones — kept
        // alive (not removed) so they can fly back on close.
        gsap.set(sharedPairs.map((p) => p.targetEl), { opacity: 1 })
        flyingItems.forEach((f) => { f.el.style.opacity = '0' })
        activeTimelines.delete(id)
        onDone?.()
      },
    })

    // Measure each shared item's destination WHILE `target` still sits at
    // its natural (unsquashed) layout — a cover image sized `w-full h-full`
    // reads its real final rect here. Do this BEFORE the `gsap.set(target,
    // {width: originRect.width, ...})` squash below, which would otherwise
    // shrink `target` to the origin's tiny footprint first and make any
    // percentage/ancestor-relative shared item measure that squashed size
    // instead. Fixed-size items (SVG icons, font-metric text) never showed
    // this, since neither depends on the ancestor's width.
    flyingItems.forEach(({ el, targetEl }) => flyTo(tl, el, targetEl, OPEN_DURATION, 0))

    // The container's own surface (background/shadow/radius) is visible
    // from frame one — only its content waits. `transition: none` is
    // deliberate: several global CSS rules in this app (`.glass-card` etc.)
    // set `transition: all …` broadly, which — since CSS transitions fire on
    // ANY style change regardless of whether it came from a class swap or a
    // direct inline write — was smoothing our instant `opacity: 1` snap into
    // an unwanted fade, fighting the real GSAP timeline.
    gsap.set(target, {
      position: 'fixed',
      left: originRect.left,
      top: originRect.top,
      width: originRect.width,
      height: originRect.height,
      borderRadius: originRadius,
      opacity: 1,
      overflow: 'hidden',
      zIndex: 5002,
      transition: 'none',
    })
    gsap.set(contentEls, { opacity: 0, transition: 'none' })

    tl.to(target, {
      left: naturalRect.left,
      top: naturalRect.top,
      width: naturalRect.width,
      height: naturalRect.height,
      borderRadius: naturalRadius,
    }, 0)

    // Same timeline as the box/content/icon tweens — one shared clock,
    // matching the reference exactly instead of a separately-timed CSS
    // transition on the overlay.
    if (overlay) tl.to(overlay, { opacity: 1, duration: OVERLAY_DURATION }, 0)

    tl.to(contentEls, { opacity: 1, duration: OPEN_CONTENT_DURATION }, OPEN_CONTENT_AT)

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

    const originRect = origin.getBoundingClientRect()
    const originRadius = getComputedStyle(origin).borderRadius
    const currentRect = target.getBoundingClientRect()

    const sharedPairs = findSharedItemPairs(origin, target)
    const flyingItems = flyingRegistry.get(id) || []
    // Reactivate the flying clones for the return trip (they were hidden,
    // not removed, when toggle()'s reveal completed).
    gsap.set(flyingItems.map((f) => f.el), { opacity: 1 })
    gsap.set(sharedPairs.map((p) => p.targetEl), { opacity: 0 })

    const contentEls = Array.from(target.children) as HTMLElement[]

    gsap.set(target, {
      position: 'fixed',
      left: currentRect.left,
      top: currentRect.top,
      width: currentRect.width,
      height: currentRect.height,
      overflow: 'hidden',
      zIndex: 5002,
      transition: 'none',
    })
    gsap.set(contentEls, { transition: 'none' })

    const tl = gsap.timeline({
      defaults: { ease: EASE, duration: CLOSE_DURATION },
      onComplete: () => {
        cleanupFlying(id)
        gsap.set([origin, ...sharedPairs.map((p) => p.originEl)], { opacity: 1 })
        safeDone()
      },
    })

    tl.to(contentEls, { opacity: 0, duration: CLOSE_CONTENT_DURATION }, 0)
      .to(target, {
        left: originRect.left,
        top: originRect.top,
        width: originRect.width,
        height: originRect.height,
        borderRadius: originRadius,
      }, 0)

    if (overlay) tl.to(overlay, { opacity: 0, duration: OVERLAY_DURATION }, 0)

    flyingItems.forEach(({ el, originEl }) => flyTo(tl, el, originEl, CLOSE_DURATION, 0))

    activeTimelines.set(id, tl)

    // Fallback: guarantee the dialog actually closes even if the tween is
    // interrupted (e.g. origin unmounted mid-transition).
    setTimeout(safeDone, (CLOSE_DURATION * 1000) + 150)
  },
}
