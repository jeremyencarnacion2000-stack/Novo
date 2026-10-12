'use client'

import { useEffect, useState } from 'react'

export type NovoMotionMode = 'full' | 'reduced' | 'off'

type MotionPolicyInput = {
  showAnimations: boolean
  isMobile: boolean
  systemPrefersReducedMotion: boolean
}

/**
 * Novo owns the desktop motion preference. The operating-system preference is
 * still honoured on mobile, where long ambient motion has a larger comfort and
 * battery cost, while the in-app switch remains the universal hard stop.
 */
export function resolveNovoMotionMode({
  showAnimations,
  isMobile,
  systemPrefersReducedMotion,
}: MotionPolicyInput): NovoMotionMode {
  if (!showAnimations) return 'off'
  if (isMobile && systemPrefersReducedMotion) return 'reduced'
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
    isMobile: readMedia('(max-width: 767px)'),
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
    const mobileQuery = window.matchMedia('(max-width: 767px)')
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setEnvironment({
      isMobile: mobileQuery.matches,
      systemPrefersReducedMotion: reducedQuery.matches,
    })

    update()
    mobileQuery.addEventListener?.('change', update)
    reducedQuery.addEventListener?.('change', update)
    return () => {
      mobileQuery.removeEventListener?.('change', update)
      reducedQuery.removeEventListener?.('change', update)
    }
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
