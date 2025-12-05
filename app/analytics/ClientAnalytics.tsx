'use client'

import { DashboardShell } from '@/components/dashboard-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { FitnessStats } from '@/components/analytics/fitness-stats'

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

interface ClientAnalyticsProps {
  dailyData: DailyData[]
  metrics: ProductivityMetrics | null
}

const chartConfig = {
  timeSpent: {
    label: 'Time Spent (hours)',
    color: 'hsl(var(--chart-1))',
  },
  completions: {
    label: 'Completions',
    color: 'hsl(var(--chart-2))',
  },
  productiveDays: {
    label: 'Productive Days',
    color: 'hsl(var(--chart-3))',
  },
}

export default function ClientAnalytics({ dailyData, metrics }: ClientAnalyticsProps) {
  // Prepare module usage data for pie chart
  const moduleUsage = dailyData.reduce((acc, day) => {
    day.modulesUsed.forEach(module => {
      acc[module] = (acc[module] || 0) + 1
    })
    return acc
  }, {} as Record<string, number>)

  const pieData = Object.entries(moduleUsage).map(([module, count]) => ({
    name: module.charAt(0).toUpperCase() + module.slice(1),
    value: count,
    fill: `hsl(var(--chart-${(Object.keys(moduleUsage).indexOf(module) % 5) + 1}))`,
  }))

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 md:gap-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">
            Analytics & Insights
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Track your productivity patterns and usage insights
          </p>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Productive Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.productiveDays || 0}/{metrics?.totalDays || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics ? Math.round(metrics.productivityRate * 100) : 0}% productivity rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Daily Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.avgDailyTime ? Math.round(metrics.avgDailyTime * 10) / 10 : 0}h
              </div>
              <p className="text-xs text-muted-foreground">Hours spent daily</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Completions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.totalCompletions || 0}</div>
              <p className="text-xs text-muted-foreground">Tasks, routines & habits</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Peak Hour</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.peakHour ? `${metrics.peakHour}:00` : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">Most active hour</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Time Spent Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Time Spent by Day</CardTitle>
              <CardDescription>Hours spent in the app over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <BarChart data={dailyData}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="totalTimeSpent" fill="var(--color-timeSpent)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Completions Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Completions</CardTitle>
              <CardDescription>Tasks, routines, and habits completed by day</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <LineChart data={dailyData}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="tasksCompleted"
                    stroke="var(--color-completions)"
                    strokeWidth={2}
                    name="Tasks"
                  />
                  <Line
                    type="monotone"
                    dataKey="routinesCompleted"
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={2}
                    name="Routines"
                  />
                  <Line
                    type="monotone"
                    dataKey="habitsCompleted"
                    stroke="hsl(var(--chart-4))"
                    strokeWidth={2}
                    name="Habits"
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Module Usage */}
          <Card>
            <CardHeader>
              <CardTitle>Module Usage</CardTitle>
              <CardDescription>Most used modules over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Productivity Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Productivity Trend</CardTitle>
              <CardDescription>Days marked as productive over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <BarChart data={dailyData.map(d => ({ ...d, productive: (d.tasksCompleted + d.routinesCompleted + d.habitsCompleted) > 0 ? 1 : 0 }))}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="productive" fill="var(--color-productiveDays)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}