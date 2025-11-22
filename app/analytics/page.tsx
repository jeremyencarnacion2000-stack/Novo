import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getAnalyticsData, calculateProductivityMetrics } from '@/lib/analytics'
import ClientAnalytics from './ClientAnalytics'

interface DailyData {
  date: string
  totalTimeSpent: number
  tasksCompleted: number
  routinesCompleted: number
  habitsCompleted: number
  modulesUsed: string[]
}

interface ProductivityMetrics {
  totalDays: number
  productiveDays: number
  productivityRate: number
  avgDailyTime: number
  totalCompletions: number
  peakHour: number
}

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    // Handle unauthenticated user, perhaps redirect
    return <div>Please log in to view analytics.</div>
  }

  const { dailyData: data } = await getAnalyticsData(session.user.id, 30)
  const metrics = await calculateProductivityMetrics(session.user.id, 30)

  // Format data for charts
  const formattedData: DailyData[] = data.map((d: any) => ({
    date: new Date(d.date).toLocaleDateString(),
    totalTimeSpent: Math.round(d.totalTimeSpent / 3600 * 10) / 10, // hours
    tasksCompleted: d.tasksCompleted,
    routinesCompleted: d.routinesCompleted,
    habitsCompleted: d.habitsCompleted,
    modulesUsed: d.modulesUsed,
  }))

  return <ClientAnalytics dailyData={formattedData} metrics={metrics} />
}