'use client'

import { useEffect, useState } from 'react'
import { useRoutineStats } from '@/hooks/use-swr'
import { Card, CardContent } from '@/components/ui/card'
import { Flame, Trophy, TrendingUp, Calendar } from 'lucide-react'

interface RoutineStats {
    totalCompletions: number
    currentStreak: number
    completionRate: number
    period: number
}

export function RoutineStatsCard() {
    const { data: statsData, isLoading } = useRoutineStats()
    const stats = statsData?.stats


    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i} className="liquid-glass">
                        <CardContent className="p-5">
                            <div className="animate-pulse h-20 bg-muted rounded" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    if (!stats) {
        return null
    }

    const statCards = [
        {
            label: 'Consistency Momentum',
            value: `${stats.currentStreak}d`,
            subtext: stats.currentStreak === 1 ? 'active daily streak' : 'active daily streak',
            icon: Flame,
            accentColor: 'bg-orange-500',
        },
        {
            label: 'Execution Fidelity',
            value: `${stats.completionRate}%`,
            subtext: 'of scheduled routines',
            icon: TrendingUp,
            accentColor: 'bg-emerald-500',
        },
        {
            label: 'Total Completed',
            value: stats.totalCompletions.toString(),
            subtext: 'routines completed',
            icon: Trophy,
            accentColor: 'bg-amber-500',
        },
        {
            label: 'Momentum Signal',
            value: stats.completionRate >= 70 ? 'Building' : stats.completionRate >= 50 ? 'Stable' : 'Slipping',
            subtext: stats.completionRate >= 70 ? '↑ consistency is increasing' : stats.completionRate >= 50 ? '→ routines are holding steady' : '↓ focus is fragmented lately',
            icon: Calendar,
            accentColor: stats.completionRate >= 70 ? 'bg-indigo-500' : stats.completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500',
        },
    ]

    return (
        <div className="space-y-4">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                {statCards.map((stat) => (
                    <div
                        key={stat.label}
                        className="relative overflow-hidden rounded-2xl border border-foreground/[0.07] hover:border-foreground/[0.11] transition-all duration-400 p-5 cursor-default group"
                        style={{
                            background: 'rgba(255,255,255,0.015)',
                            backdropFilter: 'blur(12px)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black tracking-widest uppercase text-foreground/40 group-hover:text-foreground/60 transition-colors">{stat.label}</span>
                            <stat.icon className="h-4 w-4 text-foreground/40 group-hover:text-foreground/60 transition-colors" />
                        </div>
                        <div className="space-y-3">
                            <span className="text-3xl font-black tracking-tight text-foreground">{stat.value}</span>
                            <div className="space-y-1.5">
                                <div className={`h-1 w-full rounded-full ${stat.accentColor}`} />
                                <p className="text-[10px] text-foreground/30 font-medium">{stat.subtext}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Compression Row */}
            <div
                className="relative overflow-hidden rounded-2xl border border-foreground/[0.07] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                style={{
                    background: 'rgba(255,255,255,0.01)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
            >
                <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />
                    <span className="text-xs text-foreground/70">
                        {stats.completionRate >= 70
                            ? `Execution fidelity is high (${stats.completionRate}%). Your afternoon alignment shows optimal consistency momentum.`
                            : `Consistency momentum dropped — completion rate is at ${stats.completionRate}%. Afternoon slots present the primary gap.`
                        }
                    </span>
                </div>
                <button
                    onClick={() => {
                        const btn = document.querySelector('[data-slot="sidebar-menu-button"][href="/routines"]');
                        if (btn) (btn as HTMLButtonElement).click();
                    }}
                    className="text-[10px] font-black tracking-widest uppercase text-indigo-400 hover:text-indigo-300 transition-colors flex-shrink-0 cursor-pointer"
                >
                    Review Afternoon Routine →
                </button>
            </div>
        </div>
    )
}

