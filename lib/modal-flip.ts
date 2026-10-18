'use client'

import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import {
  createFlyingClone,
  createTextCrossfadeFlight,
  flyTo,
  isTextFlightElement,
} from './flying-clone'
import {
  getSharedSurfaceMorphEase,
  isElementVisibleForSharedMotion,
  MODAL_CUSTOM_EASE,
  MODAL_MOTION,
} from './modal-motion'
import { createLiquidModalMotion, type LiquidModalController, type ModalOrigin } from '@/lib/liquid-modal-motion'
import { readModalOrigin } from '@/lib/modal-origin'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(CustomEase)
  CustomEase.create('novoModalFluid', MODAL_CUSTOM_EASE.fluid)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return
    document.querySelectorAll<HTMLElement>('[data-modal-motion-bridge]').forEach((bridge) => {
      gsap.set(bridge, { filter: 'blur(0px)' })
    })
  })
}

const EASE_FLUID = 'novoModalFluid'
type SharedItemPair = { originEl: HTMLElement; targetEl: HTMLElement }
type SharedMotionEase = string | ((progress: number) => number)
type RuntimeFlight = { nodes: HTMLElement[]; addTo: (timeline: gsap.core.Timeline, duration: number, ease: SharedMotionEase) => void }

type ActiveTransition = {
  naturalDirection: 'open' | 'close'
  timeline: gsap.core.Timeline
  finishOpen: () => void
  finishClosed: (onDone?: () => void) => void
}

const activeTransitions = new Map<string, ActiveTransition>()

function findPair(id: string) {
  return {
    origin: document.querySelector<HTMLElement>(`[data-flip-from="${id}"]`),
    target: document.querySelector<HTMLElement>(`[data-flip-to="${id}"]`),
    overlay: document.querySelector<HTMLElement>(`[data-flip-overlay="${id}"]`),
  }
}

function findSharedItemPairs(origin: HTMLElement, target: HTMLElement): SharedItemPair[] {
  const targetItems = Array.from(target.querySelectorAll<HTMLElement>('[data-shared-item]'))
  return Array.from(origin.querySelectorAll<HTMLElement>('[data-shared-item]')).flatMap((originEl) => {
    const targetEl = targetItems.find((candidate) => candidate.dataset.sharedItem === originEl.dataset.sharedItem)
    return targetEl ? [{ originEl, targetEl }] : []
  })
}

function getRevealElements(target: HTMLElement) {
  const contentRoot = target.querySelector<HTMLElement>(
    '[data-modal-content],#filterInnerContent,#txModalContent,.py-5',
  )
  const candidates = Array.from((contentRoot ?? target).children) as HTMLElement[]
  const closeButton = target.querySelector<HTMLElement>('[data-slot="dialog-close"]')
  return {
    content: candidates.filter((element) => element !== closeButton),
    closeButton,
  }
}

function restoreSharedItems(pairs: SharedItemPair[]) {
  gsap.set(pairs.flatMap(({ originEl, targetEl }) => [originEl, targetEl]), {
    clearProps: 'opacity,visibility',
  })
}

function clearTarget(target: HTMLElement, content: HTMLElement[], closeButton: HTMLElement | null) {
  gsap.set(target, { clearProps: 'opacity,visibility,transition,transform,transformOrigin,willChange' })
  // The CSS baseline is fail-open. Keep an explicit visible settle frame so
  // cleanup cannot re-expose the old global opacity:0 regression.
  target.dataset.modalMotionState = 'open'
  target.style.opacity = '1'
  target.style.visibility = 'visible'
  if (content.length > 0) {
    gsap.set(content, { clearProps: 'opacity,transform,transition,willChange' })
  }
  if (closeButton) gsap.set(closeButton, { clearProps: 'opacity,transform,transition,willChange' })
}

function getMobileNavSurfaceClips(origin: HTMLElement, target: HTMLElement) {
  const sourceRect = origin.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  if (
    sourceRect.width <= 0 || sourceRect.height <= 0 ||
    targetRect.width <= 0 || targetRect.height <= 0
  ) {
    throw new Error('Mobile navigation surface has no measurable geometry')
  }

  const containsSource =
    sourceRect.left >= targetRect.left - 1 &&
    sourceRect.top >= targetRect.top - 1 &&
    sourceRect.right <= targetRect.right + 1 &&
    sourceRect.bottom <= targetRect.bottom + 1
  if (!containsSource) throw new Error('Mobile navigation source is outside the panel bounds')

  const sourceStyle = getComputedStyle(origin)
  const targetStyle = getComputedStyle(target)
  const sourceRadius = Math.min(
    parseFloat(sourceStyle.borderTopLeftRadius) || sourceRect.height / 2,
    sourceRect.width / 2,
    sourceRect.height / 2,
  )
  const targetRadius = Math.min(
    parseFloat(targetStyle.borderTopLeftRadius) || 32,
    targetRect.width / 2,
    targetRect.height / 2,
  )
  const start = `inset(${sourceRect.top - targetRect.top}px ${targetRect.right - sourceRect.right}px ${targetRect.bottom - sourceRect.bottom}px ${sourceRect.left - targetRect.left}px round ${sourceRadius}px)`
  const end = `inset(0px 0px 0px 0px round ${targetRadius}px)`
  return { start, end }
}

