'use client'

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { SettingsControlCenter } from './settings-control-center'
import { useSettings } from '@/lib/settings-context'
import { cn } from '@/lib/utils'
import { safeViewTransition } from '@/hooks/use-view-transition'

export function SettingsModal() {
    const { isSettingsOpen, setSettingsOpen } = useSettings()

    return (
        <Dialog 
            open={isSettingsOpen} 
            onOpenChange={(open) => {
                safeViewTransition(() => {
                    setSettingsOpen(open);
                });
            }}
        >
            <DialogContent 
                style={{ viewTransitionName: 'settings-window' } as React.CSSProperties}
                className={cn(
                "max-w-4xl md:max-w-5xl w-[94vw] md:w-full h-[85vh] p-0 shadow-2xl outline-none",
                "!flex flex-col overflow-hidden rounded-[32px] border border-white/10",
                "bg-black/40 backdrop-blur-2xl"
            )}>
                {/* Content Layer (Sharp) */}
                <div className="flex-1 w-full flex flex-col p-0 overflow-hidden relative bg-transparent h-full">
                    <DialogHeader className="p-6 pb-2 shrink-0 border-b border-white/5 relative z-20">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-2xl md:text-3xl font-black tracking-tighter uppercase italic text-white">
                                    Settings
                                </DialogTitle>
                                <DialogDescription className="text-white/60 mt-1 text-sm font-medium">
                                    Manage your preferences and customize your Novo experience
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Simple, robust overflow container */}
                    <div className="flex-1 w-full overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar pr-1 relative z-10">
                        <div className="p-6 pt-2 pb-10 space-y-6">
                            <SettingsControlCenter />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
