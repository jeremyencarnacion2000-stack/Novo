'use client'

import { DashboardShell } from '@/components/dashboard-shell'
import { DashboardMetrics } from '@/components/dashboard-metrics'
import { QuickActions } from '@/components/quick-actions'
import { RecentActivity } from '@/components/recent-activity'
import { DashboardHabits } from '@/components/dashboard-habits'
import { useSettings } from '@/lib/settings-context'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const { settings } = useSettings()
  const [greeting, setGreeting] = useState('Welcome back')
  const { data: session, status } = useSession()
  const router = useRouter()

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
    if (status !== 'loading' && !session) {
      router.push('/auth/signup')
    }
  }, [session, status, router])

  if (!session) return null

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">
            {greeting}
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Here's what's happening with your productivity today
          </p>
        </div>

        <DashboardMetrics />

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
