'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard, Calendar, BarChart3, Bot, Timer,
    ListChecks, CheckSquare, KanbanSquare, TrendingUp,
    GraduationCap, Briefcase, BookOpen, Sparkles, Heart, Music, Users,
    Settings, User, Search, Plug
} from 'lucide-react'

import { useDragToDismiss } from '@/hooks/use-drag-to-dismiss'

interface MobileSectionDrawerProps {
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
            { title: 'Conectores', href: '/connectors', icon: Plug },
        ],
    },
    {
        title: 'Life & Growth',
        items: [
            { title: 'School', href: '/school', icon: GraduationCap },
            { title: 'Business', href: '/business', icon: Briefcase },
            { title: 'Library', href: '/library', icon: BookOpen },
            { title: 'Spiritual', href: '/spiritual', icon: Sparkles },
            { title: 'Social', href: '/social', icon: Users },
            { title: 'Style', href: '/appearance', icon: Heart },
            { title: 'Music', href: '/music', icon: Music },
        ],
    },
]

export function MobileSectionDrawer({ onClose }: MobileSectionDrawerProps) {
    const router = useRouter()
    const pathname = usePathname()
    const dragHandleRef = useDragToDismiss<HTMLDivElement>({ onDismiss: onClose })

    const handleNavigate = (href: string) => {
        router.push(href)
        onClose()
    }

    return (
        <>
            {/* Backdrop — opacity driven by the same GSAP timeline as the panel */}
            <div
                data-flip-overlay="mobile-nav-panel"
                className="modal-flip-overlay fixed inset-0 z-[5000] bg-black/60 md:hidden"
                onClick={onClose}
            />

            {/* Same left-4/right-4/bottom-4 bounds as the nav bar's own
                wrapper (components/mobile-nav.tsx) — the panel should read as
                that exact bar having grown upward, not a differently-inset
                sheet that happens to start near it. */}
            <div
                data-flip-to="mobile-nav-panel"
                className="modal-flip-target liquid-glass-elevated fixed bottom-4 left-4 right-4 z-[5001] pointer-events-auto rounded-[32px] border border-foreground/[0.06] shadow-[0_-16px_60px_rgba(0,0,0,0.6)] overflow-hidden glass-blur-xl md:hidden"
                style={{
                    background: 'color-mix(in srgb, var(--background) 92%, transparent)',
                }}
            >
                    {/* Handle — drag down from here to dismiss with native physics */}
                    <div
                        ref={dragHandleRef}
                        className="flex justify-center pt-3.5 pb-3 cursor-grab active:cursor-grabbing touch-none select-none"
                    >
                        <div className="w-9 h-[4px] rounded-full bg-foreground/15 hover:bg-foreground/30 transition-colors" />
                    </div>

                    {/* Sections */}
                    <div
                        data-modal-content
                        className="px-5 pb-6 max-h-[65dvh] overflow-y-auto scrollbar-hide"
                    >
                        {sections.map((section) => (
                            <div key={section.title} className="mb-5 last:mb-2">
                                <p className="text-[9px] font-semibold text-foreground/15 uppercase tracking-[0.3em] pl-1 mb-2.5">
                                    {section.title}
                                </p>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
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
                                                        ? "bg-primary/12 text-primary ring-1 ring-primary/20"
                                                        : "bg-foreground/[0.02] text-foreground/35 hover:bg-foreground/[0.04] hover:text-foreground/50"
                                                )}
                                            >
                                                <div className={cn(
                                                    "h-10 w-10 rounded-2xl flex items-center justify-center transition-all",
                                                    active
                                                        ? "bg-primary/15"
                                                        : "bg-foreground/[0.03]"
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
                        <div className="flex gap-2.5 mt-3 pt-4 border-t border-foreground/[0.04]">
                            <button
                                onClick={() => {
                                    window.dispatchEvent(new CustomEvent('open-command-palette'))
                                    onClose()
                                }}
                                className="flex-1 flex items-center justify-center gap-2.5 h-[52px] rounded-2xl bg-foreground/[0.03] text-foreground/35 active:scale-95 transition-all hover:bg-foreground/[0.05]"
                            >
                                <Search className="h-[18px] w-[18px]" strokeWidth={1.4} />
                                <span className="text-[11px] font-medium tracking-wide">Buscar</span>
                            </button>
                            <button
                                onClick={() => handleNavigate('/settings')}
                                className="flex-1 flex items-center justify-center gap-2.5 h-[52px] rounded-2xl bg-foreground/[0.03] text-foreground/35 active:scale-95 transition-all hover:bg-foreground/[0.05]"
                            >
                                <Settings className="h-[18px] w-[18px]" strokeWidth={1.4} />
                                <span className="text-[11px] font-medium tracking-wide">Settings</span>
                            </button>
                            <button
                                onClick={() => handleNavigate('/profile')}
                                className="flex-1 flex items-center justify-center gap-2.5 h-[52px] rounded-2xl bg-foreground/[0.03] text-foreground/35 active:scale-95 transition-all hover:bg-foreground/[0.05]"
                            >
                                <User className="h-[18px] w-[18px]" strokeWidth={1.4} />
                                <span className="text-[11px] font-medium tracking-wide">Profile</span>
                            </button>
                        </div>
                    </div>
                </div>
        </>
    )
}