function runMobileNavSurfaceEntrance(
  id: string,
  origin: HTMLElement,
  target: HTMLElement,
  overlay: HTMLElement | null,
  onDone?: () => void,
) {
  const clips = getMobileNavSurfaceClips(origin, target)
  const sharedPairs = findSharedItemPairs(origin, target)
  const reveal = getRevealElements(target)
  const flights = createSharedFlights(sharedPairs, 'open')
  const runtimeNodes = flights.flatMap(({ nodes }) => nodes)
  const duration = MODAL_MOTION.shared.enter
  const ease = getSharedSurfaceMorphEase('open')

  origin.classList.add('modal-flip-source-active')
  target.classList.add('modal-flip-active')
  overlay?.classList.add('modal-flip-active')
  target.classList.remove('modal-flip-preparing')
  gsap.set(origin, { opacity: 0 })
  // Keep the Radix surface at its final dimensions. The live surface itself
  // starts clipped to the rail bounds; there is no copied glass bridge.
  gsap.set(target, {
    clipPath: clips.start,
    opacity: 1,
    visibility: 'visible',
    transition: 'none',
    willChange: 'clip-path',
  })
  target.dataset.modalMotionState = 'opening'
  gsap.set(sharedPairs.flatMap(({ originEl, targetEl }) => [originEl, targetEl]), { opacity: 0 })
  gsap.set(reveal.content, { opacity: 0, y: 6, transition: 'none', willChange: 'transform,opacity' })
  if (reveal.closeButton) {
    gsap.set(reveal.closeButton, { opacity: 0, transition: 'none', willChange: 'opacity' })
  }
  if (overlay) {
    overlay.dataset.modalMotionState = 'opening'
    gsap.set(overlay, { opacity: 0 })
  }

  const cleanupFlights = () => runtimeNodes.forEach((node) => node.remove())
  const finishOpen = () => {
    cleanupFlights()
    restoreSharedItems(sharedPairs)
    gsap.set(target, { clearProps: 'clipPath,visibility,transition,transform,willChange' })
    target.style.opacity = '1'
    target.dataset.modalMotionState = 'open'
    if (overlay) {
      gsap.set(overlay, { clearProps: 'opacity' })
      overlay.dataset.modalMotionState = 'open'
    }
    activeTransitions.delete(id)
    onDone?.()
  }
  const finishClosed = (onCloseDone?: () => void) => {
    cleanupFlights()
    restoreSharedItems(sharedPairs)
    target.classList.remove('modal-flip-active')
    overlay?.classList.remove('modal-flip-active')
    origin.classList.remove('modal-flip-source-active')
    gsap.set(origin, { clearProps: 'opacity' })
    gsap.set(target, { clearProps: 'clipPath,visibility,transition,transform,willChange' })
    target.style.opacity = '0'
    target.dataset.modalMotionState = 'closing'
    if (overlay) {
      gsap.set(overlay, { clearProps: 'opacity' })
      overlay.dataset.modalMotionState = 'closing'
    }
    activeTransitions.delete(id)
    onCloseDone?.()
  }

  const timeline = gsap.timeline({
    defaults: { overwrite: 'auto' },
    onComplete: finishOpen,
  })
  timeline.to(target, {
    clipPath: clips.end,
    duration,
    ease,
    force3D: true,
  }, 0)
  flights.forEach((flight) => flight.addTo(timeline, duration, ease))
  timeline.to(reveal.content, {
    opacity: 1,
    y: 0,
    duration: 0.22,
    stagger: MODAL_MOTION.shared.stagger,
    ease: 'power3.out',
  }, 0.21)
  if (reveal.closeButton) {
    timeline.to(reveal.closeButton, {
      opacity: 1,
      duration: 0.16,
      ease: 'power2.out',
    }, duration * 0.62)
  }
  if (overlay) {
    timeline.to(overlay, {
      opacity: 1,
      duration: duration * 0.64,
      ease: 'power2.out',
    }, 0.012)
  }
  activeTransitions.set(id, {
    naturalDirection: 'open',
    timeline,
    finishOpen,
    finishClosed,
  })
}

