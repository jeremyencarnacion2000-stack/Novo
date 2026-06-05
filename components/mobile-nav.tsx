'use client'

import React, { useState } from 'react'
import { LayoutDashboard, BarChart3, Plus, Bot, Grid2x2 } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useQuickCapture } from '@/lib/quick-capture-context'
import { MobileSectionDrawer } from '@/components/mobile-section-drawer'

export function MobileNav() {
    const router = useRouter()
    const pathname = usePathname()
    const { onOpen } = useQuickCapture()
    const [drawerOpen, setDrawerOpen] = useState(false)

    const isActive = (path: string) => pathname === path

    const navItems = [
        { icon: LayoutDashboard, path: '/', label: 'Home' },
        { icon: BarChart3, path: '/analytics', label: 'Stats' },
        { icon: null, path: '', label: 'Add' },
        { icon: Bot, path: '/ai', label: 'AI' },
        { icon: Grid2x2, path: '__menu__', label: 'Menu' },
    ]

    const isCompactPath = pathname === '/ai' || pathname === '/music' || pathname.startsWith('/music/') || pathname === '/cognitive'
    const compact = isCompactPath

    return (
        <>
            {/* Ultra-minimal floating capsule nav */}
            <div className={cn(
                "fixed bottom-5 left-5 right-5 z-[100] md:hidden flex justify-center pointer-events-none transition-transform duration-500 ease-out",
                compact && "translate-y-2"
            )}>
                <div
                    className={cn(
                        "w-full max-w-md flex items-center justify-evenly transition-all duration-500 ease-out rounded-[28px] border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.55)] pointer-events-auto glass-blur-xl",
                        compact ? "px-6 py-1.5 rounded-[32px] max-w-[280px]" : "px-3 py-2.5"
                    )}
                    style={{
                        background: 'rgba(8, 8, 10, 0.85)',
                    }}
                >
                    {navItems.map((item) => {
                        // FAB — centered, elevated
                        if (item.icon === null) {
                            if (compact) return null // Hide FAB in compact mode for maximum space

                            return (
                                <button
                                    key="fab"
                                    onClick={onOpen}
                                    className="h-12 w-12 -my-4 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-[0_4px_24px_rgba(99,102,241,0.4)] active:scale-90 transition-all duration-200 ring-[3px] ring-black/40"
                                >
                                    <Plus className="h-5 w-5 text-white" strokeWidth={2.2} />
                                </button>
                            )
                        }

                        const Icon = item.icon
                        const isMenu = item.path === '__menu__'
                        const active = !isMenu && isActive(item.path)

                        return (
                            <button
                                key={item.path}
                                onClick={() => {
                                    if (isMenu) {
                                        setDrawerOpen(true)
                                    } else {
                                        router.push(item.path)
                                    }
                                }}
                                className={cn(
                                    "flex flex-col items-center gap-1 transition-all duration-300 active:scale-90 relative",
                                    compact ? "py-2 px-4" : "py-1.5 px-3 rounded-2xl",
                                    active
                                        ? "text-white"
                                        : isMenu && drawerOpen
                                            ? "text-white/50"
                                            : "text-white/25 hover:text-white/40"
                                )}
                            >
                                <Icon 
                                    className={cn(
                                        "transition-all duration-300",
                                        compact ? "h-[20px] w-[20px]" : "h-[22px] w-[22px]"
                                    )} 
                                    strokeWidth={active ? 2 : 1.6} 
                                />
                                {!compact && (
                                    <span className={cn(
                                        "text-[9px] font-medium tracking-wide transition-all duration-300",
                                        active ? "opacity-100" : "opacity-50"
                                    )}>
                                        {item.label}
                                    </span>
                                )}
                                {/* Active indicator dot */}
                                {active && (
                                    <div className={cn(
                                        "absolute w-1 h-1 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.6)] transition-all duration-300",
                                        compact ? "-bottom-1" : "-bottom-0.5"
                                    )} />
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Section Drawer */}
            <MobileSectionDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
            />
        </>
    )
}
