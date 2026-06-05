'use client'

import React from 'react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet'
import { Routine } from '@/types/routine'
import { Project } from '@/types/project'
import { RoutineDetailView } from '@/components/routines/routine-detail-view'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

type ViewType = 'routine' | 'project' | 'task'

interface DashboardQuickViewProps {
    open: boolean
    onClose: () => void
    type: ViewType | null
    data: any | null
    onUpdate?: () => void
}

export function DashboardQuickView({ open, onClose, type, data, onUpdate }: DashboardQuickViewProps) {
    if (!type || !data) return null

    const renderContent = () => {
        switch (type) {
            case 'routine':
                return (
                    <div className="py-6">
                        <RoutineDetailView
                            routine={data as Routine}
                            onStartWorkout={() => {
                                alert('Starting workout from Quick View!')
                            }}
                        />
                    </div>
                )
            case 'project':
                return (
                    <div className="py-6 space-y-6">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-xl font-black tracking-tight uppercase italic text-primary">{data.title}</h3>
                            <p className="text-sm text-white/40">{data.status === 'in-progress' ? 'Running' : 'Paused'}</p>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Active Milestones</h4>
                            {((data.tasks || []).length > 0 ? data.tasks : [
                                { id: '1', title: 'System Architecture', status: 'completed' },
                                { id: '2', title: 'Beta Deployment', status: 'pending' }
                            ]).map((task: any) => (
                                <div key={task.id} className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-all group">
                                    <div className={cn(
                                        "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                                        task.status === 'completed' ? "bg-primary border-primary shadow-[0_0_10px_rgba(99,102,241,0.5)]" : "border-white/10 group-hover:border-primary/40"
                                    )}>
                                        {task.status === 'completed' && <div className="h-2 w-2 bg-white rounded-full" />}
                                    </div>
                                    <span className={cn("text-sm font-medium", task.status === 'completed' ? "text-white/40 line-through" : "text-white/80")}>
                                        {task.title}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            case 'task':
                return (
                    <div className="py-6 space-y-6">
                        <div className="p-6 rounded-[32px] bg-primary/10 border border-primary/20 space-y-2">
                            <h3 className="text-xl font-bold text-primary">{data.title || data.text}</h3>
                            <p className="text-sm text-white/60">Capture detail: System auto-generated task from flow.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-white/20 uppercase">Priority</span>
                                <span className="text-sm font-bold">High</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-white/20 uppercase">Deadline</span>
                                <span className="text-sm font-bold text-primary">Today</span>
                            </div>
                        </div>
                    </div>
                )
            default:
                return null
        }
    }

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full sm:max-w-xl bg-black/60 glass-blur border-l border-white/10 p-0 overflow-hidden outline-none">
                <ScrollArea className="h-full">
                    <div className="p-10">
                        <SheetHeader className="mb-10">
                            <SheetTitle className="text-4xl font-black tracking-tighter uppercase italic text-white/10">
                                Quick View
                            </SheetTitle>
                        </SheetHeader>
                        {renderContent()}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}
