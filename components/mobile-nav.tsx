'use client'

import React, { useEffect, useState } from 'react'
import { House, Brain, MessageCircle, Activity, Plus } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { MobileSectionDrawer } from '@/components/mobile-section-drawer'
import { motion, LayoutGroup } from 'framer-motion'
import { springConfig } from '@/lib/design-tokens'
import { useModalFlip } from '@/hooks/use-modal-flip'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { useTranslation } from '@/lib/i18n'

export function MobileNav() {
    const router = useRouter()
    const pathname = usePathname()
    const { t } = useTranslation()
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [keyboardOpen, setKeyboardOpen] = useState(false)

    // A fixed navigation bar competes with the composer on short mobile
    // viewports. VisualViewport gives us the real keyboard state while an
    // editable control has focus; resize alone is not enough because browser
    // chrome can also change the viewport height.
    useEffect(() => {
        const viewport = window.visualViewport
        if (!viewport) return

        const updateKeyboardState = () => {
            const activeElement = document.activeElement
            const editing = activeElement instanceof HTMLInputElement ||
                activeElement instanceof HTMLTextAreaElement ||
                activeElement instanceof HTMLElement && activeElement.isContentEditable
            const keyboardObscuresViewport = window.innerHeight - viewport.height > 140
            setKeyboardOpen(editing && keyboardObscuresViewport)
        }

        const deferUpdate = () => window.setTimeout(updateKeyboardState, 0)
        viewport.addEventListener('resize', updateKeyboardState)
        viewport.addEventListener('scroll', updateKeyboardState)
        window.addEventListener('focusin', deferUpdate)
        window.addEventListener('focusout', deferUpdate)
        return () => {
            viewport.removeEventListener('resize', updateKeyboardState)
            viewport.removeEventListener('scroll', updateKeyboardState)
            window.removeEventListener('focusin', deferUpdate)
            window.removeEventListener('focusout', deferUpdate)
        }
    }, [])

    // Container-transform: the panel physically grows from the NAV BAR's own
    // rect/radius (matching the reference's shared-element demo) instead of
    // sliding up as a generic sheet — the "+" FAB is a separate persistent
    // trigger (it just rotates into an "X"), it is not itself the thing that
    // expands. `drawerOpen` stays true for the whole close flight — same
    // deferred-unmount pattern every other flip dialog in this app uses —
    // only flipping false in the flight's onDone.
    const closeDrawerFlip = useModalFlip('mobile-nav-panel', drawerOpen)
    const handleCloseDrawer = () => closeDrawerFlip(() => setDrawerOpen(false))
    const handleFabClick = () => {
        navigator.vibrate?.(10)
        if (drawerOpen) handleCloseDrawer()
        else setDrawerOpen(true)
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

    return (
        <>
            {/* Nav bar stays put — it used to auto-hide on scroll-down via
                useScrollDirection, but after heavy navigation the scroll-
                direction state would get stuck and leave the bar hidden
                off-screen (the reported "se buggea"). A persistent bar is
                simpler and never strands the user without navigation. */}
            <div className={cn(
                "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 z-[100] md:hidden flex items-end justify-between pointer-events-none gap-3 transition-[opacity,transform] duration-150",
                keyboardOpen && "pointer-events-none translate-y-24 opacity-0"
            )}>
                {/* Nav bar — left side, pill-shaped. This is the flip origin:
                    it physically grows into the section panel, not the FAB. */}
                <motion.div
                    data-flip-from="mobile-nav-panel"
                    className={cn(
                        "flex items-center gap-1 rounded-full border border-foreground/10 shadow-[0_8px_40px_rgba(0,0,0,0.55)] pointer-events-auto",
                        isCompactPath ? "px-3 py-1.5" : "px-2 py-2"
                    )}
                    style={{ background: 'color-mix(in srgb, var(--background) 90%, transparent)' }}
                    layout
                >
                    <LayoutGroup>
                        {navItems.map((item) => {
                            const Icon = item.icon
                            const active = isActive(item.path)

                            return (
                                <motion.button
                                    key={item.path}
                                    aria-label={item.label}
                                    aria-current={active ? 'page' : undefined}
                                    onClick={() => {
                                        navigator.vibrate?.(10)
                                        router.push(item.path)
                                    }}
                                    className={cn(
                                        "relative flex items-center justify-center rounded-full transition-colors min-w-[44px] h-[44px]",
                                        active ? "text-foreground" : "text-foreground/65",
                                        active && "px-4"
                                    )}
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
                                                strength={30}
                                                chromaticAberration={6}
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
                    panel grows from the nav bar's rect, not this button's. */}
                <motion.button
                    onClick={handleFabClick}
                    aria-label={drawerOpen ? "Close menu" : "Open menu"}
                    className="novo-context-glass pointer-events-auto h-[52px] w-[52px] rounded-full flex items-center justify-center"
                    whileTap={{ scale: 0.85 }}
                    transition={springConfig.snappy}
                >
                    <motion.div
                        animate={{ rotate: drawerOpen ? 45 : 0 }}
                        transition={springConfig.snappy}
                    >
                        <Plus className="h-5 w-5 text-foreground/60" strokeWidth={2} />
                    </motion.div>
                </motion.button>
            </div>

            {/* Section Drawer — mounted only while open; unmounts in the
                close flight's onDone, not on click (see handleCloseDrawer) */}
            {drawerOpen && <MobileSectionDrawer onClose={handleCloseDrawer} />}
        </>
    )
}
