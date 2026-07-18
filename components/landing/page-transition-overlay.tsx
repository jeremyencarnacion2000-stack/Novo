'use client'

import { createContext, useContext, useRef, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'

// GSAP-driven full-screen reveal transition for landing → auth navigation
// (the "page transition" reference queued in project-landing-redesign-references
// memory). Deliberately NOT the native View Transitions API / next-view-transitions
// library the reference video used — this project already made that call for
// GSAP Flip modals specifically because of cross-browser View Transitions
// inconsistency (see project-visual-direction memory), and the same concern
// applies here. A clip-path circle-reveal driven by GSAP gets the same visual
// effect without that dependency.

interface PageTransitionContextType {
    transitionTo: (href: string) => void
}

const PageTransitionContext = createContext<PageTransitionContextType | null>(null)

export function usePageTransition() {
    const ctx = useContext(PageTransitionContext)
    if (!ctx) throw new Error('usePageTransition must be used within PageTransitionProvider')
    return ctx
}

export function PageTransitionProvider({ children }: { children: ReactNode }) {
    const router = useRouter()
    const overlayRef = useRef<HTMLDivElement>(null)
    const isTransitioning = useRef(false)

    const playRevealTransition = useCallback((overlay: HTMLDivElement, href: string) => {
        gsap.set(overlay, { display: 'block', clipPath: 'circle(0% at 50% 50%)' })
        gsap.to(overlay, {
            clipPath: 'circle(150% at 50% 50%)',
            duration: 0.6,
            ease: 'power3.inOut',
            onComplete: () => {
                router.push(href)
                // Next.js App Router navigation has no "new page painted" event
                // to hook without the native View Transitions API — a short
                // fixed beat gives the new route's initial render a moment to
                // land underneath the (still fully covering) overlay before
                // it retracts.
                setTimeout(() => {
                    gsap.to(overlay, {
                        clipPath: 'circle(0% at 50% 50%)',
                        duration: 0.6,
                        ease: 'power3.inOut',
                        onComplete: () => {
                            gsap.set(overlay, { display: 'none' })
                            isTransitioning.current = false
                        }
                    })
                }, 120)
            }
        })
    }, [router])

    const transitionTo = useCallback((href: string) => {
        const overlay = overlayRef.current
        if (isTransitioning.current || !overlay) {
            router.push(href)
            return
        }
        isTransitioning.current = true

        // This runs on the landing page's primary conversion CTAs — if GSAP
        // throws for any reason, navigate immediately rather than stranding
        // the click on a dead animation.
        try {
            playRevealTransition(overlay, href)
        } catch (err) {
            console.error('[PageTransition] animation failed, navigating directly:', err)
            isTransitioning.current = false
            router.push(href)
        }
    }, [router, playRevealTransition])

    return (
        <PageTransitionContext.Provider value={{ transitionTo }}>
            {children}
            <div
                ref={overlayRef}
                aria-hidden
                style={{
                    display: 'none',
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    background: '#050505',
                    pointerEvents: 'none',
                }}
            />
        </PageTransitionContext.Provider>
    )
}
