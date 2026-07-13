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

export type { SileoOptions, SileoState, SileoButton }

export interface BellToast extends SileoOptions {
  id: string
  type: SileoState
}

type BellListener = (toast: BellToast | null) => void

let listener: BellListener | null = null
let counter = 0
let clearTimer: ReturnType<typeof setTimeout> | null = null

function fire(type: SileoState, opts: SileoOptions): string {
  const id = `sileo-${++counter}`
  if (clearTimer) clearTimeout(clearTimer)

  listener?.({ ...opts, type, id })

  const duration = opts.duration === undefined ? 5000 : opts.duration
  if (duration !== null) {
    clearTimer = setTimeout(() => listener?.(null), duration)
  }
  return id
}

export const sileo = {
  show: (opts: SileoOptions) => fire(opts.type ?? 'info', opts),
  success: (opts: SileoOptions) => fire('success', opts),
  warning: (opts: SileoOptions) => fire('warning', opts),
  error: (opts: SileoOptions) => fire('error', opts),
  info: (opts: SileoOptions) => fire('info', opts),
  action: (opts: SileoOptions) => fire('action', opts),
  dismiss: (_id?: string) => {
    if (clearTimer) clearTimeout(clearTimer)
    listener?.(null)
  },
  clear: () => {
    if (clearTimer) clearTimeout(clearTimer)
    listener?.(null)
  },
}

// Called once by the bell (NotificationCenter) to receive live toasts.
export function subscribeSileoBell(fn: BellListener) {
  listener = fn
  return () => {
    if (listener === fn) listener = null
  }
}
