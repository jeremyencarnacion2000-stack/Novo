'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useAnalytics } from '@/hooks/use-swr'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'
import { HiOutlineClipboardDocumentCheck, HiOutlineClock, HiOutlineFire, HiOutlineTrophy } from 'react-icons/hi2'
import { motion } from 'framer-motion'
import { springConfig } from '@/lib/design-tokens'
import { useTranslation } from '@/lib/i18n'

interface DashboardMetricsProps {
  refreshKey: number
  /** Slim single-row strip instead of the full card grid — used once the
   * "Ahora →" hero owns the primary spotlight on the Today dashboard. */
  compact?: boolean
}

export const DashboardMetrics = React.memo(
  function DashboardMetrics({ refreshKey, compact }: DashboardMetricsProps) {
  const { data, error, isLoading } = useAnalytics()
  const { t } = useTranslation()

  const metrics = [
    {
      title: t('dashboard.tasksCompleted'),
      value: data?.tasksCompleted,
      progress: data?.taskCompletionRate,
      icon: <HiOutlineClipboardDocumentCheck className="h-6 w-6 text-emerald-400 group-hover:scale-110 transition-transform duration-500" />,
      change: data?.taskTrend,
    },
    {
      title: t('dashboard.focusTime'),
      value: data?.focusTime,
      icon: <HiOutlineClock className="h-6 w-6 text-blue-400 group-hover:rotate-12 group-hover:scale-110 transition-all duration-500" />,
      change: data?.focusTrend,
    },
    {
      title: t('dashboard.habitsMastered'),
      value: data?.habitsMastered,
      progress: data?.habitCompletionRate,
      icon: <HiOutlineFire className="h-6 w-6 text-orange-400 group-hover:scale-125 transition-transform duration-700 ease-out" />,
      change: data?.habitTrend,
    },
    {
      title: t('dashboard.goalsAchieved'),
      value: data?.goalsAchieved,
      progress: data?.goalCompletionRate,
      icon: <HiOutlineTrophy className="h-6 w-6 text-amber-400 group-hover:scale-110 group-hover:brightness-110 transition-all duration-500" />,
      change: data?.goalTrend,
    },
  ]

  if (compact) {
    if (isLoading) {
      return <div className="h-14 rounded-2xl bg-foreground/[0.03] animate-pulse" />
    }
    if (error) {
      return null
    }
    return (
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-1">
        {metrics.map((metric) => (
          <div key={metric.title} className="flex items-center gap-2.5">
            <div className="text-muted-foreground/70 [&>svg]:h-4 [&>svg]:w-4">{metric.icon}</div>
            <span className="text-lg font-semibold tabular-nums">{metric.value ?? '-'}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">{metric.title}</span>
          </div>
        ))}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-1/2 mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-muted-foreground">Could not load metrics.</p>
  }

  return (
    <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => {
        // Semantic color logic
        let borderColor = 'border-border';
        let trendColor = 'text-muted-foreground';

        if (metric.change !== undefined) {
          if (metric.change > 0) {
            borderColor = 'hover:border-green-500/50';
            trendColor = 'text-green-500';
          } else if (metric.change < 0) {
            borderColor = 'hover:border-red-500/50';
            trendColor = 'text-red-500';
          } else {
            borderColor = 'hover:border-yellow-500/50';
            trendColor = 'text-yellow-500';
          }
        }

        // Hierarchy Logic: First card is Hero
        const isHero = index === 0;
        const cardClass = isHero ? 'card--hero' : 'card--primary';

        // Specific polish for 'Focus Time' card
        const isFocusCard = metric.title === 'Focus Time' || metric.title === 'Tiempo de Enfoque';

        return (
          <motion.div
            key={metric.title}
            className="flex flex-col h-full"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={springConfig.snappy}
          >
            <Card
              className={cn(
                "relative transition-[box-shadow,border-color,opacity] duration-300",
                "hover:shadow-m",
                "group border-foreground/5",
                cardClass,
                isFocusCard && "bloom-soft border-indigo-500/30",
                borderColor
              )}
            >
              {/* Glossy Overlay Reflection */}
              <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors duration-300">
                  {metric.title}
                </CardTitle>
                <div className={cn(
                  "p-2.5 rounded-2xl transition-all duration-300",
                  isHero ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground group-hover:bg-foreground/10 group-hover:text-foreground"
                )}>
                  {metric.icon}
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="flex items-baseline gap-1.5">
                  <div className={cn(
                    "text-4xl md:text-5xl tracking-tight transition-transform duration-300 group-hover:scale-105 origin-left tabular-nums",
                    isHero ? "text-primary" : "text-foreground"
                  )}>
                    {typeof metric.value === 'number' || typeof metric.value === 'string'
                      ? String(metric.value)
                        .split(/(\d+)/)
                        .filter(Boolean)
                        .map((part, i) =>
                          /^\d+$/.test(part) ? (
                            <span key={i} className="font-extrabold">{part}</span>
                          ) : (
                            <span key={i} className="font-medium text-[0.6em] opacity-70">{part}</span>
                          )
                        )
                      : '-'}
                  </div>
                </div>

                {metric.progress !== undefined && (
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                      <span>Performance</span>
                      <span>{metric.progress}%</span>
                    </div>
                    <Progress value={metric.progress} className="h-1.5 bg-foreground/5" />
                  </div>
                )}

                {metric.change !== undefined && (
                  <div className={cn(
                    "text-[11px] mt-4 font-bold flex items-center gap-1.5 py-1 px-2 rounded-lg w-fit transition-colors",
                    metric.change >= 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400",
                    !metric.change && "bg-yellow-500/10 text-yellow-500"
                  )}>
                    {metric.change >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5 rotate-180" />}
                    <span>
                      {metric.change >= 0 ? '+' : ''}{metric.change}%
                      <span className="opacity-50 ml-1 font-medium">vs last week</span>
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  )
},
// Only re-render when the parent explicitly increments refreshKey
(prev, next) => prev.refreshKey === next.refreshKey
)
