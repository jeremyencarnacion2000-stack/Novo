'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { AnalyticsOverview } from '@/components/analytics/analytics-overview'
import { ProductivityHeatmap } from '@/components/analytics/productivity-heatmap'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Award, Calendar, CheckCircle2, Flame, Target, TrendingDown, TrendingUp } from 'lucide-react'

import { motion, type Variants, type Transition } from 'framer-motion'

interface DailyData {
  date: string
  totalTimeSpent: number
  tasksCompleted: number
  routinesCompleted: number
  habitsCompleted: number
  modulesUsed: string[]
  productivityScore: number
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
  insights?: {
    bestDay: string
    habitInsights: {
      top: Array<{ name: string, rate: number }>
      bottom: Array<{ name: string, rate: number }>
    }
    routineConsistency: Array<{ day: string, count: number }>
    goals: Array<{ title: string, progress: number, status: string }>
  }
}

const chartConfig = {
  timeSpent: {
    label: 'Time Spent (hours)',
    color: '#6366f1',
  },
  completions: {
    label: 'Completions',
    color: '#10b981',
  },
  tasks: {
    label: 'Tasks',
    color: '#6366f1',
  },
  routines: {
    label: 'Routines',
    color: '#8b5cf6',
  },
  habits: {
    label: 'Habits',
    color: '#f43f5e',
  },
  count: {
    label: 'Completions',
    color: '#6366f1',
  },
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1
    }
  }
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 120,
      damping: 18
    }
  }
}

const hoverSpring: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 28
}

