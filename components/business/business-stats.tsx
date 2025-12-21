'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, Users, TrendingUp, Target, Percent, Award, CheckCircle2, Clock, Zap } from 'lucide-react'

interface BusinessStats {
    totalClients: number
    activeClients: number
    prospects: number
    totalDeals: number
    openDeals: number
    wonDeals: number
    totalRevenue: number
    totalPipelineValue: number
    weightedPipeline: number
    conversionRate: number
    avgDealSize: number
}

export function BusinessStats() {
    const [stats, setStats] = useState<BusinessStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch('/api/business/analytics')
                if (response.ok) {
                    const data = await response.json()
                    setStats(data.summary)
                }
            } catch (error) {
                console.error('Error fetching business stats:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [])

    const formatCurrency = (value: number) => {
        if (value >= 1000) {
            return `$${(value / 1000).toFixed(1)}k`
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    if (loading) {
        return (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
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

    if (!stats) return null

    const statCards = [
        {
            label: 'Total Revenue',
            value: formatCurrency(stats.totalRevenue),
            subtext: '+0% from last month',
            icon: CheckCircle2,
            accentColor: 'bg-emerald-500',
        },
        {
            label: 'Pipeline Value',
            value: formatCurrency(stats.totalPipelineValue),
            subtext: '+0% from last month',
            icon: Clock,
            accentColor: 'bg-blue-500',
        },
        {
            label: 'Conversion Rate',
            value: `${stats.conversionRate.toFixed(0)}%`,
            subtext: '+0% from last month',
            icon: Zap,
            accentColor: 'bg-amber-500',
        },
        {
            label: 'Active Clients',
            value: stats.activeClients.toString(),
            subtext: '+0% from last month',
            icon: Target,
            accentColor: 'bg-rose-500',
        },
    ]

    return (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
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

