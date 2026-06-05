'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Lenis from 'lenis'

interface SmoothScrollProviderProps {
    children: React.ReactNode
    /** The scrollable element ref — if null, applies to window */
    scrollRef?: React.RefObject<HTMLElement | null>
    /** Direct HTMLElement — preferred over scrollRef when available */
    scrollElement?: HTMLElement | null
}

export function SmoothScrollProvider({ children, scrollRef, scrollElement }: SmoothScrollProviderProps) {
    const lenisRef = useRef<Lenis | null>(null)
    const pathname = usePathname()
    const rafIdRef = useRef<number | null>(null)

    // Reset scroll on navigation
    useEffect(() => {
        if (lenisRef.current) {
            lenisRef.current.scrollTo(0, { immediate: true })
            
            const timer = setTimeout(() => {
                if (lenisRef.current) {
                    lenisRef.current.resize()
                    lenisRef.current.scrollTo(0, { immediate: true })
                }
            }, 100)
            
            return () => clearTimeout(timer)
        }
    }, [pathname])

    useEffect(() => {
        // Resolve the wrapper element: prefer scrollElement, fallback to scrollRef
        const wrapper = scrollElement ?? scrollRef?.current
        if (!wrapper) return

        const lenis = new Lenis({
            wrapper,
            content: wrapper.firstElementChild as HTMLElement,
            duration: 1.0,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            touchMultiplier: 1.5,
            smoothWheel: true,
            syncTouch: true,
        })

        lenisRef.current = lenis

        const resizeObserver = new ResizeObserver(() => {
            lenis.resize()
        })

        if (wrapper.firstElementChild) {
            resizeObserver.observe(wrapper.firstElementChild)
        }

        function raf(time: number) {
            lenis.raf(time)
            rafIdRef.current = requestAnimationFrame(raf)
        }
        rafIdRef.current = requestAnimationFrame(raf)

        return () => {
            resizeObserver.disconnect()
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current)
            }
            lenis.destroy()
            lenisRef.current = null
        }
    }, [scrollRef, scrollElement])

    return <>{children}</>
}
