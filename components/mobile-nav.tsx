'use client'

import React from 'react'
import { House, Brain, MessageCircle, Activity, Plus } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { MobileSectionDrawer } from '@/components/mobile-section-drawer'
import { motion, LayoutGroup } from 'framer-motion'
import { appleLiquidMotion, springConfig } from '@/lib/design-tokens'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { useTranslation } from '@/lib/i18n'
import { useMobileOverlay } from '@/components/mobile-overlay-provider'
import { useEffect, useState } from 'react'
import { useRef } from 'react'
import { CommandCenterLiquidMorph } from '@/components/command-center-liquid-morph'

export function MobileNav() {
    const router = useRouter()
    const pathname = usePathname()
    const { t } = useTranslation()
    const { activeOverlay, closeOverlay, openOverlay, suppressSecondary } = useMobileOverlay()
    const drawerOpen = activeOverlay === 'navigation'
    const [drawerMounted, setDrawerMounted] = useState(false)
    const liquidSourceRef = useRef<HTMLDivElement>(null)
    const liquidRailRef = useRef<HTMLDivElement>(null)
    const liquidFabRef = useRef<HTMLButtonElement>(null)
    const liquidPlusGlyphRef = useRef<SVGSVGElement>(null)
    const liquidMergeState = drawerMounted
        ? (drawerOpen ? 'opening' : 'closing')
        : 'rest'

    // The dialog portal can finish its focus-restoration callback after a
    // reversed spring. Keep the physical exit visible, but always release the
    // real navbar afterwards so its buttons cannot remain inert.
    useEffect(() => {
        if (!drawerMounted || drawerOpen) return
        const release = window.setTimeout(() => setDrawerMounted(false), 780)
        return () => window.clearTimeout(release)
    }, [drawerMounted, drawerOpen])

    const handleCloseDrawer = (options?: { historyAction?: 'back' | 'replace' | 'none' }) =>
        closeOverlay(options)
    const handleOpenVoice = () => {
        setDrawerMounted(false)
        openOverlay('voice')
    }
    const handleFabClick = () => {
        navigator.vibrate?.(10)
        if (drawerOpen) handleCloseDrawer()
        else {
            setDrawerMounted(true)
            openOverlay('navigation')
        }
    }

    const isActive = (path: string) => {
        const currentPath = pathname ?? ''
        return currentPath === path || currentPath === path + '/' || currentPath.startsWith(path + '/')
    }

    const navItems = [
        { icon: House, path: '/', label: t('sidebar.dashboard'), sharedId: 'mobile-nav-item-dashboard' },
        { icon: Brain, path: '/cognitive', label: t('sidebar.cognitive_engine'), sharedId: 'mobile-nav-item-cognitive' },
        { icon: MessageCircle, path: '/chat', label: t('sidebar.chat'), sharedId: 'mobile-nav-item-chat' },
        { icon: Activity, path: '/activity', label: t('sidebar.activity'), sharedId: 'mobile-nav-item-activity' },
    ]

    const isCompactPath = pathname === '/ai' || pathname === '/chat' || pathname === '/music' || !!pathname?.startsWith('/music/') || pathname === '/cognitive'

    // When the software keyboard or a different modal/sheet owns the mobile
    // surface, remove every background navigation target from the a11y tree.
    if (suppressSecondary && activeOverlay !== 'navigation') return null

    return (
        <>
            {/* Nav bar stays put — it used to auto-hide on scroll-down via
                useScrollDirection, but after heavy navigation the scroll-
                direction state would get stuck and leave the bar hidden
                off-screen (the reported "se buggea"). A persistent bar is
                simpler and never strands the user without navigation. */}
            <nav
                aria-label="Primary mobile navigation"
                aria-hidden={drawerMounted}
                inert={drawerMounted}
                className="fixed bottom-[var(--mobile-navigation-bottom)] left-4 right-4 z-[100] md:hidden flex items-center justify-center pointer-events-none"
            >
                {/* This transparent frame measures the union of the rail and +.
                    FLIP uses it only as the opening/closing origin; the two
                    controls remain distinct glass surfaces while idle. */}
                <div
                    ref={liquidSourceRef}
                    data-flip-from="mobile-nav-panel"
                    data-liquid-morph-controller="true"
                    data-liquid-merge-state={liquidMergeState}
                    className="relative mx-auto flex items-center gap-3"
                >
                    {/* This is the geometry layer only: two soft blobs create a
                        short-lived liquid neck between the real rail and FAB.
                        The controls and their SVG lenses stay above it, so text
                        and icons never pass through the goo filter. */}
                    <svg aria-hidden="true" width="0" height="0" className="absolute">
                        <defs>
                            <filter
                                id="novo-mobile-nav-liquid-merge"
                                x="-80%"
                                y="-80%"
                                width="260%"
                                height="260%"
                                colorInterpolationFilters="sRGB"
                            >
                                <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="liquid-blur" />
                                <feColorMatrix
                                    in="liquid-blur"
                                    type="matrix"
                                    values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -8"
                                />
                            </filter>
                        </defs>
                    </svg>
                    <div data-liquid-merge-geometry aria-hidden="true" className="novo-mobile-nav-liquid-geometry">
                        <span className="novo-mobile-nav-liquid-blob novo-mobile-nav-liquid-blob--rail" />
                        <span className="novo-mobile-nav-liquid-blob novo-mobile-nav-liquid-blob--fab" />
                    </div>
                    <div
                        ref={liquidRailRef}
                        data-testid="mobile-nav-rail"
                        className={cn(
                            "relative z-10 isolate flex items-center gap-1 rounded-full pointer-events-auto p-1 novo-mobile-nav-shell",
                            isCompactPath ? "px-3 py-1.5" : "px-2 py-2"
                        )}
                    >
                        <GlassSurface
                            aria-hidden
                            data-testid="mobile-nav-rail-glass"
                            preset="navigation"
                            refractive
                            refractiveActive={!drawerMounted}
                            refractivePriority="ambient"
                            webComponent
                            backgroundColor="rgba(255,255,255,0.055)"
                            elevation="low"
                            className="pointer-events-none absolute inset-0 z-0 h-full w-full"
                            style={{ position: 'absolute', inset: 0, zIndex: 0, borderRadius: 'inherit' }}
                        />
                        <LayoutGroup>
                            {navItems.map((item) => {
                                const Icon = item.icon
                                const active = isActive(item.path)

                                return (
                                    <motion.button
                                        key={item.path}
                                        data-testid={drawerMounted ? undefined : 'mobile-primary-target'}
                                        aria-label={item.label}
                                        aria-current={active ? 'page' : undefined}
                                        onClick={() => {
                                            navigator.vibrate?.(10)
                                            router.push(item.path)
                                        }}
                                        className={cn(
                                            "relative z-10 flex items-center justify-center rounded-full transition-colors min-w-[44px] min-h-[44px] h-[44px] novo-nav-glass-control",
                                            active ? "text-foreground" : "text-foreground/65",
                                            active && "px-4"
                                        )}
                                        data-active={active}
                                        whileTap={{ scale: appleLiquidMotion.pressScale }}
                                        transition={appleLiquidMotion.pressTransition}
                                        layout
                                    >
                                        {active && (
                                            <motion.div
                                                layoutId="mobile-nav-pill"
                                                className="absolute inset-0"
                                                transition={springConfig.smooth}
                                            >
                                                <GlassSurface
                                                    preset="navigation"
                                                    refractive
                                                    refractiveActive={!drawerMounted}
                                                    depth={6}
                                                    chromaticAberration={3.5}
                                                    refractivePriority="interactive"
                                                    webComponent
                                                    backgroundColor="rgba(255,255,255,0.1)"
                                                    elevation="low"
                                                    className="h-full w-full"
                                                />
                                            </motion.div>
                                        )}
                                        <Icon
                                            data-shared-item={item.sharedId}
                                            className={cn("relative z-10", isCompactPath ? "h-[18px] w-[18px]" : "h-[20px] w-[20px]")}
                                            strokeWidth={active ? 2.2 : 1.5}
                                        />
                                        {/* Icons preserve four 44px touch targets at 320px. The active
                                            label appears once the available width can accommodate it. */}
                                        {active && (
                                            <motion.span
                                                initial={{ opacity: 0, width: 0 }}
                                                animate={{ opacity: 1, width: 'auto' }}
                                                className="hidden min-[390px]:inline text-[10px] font-semibold tracking-wide relative z-10 ml-1.5 whitespace-nowrap"
                                            >
                                                {item.label}
                                            </motion.span>
                                        )}
                                    </motion.button>
                                )
                            })}
                        </LayoutGroup>
                    </div>

                    <motion.button
                        ref={liquidFabRef}
                        onClick={handleFabClick}
                        data-testid={drawerMounted ? undefined : 'mobile-primary-target'}
                        aria-label={drawerOpen ? "Close menu" : "Open menu"}
                        className="novo-mobile-nav-fab relative z-10 isolate flex min-h-[44px] min-w-[44px] min-h-[48px] min-w-[48px] items-center justify-center overflow-hidden rounded-full pointer-events-auto"
                        whileTap={{ scale: appleLiquidMotion.pressScale }}
                        transition={appleLiquidMotion.pressTransition}
                    >
                        <GlassSurface
                            aria-hidden
                            data-testid="mobile-nav-plus-glass"
                            preset="navigation"
                            refractive
                            refractiveActive={!drawerMounted}
                            refractivePriority="interactive"
                            webComponent
                            backgroundColor="rgba(255,255,255,0.055)"
                            elevation="low"
                            className="pointer-events-none absolute inset-0 z-0 h-full w-full"
                            style={{ position: 'absolute', inset: 0, zIndex: 0, borderRadius: 'inherit' }}
                        />
                        {/* The liquid controller owns this glyph's entire
                            flight and rotation. Keeping it out of a second
                            Framer transform prevents the + → close handoff
                            from being overwritten midway through the morph. */}
                        <div className="relative z-10">
                            <Plus
                                ref={liquidPlusGlyphRef}
                                data-shared-item="mobile-nav-close"
                                className="h-5 w-5 text-foreground"
                                strokeWidth={2.25}
                            />
                        </div>
                    </motion.button>
                </div>
            </nav>

            {/* Keep the real rail mounted as the physical FLIP origin. Dialog
                owns deferred portal presence through the complete exit flight. */}
            {drawerMounted && (
                <>
                    <MobileSectionDrawer
                        open={drawerOpen}
                        onClose={handleCloseDrawer}
                        onOpenVoice={handleOpenVoice}
                    />
                    <CommandCenterLiquidMorph
                        active={drawerOpen}
                        mounted={drawerMounted}
                        sourceRef={liquidSourceRef}
                        railRef={liquidRailRef}
                        fabRef={liquidFabRef}
                        plusGlyphRef={liquidPlusGlyphRef}
                    />
                </>
            )}
        </>
    )
}
