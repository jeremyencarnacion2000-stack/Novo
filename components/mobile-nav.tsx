'use client'

import React from 'react'
import { House, Brain, MessageCircle, Activity, Plus } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { MobileSectionDrawer } from '@/components/mobile-section-drawer'
import { motion, LayoutGroup } from 'framer-motion'
import { springConfig } from '@/lib/design-tokens'
import { useModalFlip } from '@/hooks/use-modal-flip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { useTranslation } from '@/lib/i18n'
import { useMobileOverlay } from '@/components/mobile-overlay-provider'

export function MobileNav() {
    const router = useRouter()
    const pathname = usePathname()
    const { t } = useTranslation()
    const { activeOverlay, closeOverlay, openOverlay, suppressSecondary } = useMobileOverlay()
    const drawerOpen = activeOverlay === 'navigation'

    // Container-transform: the panel physically grows from the NAV BAR's own
    // rect/radius (matching the reference's shared-element demo) instead of
    // sliding up as a generic sheet — the "+" FAB is a separate persistent
    // trigger (it just rotates into an "X"), it is not itself the thing that
    // expands. `drawerOpen` stays true for the whole close flight — same
    // deferred-unmount pattern every other flip dialog in this app uses —
    // only flipping false in the flight's onDone.
    const closeDrawerFlip = useModalFlip('mobile-nav-panel', drawerOpen)
    const handleCloseDrawer = (options?: { historyAction?: 'back' | 'replace' | 'none' }) =>
        closeDrawerFlip(() => closeOverlay(options))
    const handleOpenVoice = () => closeDrawerFlip(() => openOverlay('voice'))
    const handleFabClick = () => {
        navigator.vibrate?.(10)
        if (drawerOpen) handleCloseDrawer()
        else openOverlay('navigation')
    }

    const isActive = (path: string) => {
        const currentPath = pathname ?? ''
        return currentPath === path || currentPath === path + '/' || currentPath.startsWith(path + '/')
    }

    const navItems = [
        { icon: House, path: '/', label: t('sidebar.dashboard') },
        { icon: Brain, path: '/cognitive', label: t('sidebar.cognitive_engine') },
        { icon: MessageCircle, path: '/chat', label: t('sidebar.chat') },
        { icon: Activity, path: '/activity', label: t('sidebar.activity') },
    ]

    const isCompactPath = pathname === '/ai' || pathname === '/chat' || pathname === '/music' || !!pathname?.startsWith('/music/') || pathname === '/cognitive'

    // When the software keyboard or a different modal/sheet owns the mobile
    // surface, remove every background navigation target from the a11y tree.
    if (suppressSecondary && activeOverlay !== 'navigation') return null

    if (drawerOpen) {
        return (
            <>
                <div
                    className="fixed bottom-4 left-4 right-4 z-[100] md:hidden pointer-events-none"
                    style={{ paddingBottom: 'var(--mobile-safe-area-bottom)' }}
                >
                    <motion.div
                        data-flip-from="mobile-nav-panel"
                        className="relative isolate flex items-center gap-1 rounded-full novo-mobile-nav-shell px-3 py-1.5"
                        layout
                    >
                        <GlassSurface
                            aria-hidden
                            radius={9999}
                            depth={4}
                            blur={1}
                            strength={24}
                            chromaticAberration={2.5}
                            backgroundColor="rgba(255,255,255,0.055)"
                            elevation="low"
                            className="pointer-events-none absolute inset-0 z-0 h-full w-full"
                            style={{ position: 'absolute', inset: 0, zIndex: 0, borderRadius: 'inherit' }}
                        />
                    </motion.div>
                </div>

                <MobileSectionDrawer
                    onClose={handleCloseDrawer}
                    onOpenVoice={handleOpenVoice}
                />
            </>
        )
    }

    return (
        <>
            {/* Nav bar stays put — it used to auto-hide on scroll-down via
                useScrollDirection, but after heavy navigation the scroll-
                direction state would get stuck and leave the bar hidden
                off-screen (the reported "se buggea"). A persistent bar is
                simpler and never strands the user without navigation. */}
            <nav
                aria-label="Primary mobile navigation"
                className="fixed bottom-4 left-4 right-4 z-[100] md:hidden flex items-end justify-between pointer-events-none gap-3"
                style={{ paddingBottom: 'var(--mobile-safe-area-bottom)' }}
            >
                {/* Nav bar — left side, pill-shaped. This is the flip origin:
                    it physically grows into the section panel, not the FAB. */}
                <motion.div
                    data-flip-from="mobile-nav-panel"
                    className={cn(
                        "relative isolate flex items-center gap-1 rounded-full pointer-events-auto novo-mobile-nav-shell",
                        isCompactPath ? "px-3 py-1.5" : "px-2 py-2"
                    )}
                    layout
                >
                    {/* One low-aberration lens for the rail. Active items get a
                        second, tighter lens below so the navigation still has a
                        clear focal state without stacking heavy filters on every
                        button. */}
                    <GlassSurface
                        aria-hidden
                        radius={9999}
                        depth={4}
                        blur={1}
                        strength={24}
                        chromaticAberration={2.5}
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
                                    data-testid="mobile-primary-target"
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
                                    whileTap={{ scale: 0.82 }}
                                    transition={springConfig.snappy}
                                    layout
                                >
                                    {active && (
                                        <motion.div
                                            layoutId="mobile-nav-pill"
                                            className="absolute inset-0"
                                            transition={springConfig.smooth}
                                        >
                                            <GlassSurface
                                                radius={9999}
                                                depth={6}
                                                blur={1}
                                                strength={28}
                                                chromaticAberration={3.5}
                                                backgroundColor="rgba(255,255,255,0.1)"
                                                elevation="low"
                                                className="h-full w-full"
                                            />
                                        </motion.div>
                                    )}
                                    <Icon
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
                </motion.div>

                {/* FAB — right side, opens/closes drawer. Stays in place the
                    whole time as a persistent trigger (rotates +/X); the
                    panel grows from the nav bar's rect, not this button's.
                    The base is the Settings-driven focus surface so the FAB
                    keeps real contrast over any wallpaper instead of the
                    near-invisible 7% white wash it shipped with. */}
                <motion.button
                    onClick={handleFabClick}
                    data-testid="mobile-primary-target"
                    aria-label={drawerOpen ? "Close menu" : "Open menu"}
                    className="relative isolate novo-mobile-nav-fab novo-focus-surface pointer-events-auto min-w-[44px] min-h-[44px] h-[52px] w-[52px] rounded-full flex items-center justify-center"
                    whileTap={{ scale: 0.85 }}
                    transition={springConfig.snappy}
                >
                    <GlassSurface
                        aria-hidden
                        radius={9999}
                        depth={4}
                        blur={1}
                        strength={24}
                        chromaticAberration={2.25}
                        backgroundColor="rgba(255,255,255,0.14)"
                        elevation="low"
                        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
                        style={{ position: 'absolute', inset: 0, zIndex: 0, borderRadius: 'inherit' }}
                    />
                    <motion.div
                        className="relative z-10"
                        animate={{ rotate: drawerOpen ? 45 : 0 }}
                        transition={springConfig.snappy}
                    >
                        <Plus className="h-5 w-5 text-foreground" strokeWidth={2.25} />
                    </motion.div>
                </motion.button>
            </nav>

            {/* Section Drawer — mounted only while open; unmounts in the
                close flight's onDone, not on click (see handleCloseDrawer) */}
            {drawerOpen && (
                <MobileSectionDrawer
                    onClose={handleCloseDrawer}
                    onOpenVoice={handleOpenVoice}
                />
            )}
        </>
    )
}
