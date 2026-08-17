'use client'

import React, { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    Calendar, BarChart3, Timer,
    ListChecks, CheckSquare, KanbanSquare, TrendingUp,
    BookOpen, Music,
    Settings, User, Search, Plug, Mic
} from 'lucide-react'

import { useDragToDismiss } from '@/hooks/use-drag-to-dismiss'
import { useTranslation } from '@/lib/i18n'
import { useMobileOverlay } from '@/components/mobile-overlay-provider'

interface MobileSectionDrawerProps {
    onClose: (options?: { historyAction?: 'back' | 'replace' | 'none' }) => void
    onOpenVoice?: () => void
}

export function MobileSectionDrawer({ onClose, onOpenVoice }: MobileSectionDrawerProps) {
    const router = useRouter()
    const pathname = usePathname()
    const { t } = useTranslation()
    const { setModalOpen } = useMobileOverlay()

    useEffect(() => {
        setModalOpen(true)
        return () => setModalOpen(false)
    }, [setModalOpen])
    const handleDismiss = () => onClose()
    const dragSurfaceRef = useDragToDismiss<HTMLDivElement>({ onDismiss: handleDismiss })

    // Primary navigation lives in MobileNav. This drawer is deliberately
    // secondary: workspace context first, then legacy/labs modules.
    const sections = [
        {
            title: t('sidebar.workspace'),
            items: [
                { title: t('sidebar.projects'), href: '/projects', icon: KanbanSquare },
                { title: t('sidebar.checklist'), href: '/checklist', icon: CheckSquare },
                { title: t('sidebar.calendar'), href: '/calendar', icon: Calendar },
                { title: t('sidebar.connectors'), href: '/connectors', icon: Plug },
            ],
        },
        {
            title: t('sidebar.more'),
            items: [
                { title: t('sidebar.analytics'), href: '/analytics', icon: BarChart3 },
                { title: t('sidebar.focus'), href: '/focus', icon: Timer },
                { title: t('sidebar.routines'), href: '/routines', icon: ListChecks },
                { title: t('sidebar.trackers'), href: '/trackers', icon: TrendingUp },
                { title: t('sidebar.library'), href: '/library', icon: BookOpen },
                { title: t('sidebar.music'), href: '/music', icon: Music },
            ],
        },
    ]

    const handleNavigate = (href: string) => {
        // Overlays own no history entries anymore, so navigating is just a
        // route push plus the visual close flight — nothing can race with
        // Next.js' own history management.
        router.push(href)
        onClose({ historyAction: 'none' })
    }

    return (
        <>
            {/* Backdrop — opacity driven by the same GSAP timeline as the panel */}
            <div
                data-flip-overlay="mobile-nav-panel"
                data-testid="workspace-backdrop"
                aria-hidden="true"
                className="modal-flip-overlay fixed inset-0 z-[5000] bg-black/60 md:hidden"
                onClick={handleDismiss}
            />

            {/* Same left-4/right-4/bottom-4 bounds as the nav bar's own
                wrapper (components/mobile-nav.tsx) — the panel should read as
                that exact bar having grown upward, not a differently-inset
                sheet that happens to start near it. */}
            <div
                ref={dragSurfaceRef}
                data-flip-to="mobile-nav-panel"
                data-mobile-overlay="navigation"
                role="dialog"
                aria-modal="true"
                aria-label="Workspace menu"
                className="modal-flip-target novo-focus-surface fixed left-4 right-4 z-[5001] pointer-events-auto rounded-[32px] overflow-hidden md:hidden"
                style={{
                    bottom: 'var(--mobile-navigation-bottom)',
                    // Primary navigation must stay legible over arbitrary dashboard
                    // content, not just a custom wallpaper. novo-focus-surface's
                    // opacity is Settings-driven (cardOpacity, default 15%) and only
                    // gets an auto-contrast floor when a wallpaper is set, so this
                    // sheet forces the real solid background instead of inheriting
                    // that decorative-card opacity.
                    backgroundColor: 'var(--background)',
                }}
            >
                    {/* Handle — drag down from here to dismiss with native physics */}
                    <div
                        aria-hidden="true"
                        className="flex justify-center pt-3.5 pb-3 pointer-events-none select-none"
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
                        <div className="grid grid-cols-2 gap-2.5 mt-3 pt-4 border-t border-foreground/[0.04]">
                            {onOpenVoice && (
                                <button
                                    onClick={onOpenVoice}
                                    className="min-h-[44px] flex items-center justify-center gap-2.5 h-[52px] rounded-2xl bg-foreground/[0.03] text-foreground/35 active:scale-95 transition-all hover:bg-foreground/[0.05]"
                                >
                                    <Mic className="h-[18px] w-[18px]" strokeWidth={1.4} />
                                    <span className="text-[11px] font-medium tracking-wide">Voz</span>
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    window.dispatchEvent(new CustomEvent('open-command-palette'))
                                    onClose({ historyAction: 'none' })
                                }}
                                className="min-h-[44px] flex items-center justify-center gap-2.5 h-[52px] rounded-2xl bg-foreground/[0.03] text-foreground/35 active:scale-95 transition-all hover:bg-foreground/[0.05]"
                            >
                                <Search className="h-[18px] w-[18px]" strokeWidth={1.4} />
                                <span className="text-[11px] font-medium tracking-wide">Buscar</span>
                            </button>
                            <button
                                onClick={() => handleNavigate('/settings')}
                                className="min-h-[44px] flex items-center justify-center gap-2.5 h-[52px] rounded-2xl bg-foreground/[0.03] text-foreground/35 active:scale-95 transition-all hover:bg-foreground/[0.05]"
                            >
                                <Settings className="h-[18px] w-[18px]" strokeWidth={1.4} />
                                <span className="text-[11px] font-medium tracking-wide">{t('sidebar.settings')}</span>
                            </button>
                            <button
                                onClick={() => handleNavigate('/profile')}
                                className="min-h-[44px] flex items-center justify-center gap-2.5 h-[52px] rounded-2xl bg-foreground/[0.03] text-foreground/35 active:scale-95 transition-all hover:bg-foreground/[0.05]"
                            >
                                <User className="h-[18px] w-[18px]" strokeWidth={1.4} />
                                <span className="text-[11px] font-medium tracking-wide">{t('sidebar.profile')}</span>
                            </button>
                        </div>
                    </div>
                </div>
        </>
    )
}
