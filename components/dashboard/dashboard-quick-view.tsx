'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'framer-motion'
import { Routine } from '@/types/routine'
import { Project } from '@/types/project'
import { RoutineDetailView } from '@/components/routines/routine-detail-view'
import { ActiveWorkoutSession } from '@/components/routines/active-workout-session'
import { ContextualModal } from '@/components/ui/contextual-modal'
import { cn } from '@/lib/utils'

type ViewType = 'routine' | 'project' | 'task'

interface DashboardQuickViewProps {
    open: boolean
    onClose: () => void
    type: ViewType | null
    data: any | null
    anchorRect?: DOMRect | null
    onUpdate?: () => void
}

export function DashboardQuickView({ open, onClose, type, data, anchorRect }: DashboardQuickViewProps) {
    const [isWorkoutActive, setIsWorkoutActive] = useState(false)

    if (!type || !data) return null

    const workoutPortal = type === 'routine' && typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
            {isWorkoutActive && (
                <ActiveWorkoutSession
                    key="workout-session"
                    routine={data as Routine}
                    onComplete={() => { setIsWorkoutActive(false); onClose() }}
                    onCancel={() => setIsWorkoutActive(false)}
                />
            )}
        </AnimatePresence>,
        document.body
    ) : null

    const renderContent = () => {
        switch (type) {
            case 'routine':
                return (
                    <div className="py-6">
                        <RoutineDetailView
                            routine={data as Routine}
                            onStartWorkout={() => setIsWorkoutActive(true)}
                        />
                    </div>
                )
            case 'project':
                return (
                    <div className="py-6 space-y-6">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-xl font-black tracking-tight uppercase italic text-primary">{data.title}</h3>
                            <p className="text-sm text-foreground/40">{data.status === 'in-progress' ? 'Running' : 'Paused'}</p>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/20">Active Milestones</h4>
                            {(data.tasks || []).length === 0 && (
                                <p className="text-sm text-foreground/30">No tasks yet.</p>
                            )}
                            {(data.tasks || []).map((task: any) => (
                                <div key={task.id} className="flex items-center gap-3 p-4 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.05] hover:bg-foreground/[0.05] transition-all group">
                                    <div className={cn(
                                        "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                                        task.status === 'completed' ? "bg-primary border-primary shadow-[0_0_10px_rgba(99,102,241,0.5)]" : "border-foreground/10 group-hover:border-primary/40"
                                    )}>
                                        {task.status === 'completed' && <div className="h-2 w-2 bg-white rounded-full" />}
                                    </div>
                                    <span className={cn("text-sm font-medium", task.status === 'completed' ? "text-foreground/40 line-through" : "text-foreground/80")}>
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
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-foreground/5 border border-foreground/10 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-foreground/20 uppercase">Priority</span>
                                <span className="text-sm font-bold capitalize">{data.priority || 'Medium'}</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-foreground/5 border border-foreground/10 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-foreground/20 uppercase">Status</span>
                                <span className="text-sm font-bold text-primary">{data.completed ? 'Completed' : 'Open'}</span>
                            </div>
                        </div>
                    </div>
                )
            default:
                return null
        }
    }

    return (
        <>
            {workoutPortal}
            <ContextualModal open={open} onClose={onClose} anchorRect={anchorRect ?? null} title="Quick View">
                <div className="max-h-[min(70dvh,38rem)] overflow-y-auto pt-6">
                    {renderContent()}
                </div>
            </ContextualModal>
        </>
    )
}
