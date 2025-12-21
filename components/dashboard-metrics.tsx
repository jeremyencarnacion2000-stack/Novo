'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, Zap, Target, TrendingUp, Clock } from 'lucide-react'
import { useAnalytics } from '@/hooks/use-swr'
import { Skeleton } from '@/components/ui/skeleton'

interface DashboardMetricsProps {
  refreshKey: number
}

export function DashboardMetrics({ refreshKey }: DashboardMetricsProps) {
  const { data, error, isLoading } = useAnalytics()

  const metrics = [
    {
      title: 'Tasks Completed',
      value: data?.tasksCompleted,
      progress: data?.taskCompletionRate,
      icon: <CheckCircle className="h-6 w-6 text-green-500" />,
      change: data?.taskTrend,
    },
    {
      title: 'Focus Time',
      value: data?.focusTime,
      icon: <Clock className="h-6 w-6 text-blue-500" />,
      change: data?.focusTrend,
    },
    {
      title: 'Habits Mastered',
      value: data?.habitsMastered,
      progress: data?.habitCompletionRate,
      icon: <Zap className="h-6 w-6 text-yellow-500" />,
      change: data?.habitTrend,
    },
    {
      title: 'Goals Achieved',
      value: data?.goalsAchieved,
      progress: data?.goalCompletionRate,
      icon: <Target className="h-6 w-6 text-red-500" />,
      change: data?.goalTrend,
    },
  ]

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

        return (
          <Card
            key={metric.title}
            className={`transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${borderColor} group ${cardClass} ${metric.title === 'Focus Time' ? 'animate-pulse-slow shadow-glow-sm border-indigo-500/20' : ''}`}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {metric.title}
              </CardTitle>
              <div className="p-2 rounded-full bg-secondary/50 group-hover:bg-secondary transition-colors">
                {metric.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {typeof metric.value === 'number' || typeof metric.value === 'string' ? metric.value : '-'}
              </div>
              {metric.progress !== undefined && (
                <Progress value={metric.progress} className="mt-2 h-1.5" />
              )}
              {metric.change !== undefined && (
                <p className={`text-xs mt-2 font-medium flex items-center gap-1 ${trendColor}`}>
                  {metric.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                  {metric.change >= 0 ? '+' : ''}
                  {metric.change}% from last week
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  )
}