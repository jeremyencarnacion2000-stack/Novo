'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Lenis from 'lenis'
import { useSettings } from '@/lib/settings-context'

const LenisContext = createContext<Lenis | null>(null)

export function useLenis(): Lenis | null {
  return useContext(LenisContext)
}

interface SmoothScrollProviderProps {
    children: React.ReactNode
    scrollRef?: React.RefObject<HTMLElement | null>
    scrollElement?: HTMLElement | null
}

export function SmoothScrollProvider({ children, scrollRef, scrollElement }: SmoothScrollProviderProps) {
    const lenisRef = useRef<Lenis | null>(null)
    const [lenisInstance, setLenisInstance] = useState<Lenis | null>(null)
    const pathname = usePathname()
    const rafIdRef = useRef<number | null>(null)
    const { settings } = useSettings()

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
        if (!wrapper || !settings.showAnimations) {
            lenisRef.current?.destroy()
            lenisRef.current = null
            setLenisInstance(null)
            return
        }

        const lenis = new Lenis({
            wrapper,
            content: wrapper.firstElementChild as HTMLElement,
            lerp: 0.08,
            duration: 1.0,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            touchMultiplier: 1.5,
            smoothWheel: true,
            syncTouch: true,
        })

        lenisRef.current = lenis
        setLenisInstance(lenis)

        const resizeObserver = new ResizeObserver(() => {
            lenis.resize()
        })

        if (wrapper.firstElementChild) {
            resizeObserver.observe(wrapper.firstElementChild)
        }

        let running = false
        let idleFrames = 0
        function stop() {
            running = false
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current)
                rafIdRef.current = null
            }
        }
        function raf(time: number) {
            if (!running) return
            lenis.raf(time)

            // The marketing surface deliberately keeps its continuous Lenis
            // rhythm. Authenticated app scrollers sleep after settling and
            // wake only for input/native scroll, removing an idle 60fps loop.
            const isSettled = lenis.isScrolling === false && Math.abs(lenis.velocity) < 0.01
            if (!pathname?.startsWith('/landing') && isSettled) {
                idleFrames += 1
                if (idleFrames >= 2) {
                    stop()
                    return
                }
            } else {
                idleFrames = 0
            }
            rafIdRef.current = requestAnimationFrame(raf)
        }
        function start() {
            if (running || document.hidden) return
            running = true
            idleFrames = 0
            rafIdRef.current = requestAnimationFrame(raf)
        }
        const wake = () => start()
        function handleVisibilityChange() {
            if (document.hidden) stop()
            else if (pathname?.startsWith('/landing')) start()
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        const isLandingRoute = pathname?.startsWith('/landing')
        if (isLandingRoute) {
            start()
        } else {
            wrapper.addEventListener('wheel', wake, { passive: true })
            wrapper.addEventListener('touchstart', wake, { passive: true })
            wrapper.addEventListener('touchmove', wake, { passive: true })
            wrapper.addEventListener('scroll', wake, { passive: true })
            wrapper.addEventListener('pointerdown', wake, { passive: true })
        }

        return () => {
            resizeObserver.disconnect()
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            wrapper.removeEventListener('wheel', wake)
            wrapper.removeEventListener('touchstart', wake)
            wrapper.removeEventListener('touchmove', wake)
            wrapper.removeEventListener('scroll', wake)
            wrapper.removeEventListener('pointerdown', wake)
            stop()
            lenis.destroy()
            lenisRef.current = null
            setLenisInstance(null)
        }
    }, [scrollRef, scrollElement, settings.showAnimations, pathname])

    return <LenisContext.Provider value={lenisInstance}>{children}</LenisContext.Provider>
}
