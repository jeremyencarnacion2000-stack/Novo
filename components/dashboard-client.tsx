'use client'

import { DashboardShell } from '@/components/dashboard-shell'
import { DashboardMetrics } from '@/components/dashboard-metrics'
import { QuickActions } from '@/components/quick-actions'
import { RecentActivity } from '@/components/recent-activity'
import { DashboardHabits } from '@/components/dashboard-habits'
import { useSettings } from '@/lib/settings-context'
import { useEffect, useState } from 'react'

export default function DashboardClient() {
  const { settings } = useSettings()
  const [greeting, setGreeting] = useState('Welcome back')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) {
      setGreeting('Good morning')
    } else if (hour < 18) {
      setGreeting('Good afternoon')
    } else {
      setGreeting('Good evening')
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1)
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">
            {greeting}
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Here&apos;s what&apos;s happening with your productivity today
          </p>
        </div>

        <DashboardMetrics refreshKey={refreshKey} />

        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
          <div className="space-y-4 md:space-y-6">
            <QuickActions />
            <DashboardHabits />
          </div>
          <RecentActivity />
        </div>
      </div>
    </DashboardShell>
  )
}