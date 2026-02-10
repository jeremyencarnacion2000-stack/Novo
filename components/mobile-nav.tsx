'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Calendar, Bot, Timer, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/ui/sidebar'

export function MobileNav() {
    const pathname = usePathname()
    const { toggleSidebar } = useSidebar()

    const navItems = [
        {
            title: 'Home',
            href: '/',
            icon: LayoutDashboard,
        },
        {
            title: 'Calendar',
            href: '/calendar',
            icon: Calendar,
        },
        {
            title: 'AI',
            href: '/ai',
            icon: Bot,
        },
        {
            title: 'Focus',
            href: '/focus',
            icon: Timer,
        },
    ]

    return (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 md:hidden w-auto max-w-[95vw]">
            <div className="glass-panel rounded-full px-8 py-4 flex items-center gap-8 shadow-2xl border border-white/10 bg-black/40 backdrop-blur-xl">
                {navItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "relative flex items-center justify-center transition-all duration-300",
                                isActive ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <item.icon className={cn("h-7 w-7", isActive && "fill-current/20")} />
                            {isActive && (
                                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                            )}
                        </Link>
                    )
                })}

                <div className="w-px h-8 bg-white/10" />

                <button
                    onClick={toggleSidebar}
                    className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                    <Menu className="h-7 w-7" />
                </button>
            </div>
        </div>
    )
}
