'use client'

import { useEffect, useState } from 'react'

export type NovoMotionMode = 'full' | 'reduced' | 'off'

type MotionPolicyInput = {
  showAnimations: boolean
  systemPrefersReducedMotion: boolean
}

/**
 * The in-app switch is the universal hard stop; the operating system's reduced
 * motion preference applies on every screen size.
 */
export function resolveNovoMotionMode({
  showAnimations,
  systemPrefersReducedMotion,
}: MotionPolicyInput): NovoMotionMode {
  if (!showAnimations) return 'off'
  if (systemPrefersReducedMotion) return 'reduced'
  return 'full'
}

function readMedia(query: string) {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches
}

export function getNovoMotionModeFromDOM(): NovoMotionMode {
  if (typeof document === 'undefined') return 'full'
  const value = document.documentElement.dataset.novoMotion
  return value === 'off' || value === 'reduced' ? value : 'full'
}

export function shouldReduceNovoMotion() {
  return getNovoMotionModeFromDOM() !== 'full'
}

export function useNovoMotionPolicy(showAnimationsOverride?: boolean): NovoMotionMode {
  const [appAnimationsEnabled, setAppAnimationsEnabled] = useState(() => {
    if (showAnimationsOverride !== undefined) return showAnimationsOverride
    return typeof document === 'undefined' || document.documentElement.dataset.animations !== 'false'
  })
  const [environment, setEnvironment] = useState(() => ({
    systemPrefersReducedMotion: readMedia('(prefers-reduced-motion: reduce)'),
  }))

  useEffect(() => {
    if (showAnimationsOverride !== undefined) {
      setAppAnimationsEnabled(showAnimationsOverride)
      return
    }

    const root = document.documentElement
    const update = () => setAppAnimationsEnabled(root.dataset.animations !== 'false')
    update()
    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ['data-animations'] })
    return () => observer.disconnect()
  }, [showAnimationsOverride])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setEnvironment({ systemPrefersReducedMotion: reducedQuery.matches })

    update()
    reducedQuery.addEventListener?.('change', update)
    return () => reducedQuery.removeEventListener?.('change', update)
  }, [])

  const mode = resolveNovoMotionMode({
    showAnimations: appAnimationsEnabled,
    ...environment,
  })

  useEffect(() => {
    document.documentElement.dataset.novoMotion = mode
  }, [mode])

  return mode
}
