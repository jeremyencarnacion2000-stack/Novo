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
  createModalChromeBridge,
  getSharedSurfaceMorphEase,
  isElementVisibleForSharedMotion,
  MODAL_CUSTOM_EASE,
  MODAL_MOTION,
} from './modal-motion'
import { getNovoMotionModeFromDOM } from '@/hooks/use-novo-motion-policy'

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

function isLowPowerDevice() {
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number }
  const coarsePointer = matchMedia('(pointer: coarse)').matches
  const memory = Number(navigatorWithMemory.deviceMemory ?? 8)
  const cores = Number(navigator.hardwareConcurrency ?? 8)
  return coarsePointer && (memory <= 4 || cores <= 4)
}

function addBridgeVelocityBlur(timeline: gsap.core.Timeline, bridge: HTMLElement, duration: number) {
  if (getNovoMotionModeFromDOM() !== 'full') return
  const peak = isLowPowerDevice() ? 0.34 : 0.52
  const shoulder = peak * 0.42

  gsap.set(bridge, { filter: 'blur(0px)' })
  timeline.to(bridge, {
    filter: `blur(${peak}px)`,
    duration: duration * 0.09,
    ease: 'power1.out',
  }, duration * 0.075)
  timeline.to(bridge, {
    filter: `blur(${shoulder}px)`,
    duration: duration * 0.085,
    ease: 'none',
  }, duration * 0.165)
  timeline.to(bridge, {
    filter: 'blur(0px)',
    duration: duration * 0.17,
    ease: 'power2.out',
  }, duration * 0.245)
}

