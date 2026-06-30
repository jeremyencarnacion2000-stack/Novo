'use client'

import { useState, useRef, useEffect } from 'react'
import { useScrollContainer } from '@/lib/scroll-container-context'

export function useScrollDirection(threshold = 30): 'up' | 'down' | null {
  const { scrollContainer } = useScrollContainer()
  const [direction, setDirection] = useState<'up' | 'down' | null>(null)
  const lastY = useRef(0)
  const ticking = useRef(false)

  useEffect(() => {
    const el = scrollContainer
    if (!el) return

    function onScroll() {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        const y = el!.scrollTop
        const delta = y - lastY.current
        if (delta > threshold) {
          setDirection('down')
          lastY.current = y
        } else if (delta < -threshold) {
          setDirection('up')
          lastY.current = y
        }
        ticking.current = false
      })
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollContainer, threshold])

  return direction
}
