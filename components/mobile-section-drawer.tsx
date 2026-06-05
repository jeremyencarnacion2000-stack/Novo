'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard, Calendar, BarChart3, Bot, Timer,
    ListChecks, CheckSquare, KanbanSquare, TrendingUp,
    GraduationCap, Briefcase, BookOpen, Sparkles, Heart, Music,
    Settings, User
} from 'lucide-react'

interface MobileSectionDrawerProps {
    open: boolean
    onClose: () => void
}

const sections = [
    {
        title: 'Overview',
        items: [
            { title: 'Dashboard', href: '/', icon: LayoutDashboard },
            { title: 'Today', href: '/today', icon: Calendar },
            { title: 'Analytics', href: '/analytics', icon: BarChart3 },
            { title: 'Calendar', href: '/calendar', icon: Calendar },
            { title: 'AI', href: '/ai', icon: Bot },
            { title: 'Focus', href: '/focus', icon: Timer },
        ],
    },
    {
        title: 'Productivity',
        items: [
            { title: 'Routines', href: '/routines', icon: ListChecks },
            { title: 'Checklist', href: '/checklist', icon: CheckSquare },
            { title: 'Projects', href: '/projects', icon: KanbanSquare },
            { title: 'Trackers', href: '/trackers', icon: TrendingUp },
        ],
    },
    {
        title: 'Life & Growth',
        items: [
            { title: 'School', href: '/school', icon: GraduationCap },
            { title: 'Business', href: '/business', icon: Briefcase },
            { title: 'Library', href: '/library', icon: BookOpen },
            { title: 'Spiritual', href: '/spiritual', icon: Sparkles },
            { title: 'Style', href: '/appearance', icon: Heart },
            { title: 'Music', href: '/music', icon: Music },
        ],
    },
]

export function MobileSectionDrawer({ open, onClose }: MobileSectionDrawerProps) {
    const router = useRouter()
    const pathname = usePathname()

    const handleNavigate = (href: string) => {
        router.push(href)
        onClose()
    }

    if (!open) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Drawer — ultra-clean, premium glass feel */}
            <div className="fixed inset-x-0 bottom-0 z-[5001] md:hidden animate-in slide-in-from-bottom duration-300 ease-out">
                <div
                    className="mx-2 mb-2 rounded-[32px] border border-white/[0.06] shadow-[0_-16px_60px_rgba(0,0,0,0.6)] overflow-hidden glass-blur-xl"
                    style={{
                        background: 'rgba(10, 10, 12, 0.88)',
                    }}
                >
                    {/* Handle */}
                    <div className="flex justify-center pt-3 pb-2">
                        <div className="w-9 h-[3px] rounded-full bg-white/8" />
                    </div>

                    {/* Sections */}
                    <div className="px-5 pb-6 max-h-[65vh] overflow-y-auto scrollbar-hide">
                        {sections.map((section) => (
                            <div key={section.title} className="mb-5 last:mb-2">
                                <p className="text-[9px] font-semibold text-white/15 uppercase tracking-[0.3em] pl-1 mb-2.5">
                                    {section.title}
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    {section.items.map((item) => {
                                        const Icon = item.icon
                                        const active = pathname === item.href
                                        return (
                                            <button
                                                key={item.href}
                                                onClick={() => handleNavigate(item.href)}
                                                className={cn(
                                                    "flex flex-col items-center gap-2.5 py-4 px-2 rounded-[22px] transition-all duration-200 active:scale-95",
                                                    active
                                                        ? "bg-indigo-500/12 text-indigo-400 ring-1 ring-indigo-500/20"
                                                        : "bg-white/[0.02] text-white/35 hover:bg-white/[0.04] hover:text-white/50"
                                                )}
                                            >
                                                <div className={cn(
                                                    "h-10 w-10 rounded-2xl flex items-center justify-center transition-all",
                                                    active
                                                        ? "bg-indigo-500/15"
                                                        : "bg-white/[0.03]"
                                                )}>
                                                    <Icon className="h-[20px] w-[20px]" strokeWidth={active ? 1.8 : 1.4} />
                                                </div>
                                                <span className={cn(
                                                    "text-[10px] font-medium tracking-tight",
                                                    active ? "opacity-90" : "opacity-55"
                                                )}>
                                                    {item.title}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}

                        {/* Footer actions */}
                        <div className="flex gap-2.5 mt-3 pt-4 border-t border-white/[0.04]">
                            <button
                                onClick={() => handleNavigate('/settings')}
                                className="flex-1 flex items-center justify-center gap-2.5 h-[52px] rounded-2xl bg-white/[0.03] text-white/35 active:scale-95 transition-all hover:bg-white/[0.05]"
                            >
                                <Settings className="h-[18px] w-[18px]" strokeWidth={1.4} />
                                <span className="text-[11px] font-medium tracking-wide">Settings</span>
                            </button>
                            <button
                                onClick={() => handleNavigate('/profile')}
                                className="flex-1 flex items-center justify-center gap-2.5 h-[52px] rounded-2xl bg-white/[0.03] text-white/35 active:scale-95 transition-all hover:bg-white/[0.05]"
                            >
                                <User className="h-[18px] w-[18px]" strokeWidth={1.4} />
                                <span className="text-[11px] font-medium tracking-wide">Profile</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