function runMobileNavSurfaceExit(
  id: string,
  origin: HTMLElement,
  target: HTMLElement,
  overlay: HTMLElement | null,
  onDone?: () => void,
) {
  const clips = getMobileNavSurfaceClips(origin, target)
  const sharedPairs = findSharedItemPairs(origin, target)
  const reveal = getRevealElements(target)
  const flights = createSharedFlights(sharedPairs, 'close')
  const runtimeNodes = flights.flatMap(({ nodes }) => nodes)
  const duration = MODAL_MOTION.shared.exit
  const ease = getSharedSurfaceMorphEase('close')

  gsap.set(origin, { opacity: 0 })
  gsap.set(target, {
    clipPath: clips.end,
    opacity: 1,
    transition: 'none',
    willChange: 'clip-path',
  })
  target.dataset.modalMotionState = 'closing'
  gsap.set(sharedPairs.flatMap(({ originEl, targetEl }) => [originEl, targetEl]), { opacity: 0 })
  gsap.set(reveal.content, { opacity: 1, y: 0, transition: 'none', willChange: 'transform,opacity' })
  if (reveal.closeButton) gsap.set(reveal.closeButton, { opacity: 1, transition: 'none', willChange: 'opacity' })

  const cleanupFlights = () => runtimeNodes.forEach((node) => node.remove())
  const finishOpen = () => {
    cleanupFlights()
    restoreSharedItems(sharedPairs)
    gsap.set(target, { clearProps: 'clipPath,visibility,transition,transform,willChange' })
    target.style.opacity = '1'
    target.dataset.modalMotionState = 'open'
    if (overlay) gsap.set(overlay, { opacity: 1 })
    activeTransitions.delete(id)
  }
  const finishClosed = (onCloseDone?: () => void) => {
    cleanupFlights()
    restoreSharedItems(sharedPairs)
    target.classList.remove('modal-flip-active')
    overlay?.classList.remove('modal-flip-active')
    origin.classList.remove('modal-flip-source-active')
    gsap.set(origin, { clearProps: 'opacity' })
    gsap.set(target, { clearProps: 'clipPath,visibility,transition,transform,willChange' })
    target.style.opacity = '0'
    target.dataset.modalMotionState = 'closing'
    if (overlay) {
      overlay.classList.remove('modal-flip-active')
      gsap.set(overlay, { opacity: 0 })
      overlay.dataset.modalMotionState = 'closing'
    }
    activeTransitions.delete(id)
    onCloseDone?.()
  }

  const timeline = gsap.timeline({
    defaults: { overwrite: 'auto' },
    onComplete: () => finishClosed(onDone),
  })
  timeline.to(target, {
    clipPath: clips.start,
    duration,
    ease,
    force3D: true,
  }, 0)
  flights.forEach((flight) => flight.addTo(timeline, duration, ease))
  timeline.to(reveal.content, {
    opacity: 0,
    y: 4,
    duration: 0.16,
    stagger: MODAL_MOTION.shared.stagger,
    ease: 'power2.out',
  }, 0)
  if (reveal.closeButton) {
    timeline.to(reveal.closeButton, {
      opacity: 0,
      duration: 0.14,
      ease: 'power2.out',
    }, 0)
  }
  if (overlay) {
    timeline.to(overlay, {
      opacity: 0,
      duration: duration * 0.72,
      ease: 'power2.out',
    }, duration * 0.08)
  }
  activeTransitions.set(id, {
    naturalDirection: 'close',
    timeline,
    finishOpen,
    finishClosed,
  })
}

function createSharedFlights(
  pairs: SharedItemPair[],
  direction: 'open' | 'close',
): RuntimeFlight[] {
  return pairs.map(({ originEl, targetEl }) => {
    const fromEl = direction === 'open' ? originEl : targetEl
    const toEl = direction === 'open' ? targetEl : originEl

    if (isTextFlightElement(fromEl) && isTextFlightElement(toEl)) {
      const flight = createTextCrossfadeFlight(fromEl, toEl)
      const deltaX = flight.targetRect.left - flight.originRect.left
      const deltaY = flight.targetRect.top - flight.originRect.top
      gsap.set(flight.expanded, {
        x: flight.originRect.left - flight.targetRect.left,
        y: flight.originRect.top - flight.targetRect.top,
      })

      return {
        nodes: flight.nodes,
        addTo(timeline, duration, ease) {
          timeline.to(flight.compact, {
            x: deltaX,
            y: deltaY,
            duration: duration * 0.89,
            ease,
            force3D: true,
          }, 0.012)
          timeline.to(flight.expanded, {
            x: 0,
            y: 0,
            duration: duration * 0.89,
            ease,
            force3D: true,
          }, 0.012)
          timeline.to(flight.compact, {
            opacity: 0,
            duration: duration * 0.23,
            ease: 'power2.in',
          }, duration * 0.1)
          timeline.to(flight.expanded, {
            opacity: 1,
            duration: duration * 0.3,
            ease: 'power2.out',
          }, duration * 0.17)
        },
      }
    }

    const clone = createFlyingClone(fromEl)
    return {
      nodes: [clone],
      addTo(timeline, duration, ease) {
        flyTo(timeline, clone, toEl, duration * 0.91, 0.006, {
          blur: 0,
          ease,
        })
        if (fromEl.dataset.sharedItem === 'mobile-nav-close') {
          timeline.to(clone, {
            rotation: direction === 'open' ? 45 : -45,
            duration: duration * 0.91,
            ease,
            force3D: true,
          }, 0.006)
        }
      },
    }
  })
}

