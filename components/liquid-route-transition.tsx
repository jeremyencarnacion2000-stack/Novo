'use client'

import * as React from 'react'
import type {} from 'react/canary'
import { usePathname } from 'next/navigation'
import { useNovoMotionPolicy } from '@/hooks/use-novo-motion-policy'
import { hasRecentNavigation } from '@/lib/navigation-origin'

/** Browser snapshots carry the old pixels; only the current router tree lives. */
export function LiquidRouteTransition({ children }: { children: React.ReactElement }) {
  const pathname = usePathname() ?? '/'
  const mode = useNovoMotionPolicy()
  const surface = React.useRef<HTMLDivElement | null>(null)
  const fallback = React.useRef<Animation | null>(null)
  const nativeOwned = React.useRef(false)
  const originalRef = (children.props as React.RefAttributes<HTMLDivElement>).ref
  const setSurface = React.useCallback((node: HTMLDivElement | null) => {
    surface.current = node
    if (typeof originalRef === 'function') originalRef(node)
    else if (originalRef) originalRef.current = node
  }, [originalRef])
  const claimNative = React.useCallback(() => {
    nativeOwned.current = true
    fallback.current?.cancel()
  }, [])

  // A new authenticated shell can become ready through an ordinary state
  // update, after the router's native snapshot has ended. Give only a recent
  // intended destination the same short entrance. Native callbacks cancel
  // this fallback before painting a shared/enter snapshot; there is one owner.
  React.useLayoutEffect(() => {
    nativeOwned.current = false
    if (mode === 'off' || !hasRecentNavigation(pathname)) return
    const frame = requestAnimationFrame(() => {
      if (nativeOwned.current || !surface.current?.animate) return
      fallback.current = surface.current.animate(mode === 'reduced'
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
          { opacity: 0, transform: 'translateY(8px) scale(.978,.985)', clipPath: 'inset(.5% .8% 1.2% round 44px)' },
          { opacity: 1, transform: 'none', clipPath: 'inset(0 round 0)' },
        ], { duration: mode === 'reduced' ? 120 : 300, easing: 'cubic-bezier(.22,1,.36,1)' })
    })
    return () => { cancelAnimationFrame(frame); fallback.current?.cancel(); fallback.current = null }
  }, [mode, pathname])

  const content = React.cloneElement(children as React.ReactElement<React.RefAttributes<HTMLDivElement>>, { ref: setSurface })
  // Next's App Router supplies React canary. Stable React in isolated tools and
  // browsers without View Transitions simply render the same live content.
  const Transition = React.ViewTransition
  if (!Transition) return content
  const animation = mode === 'off' ? 'none' : mode === 'reduced' ? 'novo-route-fade' : 'novo-route-liquid'
  return (
    <Transition key={pathname} name="novo-route" default="none"
      share={animation}
      onEnter={claimNative} onShare={claimNative}
      enter={hasRecentNavigation(pathname) ? animation : 'none'}>
      {content}
    </Transition>
  )
}
