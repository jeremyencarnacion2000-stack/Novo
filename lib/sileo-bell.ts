'use client'

// Bridge between the real `sileo` npm package and the notification bell.
//
// sileo's own <Toaster> renders floating cards with no way to anchor them to
// a specific DOM element, and its internal toast store isn't exported — so
// there's no public subscribe API. This bridge re-implements sileo's exact
// method surface (same option shape, same states) but routes the toast into
// the bell's physical morph instead of a floating card, per product design:
// the bell IS the toast's origin point.
//
// All app code should import `sileo` from here instead of from 'sileo'
// directly, so every action-triggered notification (task created, tracker
// completed, cognitive phase change, voice command result) surfaces through
// the same origin.

import type { SileoOptions, SileoState, SileoButton } from 'sileo'
import { LIQUID_NOTICE } from '@/lib/liquid-notification'

export type { SileoOptions, SileoState, SileoButton }

export interface BellToast extends SileoOptions {
  id: string
  type: SileoState
}

type BellListener = (toast: BellToast | null) => void

let listener: BellListener | null = null
let counter = 0
let clearTimer: ReturnType<typeof setTimeout> | null = null
let current: BellToast | null = null

function fire(type: SileoState, opts: SileoOptions): string {
  const id = `sileo-${++counter}`
  if (clearTimer) clearTimeout(clearTimer)

  current = { ...opts, type, id }
  listener?.(current)

  const duration = opts.duration === undefined ? 5000 : opts.duration
  if (duration !== null) {
    clearTimer = setTimeout(() => { current = null; listener?.(null) }, duration + LIQUID_NOTICE.enter.reveal + 2200)
  }
  return id
}

/** Start readable dwell after the retained previous card has returned and this
 * notice has fully revealed. The fire() timer is a bounded unmounted fallback. */
export function markSileoBellPresented(id: string) {
  if (!current || current.id !== id) return
  if (clearTimer) clearTimeout(clearTimer)
  const duration = current.duration === undefined ? 5000 : current.duration
  if (duration !== null) clearTimer = setTimeout(() => { current = null; listener?.(null) }, duration)
}

export const sileo = {
  show: (opts: SileoOptions) => fire(opts.type ?? 'info', opts),
  success: (opts: SileoOptions) => fire('success', opts),
  warning: (opts: SileoOptions) => fire('warning', opts),
  error: (opts: SileoOptions) => fire('error', opts),
  info: (opts: SileoOptions) => fire('info', opts),
  action: (opts: SileoOptions) => fire('action', opts),
  dismiss: (id?: string) => {
    if (id && current?.id !== id) return
    if (clearTimer) clearTimeout(clearTimer)
    current = null
    listener?.(null)
  },
  clear: () => {
    if (clearTimer) clearTimeout(clearTimer)
    current = null
    listener?.(null)
  },
}

// Called once by the bell (NotificationCenter) to receive live toasts.
export function subscribeSileoBell(fn: BellListener) {
  listener = fn
  fn(current)
  return () => {
    if (listener === fn) listener = null
  }
}
