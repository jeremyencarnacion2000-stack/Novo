'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Flame, Trophy, TrendingUp, Calendar } from 'lucide-react'

interface RoutineStats {
    totalCompletions: number
    currentStreak: number
    completionRate: number
    period: number
}

export function RoutineStatsCard() {
    const [stats, setStats] = useState<RoutineStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch('/api/routines/completions?days=30')
                if (response.ok) {
                    const data = await response.json()
                    setStats(data.stats)
                }
            } catch (error) {
                console.error('Error fetching routine stats:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [])

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i} className="bg-card border-border">
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
            label: 'Current Streak',
            value: stats.currentStreak.toString(),
            subtext: stats.currentStreak === 1 ? 'day in a row' : 'days in a row',
            icon: Flame,
            accentColor: 'bg-orange-500',
        },
        {
            label: 'Total Completed',
            value: stats.totalCompletions.toString(),
            subtext: 'routines this month',
            icon: Trophy,
            accentColor: 'bg-amber-500',
        },
        {
            label: 'Completion Rate',
            value: `${stats.completionRate}%`,
            subtext: 'of scheduled routines',
            icon: TrendingUp,
            accentColor: 'bg-emerald-500',
        },
        {
            label: 'Tracking Period',
            value: stats.period.toString(),
            subtext: 'days of data',
            icon: Calendar,
            accentColor: 'bg-blue-500',
        },
    ]

    return (
        <div className="grid gap-4 md:grid-cols-4">
            {statCards.map((stat) => (
                <Card key={stat.label} className="bg-card border-border hover:border-border/80 transition-colors">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm text-muted-foreground">{stat.label}</span>
                            <stat.icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="space-y-3">
                            <span className="text-3xl font-semibold tracking-tight">{stat.value}</span>
                            <div className="space-y-1.5">
                                <div className={`h-1 w-full rounded-full ${stat.accentColor}`} />
                                <p className="text-xs text-muted-foreground">{stat.subtext}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

