'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface DailyData {
    date: string
    productivityScore: number
}

interface ProductivityHeatmapProps {
    data: DailyData[]
}

export function ProductivityHeatmap({ data }: ProductivityHeatmapProps) {
    // Generate last 90 days
    const heatmapData = useMemo(() => {
        const days = []
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        for (let i = 89; i >= 0; i--) {
            const date = new Date(today)
            date.setDate(today.getDate() - i)
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

            // Find data for this date
            const dayData = data.find(d => d.date === dateStr)
            days.push({
                date: dateStr,
                fullDate: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                score: dayData ? dayData.productivityScore : 0
            })
        }
        return days
    }, [data])

    const getColor = (score: number) => {
        if (score === 0) return 'bg-white/5'
        if (score < 25) return 'bg-emerald-500/20'
        if (score < 50) return 'bg-emerald-500/40'
        if (score < 75) return 'bg-emerald-500/70'
        return 'bg-emerald-500'
    }

    return (
        <div className="w-full card--primary p-6 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold tracking-tight">Productivity Heatmap</h3>
                    <p className="text-sm text-muted-foreground">Activity over the last 90 days</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    <span>Less</span>
                    <div className="flex gap-1">
                        <div className="w-3 h-3 rounded-sm bg-white/5" />
                        <div className="w-3 h-3 rounded-sm bg-emerald-500/20" />
                        <div className="w-3 h-3 rounded-sm bg-emerald-500/40" />
                        <div className="w-3 h-3 rounded-sm bg-emerald-500/70" />
                        <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                    </div>
                    <span>More</span>
                </div>
            </div>

            <TooltipProvider>
                <div className="grid grid-flow-col grid-rows-7 gap-1.5 overflow-x-auto pb-2 no-scrollbar">
                    {heatmapData.map((day, i) => (
                        <Tooltip key={i}>
                            <TooltipTrigger asChild>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.002 }}
                                    className={cn(
                                        "w-3 h-3 sm:w-4 sm:h-4 rounded-sm transition-all duration-300 hover:ring-2 hover:ring-white/30 cursor-pointer",
                                        getColor(day.score)
                                    )}
                                />
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900/90 backdrop-blur-xl border-white/10 text-white p-2">
                                <p className="text-xs font-bold">{day.score}% Productivity</p>
                                <p className="text-[10px] text-white/60">{day.fullDate}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </div>
            </TooltipProvider>

            <div className="flex justify-between mt-4 text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                <span>90 Days Ago</span>
                <span>Today</span>
            </div>
        </div>
    )
}
