'use client'

import { useCallback, useLayoutEffect } from 'react'
import { modalFlip } from '@/lib/modal-flip'

/**
 * Wires a dialog into the shared-element flip system: plays the open flight
 * once `open` becomes true, and returns a close function that plays the
 * return flight before calling `onDone`.
 */
export function useModalFlip(flipKey: string, open: boolean) {
  useLayoutEffect(() => {
    if (!open) return
    modalFlip.toggle(flipKey)
  }, [open, flipKey])

  return useCallback(
    (onDone?: () => void) => {
      modalFlip.untoggle(flipKey, onDone)
    },
    [flipKey],
  )
}
