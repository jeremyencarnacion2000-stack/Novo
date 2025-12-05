import { getAnalyticsData, calculateProductivityMetrics } from '@/lib/analytics-server'
import ClientAnalytics from './ClientAnalytics'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export interface DailyData {
  date: string
  totalTimeSpent: number
  tasksCompleted: number
  routinesCompleted: number
  habitsCompleted: number
  modulesUsed: string[]
}

export interface ProductivityMetrics {
  totalDays: number
  productiveDays: number
  productivityRate: number
  avgDailyTime: number
  totalCompletions: number
  peakHour: number
}

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const userId = session.user.id

  // Use server-side functions with direct Prisma queries
  const { dailyData } = await getAnalyticsData(userId, 30)
  const metrics = await calculateProductivityMetrics(userId, 30)

  // Format data for charts
  const formattedData: DailyData[] = dailyData.map((d: any) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    totalTimeSpent: Math.round(d.totalTimeSpent / 3600 * 10) / 10, // convert seconds to hours with 1 decimal
    tasksCompleted: d.tasksCompleted,
    routinesCompleted: d.routinesCompleted,
    habitsCompleted: d.habitsCompleted,
    modulesUsed: Array.isArray(d.modulesUsed) ? d.modulesUsed : [],
  }))

  return <ClientAnalytics dailyData={formattedData} metrics={metrics} />
}