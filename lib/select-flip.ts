'use client'

import { gsap } from 'gsap'
import { createFlyingClone, flyTo } from './flying-clone'

// Anchored shared-element treatment for <Select>. Unlike the modal
// container-transform (lib/modal-flip.ts), the popover's own box growth is
// left to Radix's native Popper positioning + transform-origin zoom/slide —
// that's already anchored to the trigger correctly, including edge
// collision handling, so re-deriving it here would just be a worse copy of
// what the platform already does.
//
// What's NOT native: the value text visibly traveling between the trigger
// and its row in the list. That's the one piece this file adds, using the
// same flying-clone primitive as the modal system, in both directions:
// open flies the trigger's current value down into the selected row, close
// flies the picked row's text back up into the trigger.

const FLY_DURATION = 0.26
const EASE = 'power3.out'

function findPair(id: string) {
  const trigger = document.querySelector<HTMLElement>(
    `[data-select-flip-id="${id}"][data-slot="select-trigger"]`,
  )
  const content = document.querySelector<HTMLElement>(
    `[data-select-flip-id="${id}"][data-slot="select-content"]`,
  )
  return { trigger, content }
}

function fly(clone: HTMLElement, toEl: HTMLElement) {
  const tl = gsap.timeline({ defaults: { ease: EASE }, onComplete: () => clone.remove() })
  flyTo(tl, clone, toEl, FLY_DURATION, 0)
  tl.to(clone, { opacity: 0, duration: 0.1 }, FLY_DURATION - 0.1)
}

// Radix runs onValueChange → onOpenChange(false) synchronously from the
// item's pointerup, and by the time our close handler sees open=false the
// popover is ALREADY unmounted — so the return flight's clone must be
// captured at pointerdown, while the item is still on screen. Armed clones
// live here (detached from the DOM) until close() plays or replaces them.
const armedClose = new Map<string, HTMLElement>()

export const selectFlip = {
  /** Trigger's current value flies down into its row in the just-opened list. */
  async open(id: string) {
    if (typeof window === 'undefined') return
    const { trigger, content } = findPair(id)
    if (!trigger || !content) return

    // Arm the return flight now (see armedClose note above). Listener dies
    // with the popover element, so no cleanup bookkeeping is needed.
    content.addEventListener(
      'pointerdown',
      (e) => {
        const text = (e.target as HTMLElement)
          .closest('[data-slot="select-item"]')
          ?.querySelector<HTMLElement>('[data-slot="select-item-text"]')
        if (!text) return
        armedClose.get(id)?.remove()
        const clone = createFlyingClone(text, 10000)
        clone.remove() // keep detached; re-appended only if the close really happens
        armedClose.set(id, clone)
      },
      true,
    )

    // Radix's entrance animation (zoom-in-95 + slide-in-from-top-2) is still
    // mid-transform at this point; measuring the checked item now captures a
    // squashed intermediate rect and the clone flies to the wrong place.
    // Wait for the entrance to settle before snapshotting anything.
    await Promise.allSettled(content.getAnimations({ subtree: true }).map((a) => a.finished))
    if (!content.isConnected) return

    const valueEl = trigger.querySelector<HTMLElement>('[data-slot="select-value"]')
    const itemTextEl = content.querySelector<HTMLElement>(
      '[data-slot="select-item"][data-state="checked"] [data-slot="select-item-text"]',
    )
    if (!valueEl || !itemTextEl) return // placeholder / nothing selected yet — native animation only
    fly(createFlyingClone(valueEl, 10000), itemTextEl)
  },

  /** Picked row's text (armed at pointerdown) flies up into the trigger. */
  close(id: string) {
    if (typeof window === 'undefined') return
    const clone = armedClose.get(id)
    armedClose.delete(id)
    if (!clone) return // keyboard selection or dismiss — nothing armed, native only
    const { trigger } = findPair(id)
    const valueEl = trigger?.querySelector<HTMLElement>('[data-slot="select-value"]')
    if (!valueEl) return
    document.body.appendChild(clone)
    fly(clone, valueEl)
  },
}