function animateBridge(
  timeline: gsap.core.Timeline,
  bridge: ReturnType<typeof createModalChromeBridge>,
  direction: 'open' | 'close',
  duration: number,
  bounce = false,
): SharedMotionEase {
  const opening = direction === 'open'
  gsap.set(bridge.root, { clipPath: opening ? bridge.startClip : bridge.endClip, opacity: 1 })
  gsap.set(bridge.compactSkin, { opacity: opening ? 1 : 0 })
  gsap.set(bridge.expandedSkin, { opacity: opening ? 0 : 1 })

  const bridgeEase = bounce ? getSharedSurfaceMorphEase(direction) : EASE_FLUID

  timeline.to(bridge.root, {
    clipPath: opening ? bridge.endClip : bridge.startClip,
    duration,
    ease: bridgeEase,
    force3D: true,
  }, 0)

  timeline.to(bridge.compactSkin, {
    opacity: opening ? 0 : 1,
    duration: duration * (opening ? 0.38 : 0.47),
    ease: 'power2.out',
  }, duration * (opening ? 0.11 : 0.08))
  timeline.to(bridge.expandedSkin, {
    opacity: opening ? 1 : 0,
    duration: duration * (opening ? 0.48 : 0.44),
    ease: 'power2.inOut',
  }, duration * (opening ? 0.08 : 0.1))

  addBridgeVelocityBlur(timeline, bridge.root, duration)
  return bridgeEase
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

function runFadeEntrance(id: string, target: HTMLElement, overlay: HTMLElement | null, onDone?: () => void) {
  const mode = getNovoMotionModeFromDOM()
  if (mode === 'off') {
    // Motion off is an immediate, visible state—not a zero-duration hidden
    // tween that waits for a GSAP tick to settle.
    gsap.set(target, { clearProps: 'opacity,transform,transformOrigin,willChange' })
    target.dataset.modalMotionState = 'open'
    target.style.opacity = '1'
    if (overlay) {
      gsap.set(overlay, { clearProps: 'opacity' })
      overlay.dataset.modalMotionState = 'open'
      overlay.style.opacity = '1'
    }
    onDone?.()
    return
  }
  const duration = mode === 'reduced' ? 0.16 : MODAL_MOTION.center.enter
  gsap.set(target, {
    opacity: 0,
    y: mode === 'full' ? 10 : 0,
    scale: mode === 'full' ? 0.94 : 1,
    transformOrigin: '50% 50%',
    willChange: 'transform,opacity',
  })
  target.dataset.modalMotionState = 'opening'
  if (overlay) gsap.set(overlay, { opacity: 0 })

  const finishOpen = () => {
    clearTarget(target, [], null)
    target.style.opacity = '1'
    if (overlay) {
      overlay.dataset.modalMotionState = 'open'
      overlay.style.opacity = '1'
    }
    activeTransitions.delete(id)
    onDone?.()
  }
  const finishClosed = (done?: () => void) => {
    clearTarget(target, [], null)
    target.dataset.modalMotionState = 'closing'
    target.style.opacity = '0'
    activeTransitions.delete(id)
    done?.()
  }
  const timeline = gsap.timeline({ onComplete: finishOpen })
  timeline.to(target, { opacity: 1, y: 0, scale: 1, duration, ease: EASE_FLUID }, 0)
  if (overlay) timeline.to(overlay, { opacity: 1, duration: Math.min(duration, 0.22), ease: EASE_FLUID }, 0)
  activeTransitions.set(id, { naturalDirection: 'open', timeline, finishOpen, finishClosed })
}

function runFadeExit(id: string, target: HTMLElement, overlay: HTMLElement | null, onDone?: () => void) {
  const mode = getNovoMotionModeFromDOM()
  const duration = mode === 'off' ? 0 : mode === 'reduced' ? 0.16 : MODAL_MOTION.center.exit
  const finishOpen = () => {
    clearTarget(target, [], null)
    activeTransitions.delete(id)
  }
  const finishClosed = (done?: () => void) => {
    clearTarget(target, [], null)
    activeTransitions.delete(id)
    done?.()
  }
  const timeline = gsap.timeline({ onComplete: () => finishClosed(onDone) })
  timeline.to(target, {
    opacity: 0,
    y: mode === 'full' ? 6 : 0,
    scale: mode === 'full' ? 0.97 : 1,
    duration,
    ease: EASE_FLUID,
  }, 0)
  if (overlay) timeline.to(overlay, { opacity: 0, duration: Math.min(duration, 0.18), ease: EASE_FLUID }, 0)
  activeTransitions.set(id, { naturalDirection: 'close', timeline, finishOpen, finishClosed })
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

export const modalFlip = {
  cancel(id: string) {
    const running = activeTransitions.get(id)
    if (running) {
      running.timeline.eventCallback('onComplete', null)
      running.timeline.eventCallback('onReverseComplete', null)
      running.timeline.kill()
      running.finishClosed()
      return
    }

    // A settled shared modal no longer has an active timeline, but its trigger
    // intentionally stays hidden until the modal closes. Route changes and
    // conditional unmounts can skip that close animation, so hook cleanup must
    // still restore every persistent visual state.
    const { origin, target, overlay } = findPair(id)
    origin?.classList.remove('modal-flip-source-active')
    target?.classList.remove('modal-flip-active')
    overlay?.classList.remove('modal-flip-active')
    if (origin) gsap.set(origin, { clearProps: 'opacity' })
    if (target) gsap.set(target, { clearProps: 'opacity,clipPath,visibility,transition,transform,transformOrigin,willChange' })
  },

  toggle(id: string, onDone?: () => void, retries = 3) {
    if (typeof window === 'undefined') { onDone?.(); return }

    const running = activeTransitions.get(id)
    if (running) {
      if (running.naturalDirection === 'close') reverseClosingTransition(running)
      else running.timeline.timeScale(1).play()
      return
    }

    const { origin, target, overlay } = findPair(id)
    if (!target && retries > 0) {
      // Portals can finish their commit just after the controller effect. A
      // microtask handles that same-turn commit; later retries use a macrotask
      // instead of requestAnimationFrame so opening never depends on a frame
      // that may be skipped or already consumed by a route transition.
      const retry = () => modalFlip.toggle(id, onDone, retries - 1)
      if (retries === 3 && typeof queueMicrotask === 'function') queueMicrotask(retry)
      else setTimeout(retry, 0)
      return
    }
    if (!target) { onDone?.(); return }

    target.classList.add('modal-flip-active')
    target.classList.add('modal-flip-preparing')
    overlay?.classList.add('modal-flip-active')
    target.dataset.modalMotionState = 'preparing'
    if (overlay) overlay.dataset.modalMotionState = 'preparing'

    const mode = getNovoMotionModeFromDOM()
    if (mode !== 'full' || !isElementVisibleForSharedMotion(origin)) {
      runFadeEntrance(id, target, overlay, onDone)
      return
    }

    try {
      if (id === 'mobile-nav-panel') {
        runMobileNavSurfaceEntrance(id, origin!, target, overlay, onDone)
        return
      }
      const sharedPairs = findSharedItemPairs(origin!, target)
      const reveal = getRevealElements(target)
      const bridge = createModalChromeBridge(origin!, target)
    const flights = createSharedFlights(sharedPairs, 'open')
    const runtimeNodes = [bridge.root, ...flights.flatMap(({ nodes }) => nodes)]
    origin!.classList.add('modal-flip-source-active')
    gsap.set(origin!, { opacity: 0 })
    gsap.set(target, { opacity: 0, visibility: 'visible', transition: 'none', transform: 'translateZ(0)' })
    target.dataset.modalMotionState = 'opening'
    target.classList.remove('modal-flip-preparing')
    gsap.set(sharedPairs.flatMap(({ originEl, targetEl }) => [originEl, targetEl]), { opacity: 0 })
    gsap.set(reveal.content, { opacity: 0, y: 9, scale: 0.994, transition: 'none', willChange: 'transform,opacity' })
    if (reveal.closeButton) gsap.set(reveal.closeButton, { opacity: 0, scale: 0.82, willChange: 'transform,opacity' })
    if (overlay) gsap.set(overlay, { opacity: 0 })

    const cleanupRuntime = () => runtimeNodes.forEach((node) => node.remove())
    const finishOpen = () => {
      cleanupRuntime()
      restoreSharedItems(sharedPairs)
      clearTarget(target, reveal.content, reveal.closeButton)
      target.style.opacity = '1'
      target.dataset.modalMotionState = 'open'
      if (overlay) gsap.set(overlay, { opacity: 1 })
      if (overlay) overlay.dataset.modalMotionState = 'open'
      activeTransitions.delete(id)
      onDone?.()
    }
    const finishClosed = (done?: () => void) => {
      cleanupRuntime()
      restoreSharedItems(sharedPairs)
      target.classList.remove('modal-flip-active')
      overlay?.classList.remove('modal-flip-active')
      origin!.classList.remove('modal-flip-source-active')
      gsap.set(origin!, { clearProps: 'opacity' })
      gsap.set(target, { opacity: 0 })
      target.dataset.modalMotionState = 'closing'
      activeTransitions.delete(id)
      done?.()
    }

    const timeline = gsap.timeline({ defaults: { overwrite: 'auto' }, onComplete: finishOpen })
    const isMobileNavigation = id === 'mobile-nav-panel'
    const navigationHandoffAt = MODAL_MOTION.shared.enter * 0.82
    const bridgeEase = animateBridge(timeline, bridge, 'open', MODAL_MOTION.shared.enter, id === 'mobile-nav-panel')
    flights.forEach((flight) => flight.addTo(timeline, MODAL_MOTION.shared.enter, bridgeEase))
    timeline.to(target, {
      opacity: 1,
      duration: isMobileNavigation ? 0.12 : 0.16,
      ease: EASE_FLUID,
    }, isMobileNavigation ? navigationHandoffAt : MODAL_MOTION.shared.enter * MODAL_MOTION.shared.subtitleAt)
    timeline.to(reveal.content, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: isMobileNavigation ? 0.12 : MODAL_MOTION.shared.contentDuration,
      stagger: isMobileNavigation ? 0.02 : MODAL_MOTION.shared.stagger,
      ease: 'power3.out',
    }, isMobileNavigation ? navigationHandoffAt : MODAL_MOTION.shared.enter * MODAL_MOTION.shared.contentAt)
    const closeButtonHasSharedFlight = Boolean(
      reveal.closeButton && sharedPairs.some(({ targetEl }) => reveal.closeButton?.contains(targetEl)),
    )
    if (reveal.closeButton && !closeButtonHasSharedFlight) {
      timeline.to(reveal.closeButton, {
        opacity: 1,
        scale: 1,
        duration: MODAL_MOTION.shared.closeDuration,
        ease: 'power3.out',
      }, isMobileNavigation ? navigationHandoffAt : MODAL_MOTION.shared.enter * MODAL_MOTION.shared.closeAt)
    }
    timeline.to(bridge.root, {
      opacity: 0,
      duration: 0.12,
      ease: 'power2.out',
    }, isMobileNavigation ? navigationHandoffAt : MODAL_MOTION.shared.enter * 0.814)
    if (overlay) {
      timeline.to(overlay, {
        opacity: 1,
        duration: MODAL_MOTION.shared.enter * 0.64,
        ease: 'power2.out',
      }, 0.012)
    }
    activeTransitions.set(id, { naturalDirection: 'open', timeline, finishOpen, finishClosed })
    } catch {
      // A malformed origin, a missing SVG resource, or a browser compositor
      // failure must never leave the Radix surface hidden. Fall back to the
      // native fade entrance and keep the dialog usable.
      origin?.classList.remove('modal-flip-source-active')
      if (origin) gsap.set(origin, { clearProps: 'opacity' })
      target.classList.remove('modal-flip-preparing')
      gsap.set(target, { clearProps: 'clipPath,visibility,transition,transform,willChange' })
      target.dataset.modalMotionState = 'open'
      target.style.opacity = '1'
      if (overlay) {
        overlay.classList.remove('modal-flip-active')
        overlay.dataset.modalMotionState = 'open'
        overlay.style.opacity = '1'
      }
      runFadeEntrance(id, target, overlay, onDone)
    }
  },

  untoggle(id: string, onDone?: () => void) {
    if (typeof window === 'undefined') { onDone?.(); return }

    const running = activeTransitions.get(id)
    if (running) {
      if (running.naturalDirection === 'open') reverseOpeningTransition(running, onDone)
      else running.timeline.timeScale(1).play()
      return
    }

    const { origin, target, overlay } = findPair(id)
    if (!target) { onDone?.(); return }
    const mode = getNovoMotionModeFromDOM()
    if (mode !== 'full' || !isElementVisibleForSharedMotion(origin)) {
      origin?.classList.remove('modal-flip-source-active')
      if (origin) gsap.set(origin, { clearProps: 'opacity' })
      runFadeExit(id, target, overlay, onDone)
      return
    }

    try {
      if (id === 'mobile-nav-panel') {
        runMobileNavSurfaceExit(id, origin!, target, overlay, onDone)
        return
      }
      const sharedPairs = findSharedItemPairs(origin!, target)
      const reveal = getRevealElements(target)
      const bridge = createModalChromeBridge(origin!, target)
    const flights = createSharedFlights(sharedPairs, 'close')
    const runtimeNodes = [bridge.root, ...flights.flatMap(({ nodes }) => nodes)]
    gsap.set(origin!, { opacity: 0 })
    gsap.set(sharedPairs.flatMap(({ originEl, targetEl }) => [originEl, targetEl]), { opacity: 0 })
    gsap.set(target, { transition: 'none', willChange: 'opacity' })
    target.dataset.modalMotionState = 'closing'

    const cleanupRuntime = () => runtimeNodes.forEach((node) => node.remove())
    const finishOpen = () => {
      cleanupRuntime()
      restoreSharedItems(sharedPairs)
      clearTarget(target, reveal.content, reveal.closeButton)
      target.style.opacity = '1'
      target.dataset.modalMotionState = 'open'
      if (overlay) gsap.set(overlay, { opacity: 1 })
      gsap.set(origin!, { opacity: 0 })
      activeTransitions.delete(id)
    }
    const finishClosed = (done?: () => void) => {
      cleanupRuntime()
      restoreSharedItems(sharedPairs)
      target.classList.remove('modal-flip-active')
      overlay?.classList.remove('modal-flip-active')
      origin!.classList.remove('modal-flip-source-active')
      gsap.set(origin!, { clearProps: 'opacity' })
      clearTarget(target, reveal.content, reveal.closeButton)
      target.dataset.modalMotionState = 'closing'
      target.style.opacity = '0'
      activeTransitions.delete(id)
      done?.()
    }

    const timeline = gsap.timeline({ defaults: { overwrite: 'auto' }, onComplete: () => finishClosed(onDone) })
    const isMobileNavigation = id === 'mobile-nav-panel'
    const bridgeEase = animateBridge(timeline, bridge, 'close', MODAL_MOTION.shared.exit, id === 'mobile-nav-panel')
    flights.forEach((flight) => flight.addTo(timeline, MODAL_MOTION.shared.exit, bridgeEase))
    timeline.to(reveal.content, { opacity: 0, y: 4, duration: 0.16, ease: 'power2.out' }, 0)
    if (reveal.closeButton) {
      timeline.to(reveal.closeButton, { opacity: 0, scale: 0.84, duration: 0.14, ease: 'power2.out' }, 0)
    }
    timeline.to(target, {
      opacity: 0,
      duration: isMobileNavigation ? 0.12 : 0.14,
      ease: EASE_FLUID,
    }, isMobileNavigation ? 0 : 0.06)
    timeline.to(origin!, { opacity: 1, duration: 0.1, ease: EASE_FLUID }, MODAL_MOTION.shared.exit * 0.78)
    timeline.to(bridge.root, { opacity: 0, duration: 0.1, ease: 'power2.out' }, MODAL_MOTION.shared.exit * 0.82)
    if (overlay) {
      timeline.to(overlay, {
        opacity: 0,
        duration: MODAL_MOTION.shared.exit * 0.72,
        ease: 'power2.out',
      }, MODAL_MOTION.shared.exit * 0.08)
    }
    activeTransitions.set(id, { naturalDirection: 'close', timeline, finishOpen, finishClosed })
    } catch {
      // Closing must also be fail-safe: release the portal instead of leaving
      // a half-built bridge or a stale focus trap behind.
      origin?.classList.remove('modal-flip-source-active')
      if (origin) gsap.set(origin, { clearProps: 'opacity' })
      target.classList.remove('modal-flip-active')
      overlay?.classList.remove('modal-flip-active')
      target.dataset.modalMotionState = 'closing'
      target.style.opacity = '0'
      overlay?.style.setProperty('opacity', '0')
      onDone?.()
    }
  },
}
