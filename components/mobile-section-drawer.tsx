'use client'

import React, { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    Calendar, BarChart3, Timer, X,
    ListChecks, CheckSquare, KanbanSquare, TrendingUp,
    BookOpen, Music,
    Settings, User, Search, Plug, Mic,
    House, Brain, MessageCircle, Activity, Sparkles,
    type LucideIcon,
} from 'lucide-react'

import { useTranslation } from '@/lib/i18n'
import { useMobileOverlay } from '@/components/mobile-overlay-provider'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { NavigationIndicator } from '@/components/ui/navigation-indicator'
import { rememberNavigationOrigin } from '@/lib/navigation-origin'

interface MobileSectionDrawerProps {
    open?: boolean
    onClose: (options?: { historyAction?: 'back' | 'replace' | 'none' }) => void
    onOpenVoice?: () => void
    onOpenSearch?: () => void
    onExitComplete?: () => void
    anchorRef?: React.RefObject<HTMLElement | null>
}

export function MobileSectionDrawer({ open = true, onClose, onOpenVoice, onOpenSearch, onExitComplete, anchorRef }: MobileSectionDrawerProps) {
    const router = useRouter()
    const pathname = usePathname()
    const { t } = useTranslation()
    const { setModalOpen } = useMobileOverlay()

    useEffect(() => {
        setModalOpen(open)
        return () => setModalOpen(false)
    }, [open, setModalOpen])

    // The drawer replaces the rail during the morph, so the same primary
    // destinations must remain reachable from the expanded surface.
    const sections: Array<{
        title: string
        items: Array<{ title: string; href: string; icon: LucideIcon; sharedId?: string }>
    }> = [
        {
            title: t('sidebar.overview'),
            items: [
                { title: t('sidebar.dashboard'), href: '/', icon: House, sharedId: 'mobile-nav-item-dashboard' },
                { title: t('sidebar.cognitive_engine'), href: '/cognitive', icon: Brain, sharedId: 'mobile-nav-item-cognitive' },
                { title: t('sidebar.chat'), href: '/chat', icon: MessageCircle, sharedId: 'mobile-nav-item-chat' },
                { title: t('sidebar.companion'), href: '/companion', icon: Sparkles },
                { title: t('sidebar.activity'), href: '/activity', icon: Activity, sharedId: 'mobile-nav-item-activity' },
            ],
        },
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
        <Dialog open={open} onExitComplete={onExitComplete} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
            <DialogContent
                anchorRef={anchorRef}
                motionPreset="shared"
                motionId="mobile-nav-panel"
                overlayClassName="md:hidden"
                overlayProps={{
                    'data-testid': 'workspace-backdrop',
                    // The navigation is a lightweight, contextual expansion —
                    // it should keep the current screen present, not turn into
                    // a page-blocking modal.
                    className: '!bg-transparent !backdrop-blur-none md:hidden',
                    // Update the external state at the gesture, not after the
                    // deferred portal exit. The shared controller then keeps
                    // the dialog mounted while the same liquid spring returns.
                    onPointerDown: () => onClose(),
                }}
                showCloseButton={false}
                data-mobile-overlay="navigation"
                data-liquid-morph-panel="true"
                aria-label="Workspace menu"
                onEscapeKeyDown={() => onClose()}
                onPointerDownOutside={() => onClose()}
                className="!fixed !left-4 !right-4 !top-auto !w-auto !max-w-none !max-h-[14rem] !translate-x-0 !translate-y-0 !rounded-[28px] !border-0 !bg-transparent novo-mobile-nav-panel novo-mobile-nav-panel--compact !overflow-visible p-0 !shadow-none md:hidden"
                // Dialog portals render outside MobileOverlayProvider, so the
                // provider-scoped --mobile-navigation-bottom token cannot be
                // used here. Keep this surface on the exact physical baseline
                // of the rail and FAB with a self-contained safe-area value.
                style={{ '--novo-mobile-nav-panel-bottom': 'calc(1rem + env(safe-area-inset-bottom))' } as React.CSSProperties}
                >
                    <DialogTitle className="sr-only">Workspace menu</DialogTitle>
                    <div data-liquid-panel-material aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[28px]">
                    <GlassSurface
                        aria-hidden
                        data-testid="workspace-panel-glass-surface"
                        preset="navigation"
                        refractive
                        refractivePriority="interactive"
                        refractiveActive
                        webComponent
                        // Preserve the rail's visible lens and a shallow tint.
                        // Label treatment supplies contrast without a solid plate.
                        navigationMaterial="panel"
                        depth={8}
                        strength={60}
                        chromaticAberration={1.6}
                        blur={3}
                        elevation="low"
                        className="pointer-events-none absolute inset-0 z-0 h-full w-full rounded-[32px]"
                        style={{ position: 'absolute', inset: 0, zIndex: 0, borderRadius: 'inherit' }}
                    />
                    </div>
                    <DialogClose
                        aria-label="Close menu"
                        onClick={() => onClose()}
                        className="novo-nav-glass-control absolute right-1 top-1 z-20 flex size-11 items-center justify-center rounded-full text-foreground/55 transition-colors hover:bg-foreground/[0.07] hover:text-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-95"
                    >
                        <X data-shared-item="mobile-nav-close" className="size-4" strokeWidth={1.8} />
                    </DialogClose>
                    {/* Handle — drag down from here to dismiss with native physics */}
                    <div
                        aria-hidden="true"
                        data-liquid-panel-handle
                        className="relative z-10 flex justify-center pt-2.5 pb-1.5 pointer-events-none select-none"
                    >
                        <div className="w-9 h-[4px] rounded-full bg-foreground/15 hover:bg-foreground/30 transition-colors" />
                    </div>

                    {/* Sections */}
                    <div
                        data-modal-content
                        className="relative z-10 max-h-[calc(14rem-1.5rem)] overflow-y-auto px-3 pb-3 scrollbar-hide"
                    >
                        {sections.map((section) => (
                            <div key={section.title} className="mb-3 last:mb-1">
                                <p className="novo-nav-label mb-1 pl-1 text-[10px] font-medium tracking-wide">
                                    {section.title}
                                </p>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {section.items.map((item) => {
                                        const Icon = item.icon
                                        const currentPath = pathname ?? ''
                                        const active = item.href === '/'
                                            ? currentPath === '/'
                                            : currentPath === item.href || currentPath.startsWith(item.href + '/')
                                        return (
                                            <button
                                                key={item.href}
                                                onClick={(event) => { rememberNavigationOrigin(event.currentTarget, item.href); handleNavigate(item.href) }}
                                                className={cn(
                                                    "novo-nav-glass-control relative flex min-h-[54px] flex-col items-center gap-1 rounded-[16px] px-1 py-2 transition-all duration-200 active:scale-95",
                                                    active
                                                        ? "novo-nav-label-active"
                                                        : "novo-nav-label"
                                                )}
                                                data-active={active}
                                                aria-current={active ? 'page' : undefined}
                                            >
                                                {active && <NavigationIndicator />}
                                                <div className={cn(
                                                    "relative flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                                                    active
                                                        ? "bg-primary/15"
                                                        : "bg-foreground/[0.03]"
                                                )}>
                                                    <Icon
                                                        data-shared-item={item.sharedId}
                                                        className="relative z-10 h-4 w-4"
                                                        strokeWidth={active ? 1.8 : 1.4}
                                                    />
                                                </div>
                                                <span className={cn(
                                                    "relative z-10 text-[11px] font-medium tracking-tight"
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
                        <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-foreground/[0.06] pt-2">
                            {onOpenVoice && (
                                <button
                                    onClick={onOpenVoice}
                                    className="novo-nav-glass-control relative flex h-10 min-h-[40px] items-center justify-center gap-2 rounded-xl bg-foreground/[0.03] text-foreground/45 transition-all hover:bg-foreground/[0.05] active:scale-95"
                                >
                                    <Mic className="h-[18px] w-[18px]" strokeWidth={1.4} />
                                    <span className="text-[11px] font-medium tracking-wide">Voz</span>
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (onOpenSearch) { onOpenSearch(); return }
                                    window.dispatchEvent(new CustomEvent('open-command-palette'))
                                    onClose({ historyAction: 'none' })
                                }}
                                    className="novo-nav-glass-control relative flex h-10 min-h-[40px] items-center justify-center gap-2 rounded-xl bg-foreground/[0.03] text-foreground/45 transition-all hover:bg-foreground/[0.05] active:scale-95"
                            >
                                <Search className="h-[18px] w-[18px]" strokeWidth={1.4} />
                                <span className="text-[11px] font-medium tracking-wide">Buscar</span>
                            </button>
                            <button
                                onClick={() => handleNavigate('/settings')}
                                    className="novo-nav-glass-control relative flex h-10 min-h-[40px] items-center justify-center gap-2 rounded-xl bg-foreground/[0.03] text-foreground/45 transition-all hover:bg-foreground/[0.05] active:scale-95"
                            >
                                <Settings className="h-[18px] w-[18px]" strokeWidth={1.4} />
                                <span className="text-[11px] font-medium tracking-wide">{t('sidebar.settings')}</span>
                            </button>
                            <button
                                onClick={() => handleNavigate('/profile')}
                                    className="novo-nav-glass-control relative flex h-10 min-h-[40px] items-center justify-center gap-2 rounded-xl bg-foreground/[0.03] text-foreground/45 transition-all hover:bg-foreground/[0.05] active:scale-95"
                            >
                                <User className="h-[18px] w-[18px]" strokeWidth={1.4} />
                                <span className="text-[11px] font-medium tracking-wide">{t('sidebar.profile')}</span>
                            </button>
                        </div>
                    </div>
            </DialogContent>
        </Dialog>
    )
}
