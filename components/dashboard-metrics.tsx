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
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
            {metric.icon}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {typeof metric.value === 'number' || typeof metric.value === 'string' ? metric.value : '-'}
            </div>
            {metric.progress !== undefined && (
              <Progress value={metric.progress} className="mt-2 h-2" />
            )}
            {metric.change !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                {metric.change >= 0 ? '+' : ''}
                {metric.change}% from last week
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}