function reverseClosingTransition(active: ActiveTransition) {
  active.timeline.eventCallback('onComplete', null)
  active.timeline.eventCallback('onReverseComplete', active.finishOpen)
  active.timeline.timeScale(MODAL_MOTION.shared.exit / MODAL_MOTION.shared.enter).reverse()
}

function reverseOpeningTransition(active: ActiveTransition, onDone?: () => void) {
  active.timeline.eventCallback('onComplete', null)
  active.timeline.eventCallback('onReverseComplete', () => active.finishClosed(onDone))
  active.timeline.timeScale(MODAL_MOTION.shared.enter / MODAL_MOTION.shared.exit).reverse()
}

const liquidControllers = new Map<string, LiquidModalController>()
const origins = new Map<string, ModalOrigin>()
const generations = new Map<string, number>()

export const modalFlip = {
  setOrigin(id: string, origin?: ModalOrigin) { if (origin) origins.set(id, origin) },
  cancel(id: string) {
    generations.set(id, (generations.get(id) ?? 0) + 1)
    liquidControllers.get(id)?.destroy(); liquidControllers.delete(id); origins.delete(id)
    const running = activeTransitions.get(id)
    if (running) {
      running.timeline.eventCallback('onComplete', null)
      running.timeline.eventCallback('onReverseComplete', null)
      running.timeline.kill(); running.finishClosed()
    }
    const { origin, target, overlay } = findPair(id)
    origin?.classList.remove('modal-flip-source-active')
    target?.classList.remove('modal-flip-active')
    overlay?.classList.remove('modal-flip-active')
    if (origin) gsap.set(origin, { clearProps: 'opacity' })
  },
  toggle(id: string, onDone?: () => void, retries = 3) {
    if (typeof window === 'undefined') { onDone?.(); return }
    const generation = generations.get(id) ?? 0
    const { origin, target, overlay } = findPair(id)
    if (!target && retries > 0) {
      const retry = () => { if ((generations.get(id) ?? 0) === generation) modalFlip.toggle(id, onDone, retries - 1) }
      if (retries === 3) queueMicrotask(retry); else setTimeout(retry, 0)
      return
    }
    if (!target) { onDone?.(); return }
    if (id === 'mobile-nav-panel' && origin && isElementVisibleForSharedMotion(origin)) {
      const running = activeTransitions.get(id)
      if (running) {
        if (running.naturalDirection === 'close') reverseClosingTransition(running)
        else running.timeline.eventCallback('onReverseComplete', null).eventCallback('onComplete', running.finishOpen).timeScale(1).play()
      } else runMobileNavSurfaceEntrance(id, origin, target, overlay, onDone)
      return
    }
    let driver = liquidControllers.get(id)
    if (!driver) {
      const snapshot = origins.get(id) ?? readModalOrigin()
      driver = createLiquidModalMotion({ surface: target, overlay, origin: origin ?? snapshot.element, originRect: snapshot.rect, onOpened: onDone })
      liquidControllers.set(id, driver)
    }
    driver.open()
  },
  untoggle(id: string, onDone?: () => void) {
    const driver = liquidControllers.get(id)
    if (driver) { driver.close(() => onDone?.()); return }
    const running = activeTransitions.get(id)
    if (running) {
      if (running.naturalDirection === 'open') reverseOpeningTransition(running, onDone)
      else running.timeline.eventCallback('onReverseComplete', null).eventCallback('onComplete', () => running.finishClosed(onDone)).timeScale(1).play()
      return
    }
    const { origin, target, overlay } = findPair(id)
    if (id === 'mobile-nav-panel' && target && origin && isElementVisibleForSharedMotion(origin)) runMobileNavSurfaceExit(id, origin, target, overlay, onDone)
    else onDone?.()
  },
}
