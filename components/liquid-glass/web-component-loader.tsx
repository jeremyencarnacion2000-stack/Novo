'use client'

import { useEffect } from 'react'

const scripts = [
  '/liquid-glass/displacement-utils.js',
  '/liquid-glass/glass-element.js',
  '/liquid-glass/video-variant.js',
]

function loadScript(src: string) {
  const existing = document.querySelector<HTMLScriptElement>(
    `script[data-novo-liquid-glass="${src}"]`,
  )
  if (existing) {
    if (existing.dataset.loaded === 'true') return Promise.resolve()
    return new Promise<void>((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`Unable to load ${src}`)), { once: true })
    })
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = false
    script.dataset.novoLiquidGlass = src
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    }, { once: true })
    script.addEventListener('error', () => reject(new Error(`Unable to load ${src}`)), { once: true })
    document.head.appendChild(script)
  })
}

/**
 * Loads the supplied vanilla web-component renderer only inside the
 * authenticated shell. The landing route never mounts ClientLayout, so its
 * script graph and visual contract remain untouched.
 */
export function LiquidGlassWebComponentLoader() {
  useEffect(() => {
    let cancelled = false
    let loadStarted = false
    let idleHandle: number | null = null
    let timeoutHandle: number | null = null

    const cleanupSchedule = () => {
      if (idleHandle !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle)
        idleHandle = null
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle)
        timeoutHandle = null
      }
    }

    const start = () => {
      if (cancelled || loadStarted || document.visibilityState === 'hidden') return
      loadStarted = true
      cleanupSchedule()

      void scripts.reduce(
        (chain, src) => chain.then(() => loadScript(src)),
        Promise.resolve(),
      ).then(() => {
        if (!cancelled) {
          document.documentElement.dataset.novoLiquidGlassReady = 'true'
          window.dispatchEvent(new CustomEvent('novo:liquid-glass-ready'))
        }
      }).catch((error) => {
        // React's renderer remains the safe fallback when a browser blocks one
        // of the optional web-component assets (Safari/Firefox included).
        if (!cancelled) {
          document.documentElement.dataset.novoLiquidGlassReady = 'fallback'
          console.warn('[Novo] Liquid Glass web component fallback', error)
        }
      })
    }

    const schedule = () => {
      if (cancelled || loadStarted || document.visibilityState === 'hidden') return
      cleanupSchedule()
      if (typeof window.requestIdleCallback === 'function') {
        idleHandle = window.requestIdleCallback(() => start(), { timeout: 1200 })
      } else {
        timeoutHandle = window.setTimeout(start, 700)
      }
    }

    const activateOnInteraction = () => start()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') schedule()
      else cleanupSchedule()
    }

    // Let the route paint first, but never make a user wait for the material.
    // The first gesture pulls the renderer forward before the interaction's
    // next frame, while idle browsers get the same optical layer shortly after
    // the shell settles.
    window.addEventListener('pointerdown', activateOnInteraction, { capture: true, once: true })
    window.addEventListener('keydown', activateOnInteraction, { capture: true, once: true })
    document.addEventListener('visibilitychange', handleVisibility)
    schedule()

    return () => {
      cancelled = true
      cleanupSchedule()
      window.removeEventListener('pointerdown', activateOnInteraction, true)
      window.removeEventListener('keydown', activateOnInteraction, true)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return null
}
