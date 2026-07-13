'use client'

import { useCallback, useEffect } from 'react'
import { modalFlip } from '@/lib/modal-flip'

/**
 * Wires a dialog into the shared-element flip system: plays the open flight
 * once `open` becomes true (deferred one frame so the flip target has
 * mounted), and returns a close function that plays the return flight
 * before calling `onDone`.
 */
export function useModalFlip(flipKey: string, open: boolean) {
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      modalFlip.toggle(flipKey)
    })
    return () => cancelAnimationFrame(id)
  }, [open, flipKey])

  return useCallback(
    (onDone?: () => void) => {
      modalFlip.untoggle(flipKey, onDone)
    },
    [flipKey],
  )
}
