'use client'

import { flushSync } from 'react-dom'

type ViewTransitionLike = {
  finished?: Promise<unknown>
  ready?: Promise<unknown>
  skipTransition?: () => void
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransitionLike
}

let activeTransition: ViewTransitionLike | null = null

function clearTransition(transition: ViewTransitionLike) {
  if (activeTransition === transition) activeTransition = null
}

/**
 * Starts at most one native View Transition at a time. Chromium rejects a
 * second transition while the first one is capturing; skipping the previous
 * frame first turns rapid route/theme updates into a clean hand-off instead
 * of an AbortError and stale DOM references.
 */
export function safeViewTransition(callback: () => void) {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    callback()
    return
  }

  const doc = document as ViewTransitionDocument
  if (typeof doc.startViewTransition !== 'function') {
    callback()
    return
  }

  if (activeTransition) {
    try {
      activeTransition.skipTransition?.()
    } catch {
      // The browser may have already completed the old transition.
    }
    activeTransition = null
  }

  let transition: ViewTransitionLike
  try {
    transition = doc.startViewTransition(() => {
      flushSync(callback)
    }) ?? {}
  } catch {
    // A browser/extension can still reject the API after feature detection.
    callback()
    return
  }

  activeTransition = transition
  transition.finished?.then(
    () => clearTransition(transition),
    () => clearTransition(transition),
  )
  transition.ready?.catch(() => clearTransition(transition))
  return transition
}