export default function ClientAnalytics({ dailyData, metrics, insights }: ClientAnalyticsProps) {
  // Prepare module usage data for pie chart
  const moduleUsage = dailyData.reduce((acc, day) => {
    day.modulesUsed.forEach(module => {
      acc[module] = (acc[module] || 0) + 1
    })
    return acc
  }, {} as Record<string, number>)

  const pieData = Object.entries(moduleUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([module, count], index) => {
      const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e']
      return {
        name: module.charAt(0).toUpperCase() + module.slice(1),
        value: count,
        fill: colors[index % colors.length],
      }
    })

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-8 md:gap-12 pb-40 md:pb-12"
    >
      <motion.div variants={cardVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/40">
            Analytics & Insights
          </h1>
          <p className="text-muted-foreground mt-2 text-base md:text-lg font-medium">
            Track your productivity patterns and usage insights
          </p>
        </div>
        <div className="flex items-center gap-2 bg-foreground/5 backdrop-blur-md border border-foreground/10 rounded-2xl px-4 py-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest text-foreground/60">Live Tracking Active</span>
        </div>
      </motion.div>

      {/* New Analytics Overview Chart */}
      <motion.div variants={cardVariants} className="w-full">
        <AnalyticsOverview data={dailyData} metrics={metrics} />
      </motion.div>

      {/* Intelligence Insights Section */}
      {insights && (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Best Day & Habit Performance */}
          <div className="md:col-span-2 grid grid-cols-1 gap-8">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {/* Best Day Card */}
              <motion.div
                variants={cardVariants}
                whileHover={{ y: -5, scale: 1.015 }}
                transition={hoverSpring}
                style={{ willChange: 'transform' }}
              >
                <Card variant="primary" className="h-full border-foreground/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 hover-premium-glow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-bold tracking-tight">Best Day</CardTitle>
                      <Award className="h-5 w-5 text-yellow-500" strokeWidth={1.5} />
                    </div>
                    <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Most Productive Period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-4">
                      <span className="text-4xl font-black tracking-tighter text-foreground mb-2">{insights.bestDay}s</span>
                      <p className="text-sm text-foreground/60 text-center">You are consistently more productive on {insights.bestDay}s.</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Habit Performance */}
              <motion.div
                variants={cardVariants}
                whileHover={{ y: -5, scale: 1.015 }}
                transition={hoverSpring}
                style={{ willChange: 'transform' }}
              >
                <Card variant="primary" className="h-full border-foreground/10 hover-premium-glow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-bold tracking-tight">Habit Insights</CardTitle>
                      <Flame className="h-5 w-5 text-orange-500" strokeWidth={1.5} />
                    </div>
                    <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Most vs Least Consistent</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" strokeWidth={1.5} /> Top Performers
                      </p>
                      {insights.habitInsights.top.map((habit, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-foreground/80">{habit.name}</span>
                          <span className="font-bold text-emerald-400">{habit.rate}%</span>
                        </div>
                      ))}
                    </div>
                    {insights.habitInsights.bottom.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" strokeWidth={1.5} /> Needs Attention
                        </p>
                        {insights.habitInsights.bottom.map((habit, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-foreground/80">{habit.name}</span>
                            <span className="font-bold text-rose-400">{habit.rate}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Routine Consistency Chart */}
            <motion.div
              variants={cardVariants}
              whileHover={{ y: -4, scale: 1.008 }}
              transition={hoverSpring}
              style={{ willChange: 'transform' }}
            >
              <Card variant="primary" className="border-foreground/10 hover-premium-glow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold tracking-tight">Routine Consistency</CardTitle>
                    <Calendar className="h-5 w-5 text-indigo-500" strokeWidth={1.5} />
                  </div>
                  <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Completion frequency by day of week</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] w-full mt-4">
                    <ChartContainer config={chartConfig} className="h-[200px] w-full">
                      <BarChart data={insights.routineConsistency}>
                        <XAxis
                          dataKey="day"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 600 }}
                          tickFormatter={(val) => val.substring(0, 3)}
                        />
                        <ChartTooltip content={<ChartTooltipContent className="bg-slate-900/90 backdrop-blur-xl border-foreground/10" />} />
                        <Bar
                          dataKey="count"
                          fill="#6366f1"
                          radius={[4, 4, 0, 0]}
                          className="hover:opacity-80 transition-opacity"
                        />
                      </BarChart>
                    </ChartContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Goal Progress Section */}
          <motion.div
            variants={cardVariants}
            whileHover={{ y: -5, scale: 1.015 }}
            transition={hoverSpring}
            style={{ willChange: 'transform' }}
            className="flex flex-col"
          >
            <Card variant="primary" className="border-foreground/10 flex flex-col h-full hover-premium-glow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold tracking-tight">Goal Progress</CardTitle>
                  <Target className="h-5 w-5 text-rose-500" strokeWidth={1.5} />
                </div>
                <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Active Objectives</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto max-h-[500px] space-y-6 pt-4">
                {insights.goals.length > 0 ? (
                  insights.goals.map((goal, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-bold text-foreground/90 line-clamp-1">{goal.title}</span>
                        <span className="text-xs font-mono text-foreground/40">{Math.round(goal.progress)}%</span>
                      </div>
                      <Progress value={goal.progress} className="h-1.5 bg-foreground/5" />
                      <div className="flex justify-between items-center">
                        <Badge variant="outline" className="text-[8px] uppercase tracking-widest border-foreground/10 text-foreground/40">
                          {goal.status}
                        </Badge>
                        {goal.progress >= 100 && <CheckCircle2 className="h-3 w-3 text-emerald-500" strokeWidth={1.5} />}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <Target className="h-12 w-12 text-foreground/5 mb-4" strokeWidth={1.5} />
                    <p className="text-sm text-foreground/40">No active goals found.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Productivity Heatmap */}
      <motion.div variants={cardVariants} className="w-full">
        <ProductivityHeatmap data={dailyData} />
      </motion.div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Completions Over Time - Stacked Area Chart */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -4, scale: 1.008 }}
          transition={hoverSpring}
          style={{ willChange: 'transform' }}
        >
          <Card variant="primary" className="border-foreground/10 overflow-hidden hover-premium-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold tracking-tight">Daily Completions</CardTitle>
              <CardDescription className="text-sm font-medium text-muted-foreground">Tasks, routines, and habits breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillTasks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillRoutines" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillHabits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.05} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={12}
                    minTickGap={32}
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 600 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent className="bg-slate-900/90 backdrop-blur-xl border-foreground/10" />} />
                  <Area
                    type="monotone"
                    dataKey="tasksCompleted"
                    stackId="1"
                    stroke="#6366f1"
                    fill="url(#fillTasks)"
                    strokeWidth={3}
                  />
                  <Area
                    type="monotone"
                    dataKey="routinesCompleted"
                    stackId="1"
                    stroke="#8b5cf6"
                    fill="url(#fillRoutines)"
                    strokeWidth={3}
                  />
                  <Area
                    type="monotone"
                    dataKey="habitsCompleted"
                    stackId="1"
                    stroke="#f43f5e"
                    fill="url(#fillHabits)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Module Usage - Donut Chart */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -4, scale: 1.008 }}
          transition={hoverSpring}
          style={{ willChange: 'transform' }}
        >
          <Card variant="primary" className="border-foreground/10 overflow-hidden hover-premium-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold tracking-tight">Module Usage</CardTitle>
              <CardDescription className="text-sm font-medium text-muted-foreground">Most used modules over the last 90 days</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ChartContainer config={chartConfig} className="h-[300px] w-full max-w-[400px]">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fill}
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                      />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent className="bg-slate-900/90 backdrop-blur-xl border-foreground/10" />} />
                </PieChart>
              </ChartContainer>
              <div className="hidden sm:flex flex-col gap-3 ml-4">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">{entry.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}