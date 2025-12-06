import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - days)

    const [dailyData, events] = await Promise.all([
      prisma.dailyAnalytics.findMany({
        where: {
          userId: userId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { date: 'asc' },
      }),
      prisma.analyticsEvent.findMany({
        where: {
          userId: userId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { timestamp: 'desc' },
      }),
    ])

    // Process events to get daily breakdowns
    const dailyBreakdown = events.reduce((acc, event) => {
      const dateStr = event.timestamp.toISOString().split('T')[0]
      if (!acc[dateStr]) {
        acc[dateStr] = { tasks: 0, routines: 0, habits: 0 }
      }
      if (event.eventType === 'task_complete') acc[dateStr].tasks++
      if (event.eventType === 'routine_complete') acc[dateStr].routines++
      if (event.eventType === 'habit_complete') acc[dateStr].habits++
      return acc
    }, {} as Record<string, { tasks: number; routines: number; habits: number }>)

    // Merge dailyData with breakdown
    const enrichedDailyData = dailyData.map(day => {
      const dateStr = day.date.toISOString().split('T')[0]
      const breakdown = dailyBreakdown[dateStr] || { tasks: 0, routines: 0, habits: 0 }
      return {
        ...day,
        tasksCompleted: breakdown.tasks,
        routinesCompleted: breakdown.routines,
        habitsCompleted: breakdown.habits,
      }
    })

    // If there are days with events but no DailyAnalytics record, add them
    Object.keys(dailyBreakdown).forEach(dateStr => {
      const hasRecord = enrichedDailyData.some(d => d.date.toISOString().split('T')[0] === dateStr)
      if (!hasRecord) {
        enrichedDailyData.push({
          id: `generated-${dateStr}`,
          userId,
          date: new Date(dateStr),
          totalTime: 0,
          modulesUsed: '[]',
          completions: 0,
          productivityScore: 0,
          tasksCompleted: dailyBreakdown[dateStr].tasks,
          routinesCompleted: dailyBreakdown[dateStr].routines,
          habitsCompleted: dailyBreakdown[dateStr].habits,
        } as any)
      }
    })

    // Sort by date
    enrichedDailyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const totalTasksCompleted = enrichedDailyData.reduce((acc, day) => acc + (day.tasksCompleted || 0), 0)
    const totalRoutinesCompleted = enrichedDailyData.reduce((acc, day) => acc + (day.routinesCompleted || 0), 0)
    const totalHabitsCompleted = enrichedDailyData.reduce((acc, day) => acc + (day.habitsCompleted || 0), 0)
    const totalFocusTime = enrichedDailyData.reduce((acc, day) => acc + (day.totalTime || 0), 0)

    // Calculate trends
    const midPoint = Math.floor(enrichedDailyData.length / 2)
    const recentData = enrichedDailyData.slice(midPoint)
    const previousData = enrichedDailyData.slice(0, midPoint)

    const recentTasks = recentData.reduce((acc, day) => acc + (day.tasksCompleted || 0), 0)
    const previousTasks = previousData.reduce((acc, day) => acc + (day.tasksCompleted || 0), 0)
    const taskTrend = previousTasks > 0 ? Math.round(((recentTasks - previousTasks) / previousTasks) * 100) : 0

    const recentHabits = recentData.reduce((acc, day) => acc + (day.habitsCompleted || 0), 0)
    const previousHabits = previousData.reduce((acc, day) => acc + (day.habitsCompleted || 0), 0)
    const habitTrend = previousHabits > 0 ? Math.round(((recentHabits - previousHabits) / previousHabits) * 100) : 0

    const recentFocus = recentData.reduce((acc, day) => acc + (day.totalTime || 0), 0)
    const previousFocus = previousData.reduce((acc, day) => acc + (day.totalTime || 0), 0)
    const focusTrend = previousFocus > 0 ? Math.round(((recentFocus - previousFocus) / previousFocus) * 100) : 0

    // Format focus time
    const hours = Math.floor(totalFocusTime / 3600)
    const minutes = Math.floor((totalFocusTime % 3600) / 60)
    const focusTimeString = `${hours}h ${minutes}m`

    // Get real goal data
    const goals = await prisma.goal.findMany({
      where: { userId: userId }
    })
    const goalsAchieved = goals.filter(g => g.status === 'completed').length
    const goalCompletionRate = goals.length > 0 ? Math.round((goalsAchieved / goals.length) * 100) : 0

    return NextResponse.json({
      dailyData: enrichedDailyData,
      events,
      tasksCompleted: totalTasksCompleted,
      taskCompletionRate: 0, // Needs total created tasks to calculate accurately
      taskTrend,
      focusTime: focusTimeString,
      focusTrend,
      habitsMastered: totalHabitsCompleted, // Using completions as proxy for now
      habitCompletionRate: 0, // Needs total scheduled habits
      habitTrend,
      goalsAchieved,
      goalCompletionRate,
      goalTrend: 0 // Need historical goal data for trend
    })
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function updateDailyAnalytics(userId: string, module: string, duration: number) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const existing = await prisma.dailyAnalytics.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    })

    if (existing) {
      const parsedModulesUsed = JSON.parse(existing.modulesUsed) as string[]
      const modulesUsed = parsedModulesUsed.includes(module)
        ? parsedModulesUsed
        : [...parsedModulesUsed, module]

      await prisma.dailyAnalytics.update({
        where: { id: existing.id },
        data: {
          totalTime: existing.totalTime + duration,
          modulesUsed: JSON.stringify(modulesUsed),
        },
      })
    } else {
      await prisma.dailyAnalytics.create({
        data: {
          userId,
          date: today,
          totalTime: duration,
          modulesUsed: JSON.stringify([module]),
        },
      })
    }
  } catch (error) {
    console.error('Failed to update daily analytics:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'startSession': {
        const session = await prisma.userSession.create({
          data: {
            userId: data.userId,
            modulesUsed: JSON.stringify([data.module]),
            startTime: new Date(),
          },
        })
        return NextResponse.json({ sessionId: session.id })
      }

      case 'endSession': {
        const session = await prisma.userSession.findUnique({
          where: { id: data.sessionId },
        })

        if (session && !session.endTime) {
          const endTime = new Date()
          const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000)

          await prisma.userSession.update({
            where: { id: data.sessionId },
            data: {
              endTime,
              duration,
            },
          })

          // Update daily analytics
          const modulesUsed = JSON.parse(session.modulesUsed) as string[]
          const module = modulesUsed[0] || ''
          await updateDailyAnalytics(session.userId, module, duration)
        }
        return NextResponse.json({ success: true })
      }

      case 'trackEvent': {
        await prisma.analyticsEvent.create({
          data: {
            userId: data.userId,
            eventType: data.eventType,
            eventData: data.module,
          },
        })
        return NextResponse.json({ success: true })
      }

      case 'trackCompletion': {
        const eventType = `${data.type}_complete` as 'task_complete' | 'routine_complete' | 'habit_complete'
        await prisma.analyticsEvent.create({
          data: {
            userId: data.userId,
            eventType,
            eventData: data.module,
          },
        })

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const existing = await prisma.dailyAnalytics.findUnique({
          where: {
            userId_date: {
              userId: data.userId,
              date: today,
            },
          },
        })

        if (existing) {
          await prisma.dailyAnalytics.update({
            where: { id: existing.id },
            data: {
              completions: { increment: 1 },
            },
          })
        } else {
          await prisma.dailyAnalytics.create({
            data: {
              userId: data.userId,
              date: today,
              modulesUsed: JSON.stringify([]),
              completions: 1,
            },
          })
        }
        return NextResponse.json({ success: true })
      }

      case 'getAnalyticsData': {
        const days = data.days || 30
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(endDate.getDate() - days)

        const [dailyData, events] = await Promise.all([
          prisma.dailyAnalytics.findMany({
            where: {
              userId: data.userId,
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
            orderBy: { date: 'asc' },
          }),
          prisma.analyticsEvent.findMany({
            where: {
              userId: data.userId,
              timestamp: {
                gte: startDate,
                lte: endDate,
              },
            },
            orderBy: { timestamp: 'desc' },
          }),
        ])

        return NextResponse.json({ dailyData, events })
      }

      case 'calculateProductivityMetrics': {
        const days = data.days || 30
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(endDate.getDate() - days)

        const [dailyData, events] = await Promise.all([
          prisma.dailyAnalytics.findMany({
            where: {
              userId: data.userId,
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
            orderBy: { date: 'asc' },
          }),
          prisma.analyticsEvent.findMany({
            where: {
              userId: data.userId,
              timestamp: {
                gte: startDate,
                lte: endDate,
              },
            },
            orderBy: { timestamp: 'desc' },
          }),
        ])

        const totalDays = dailyData.length
        const productiveDays = dailyData.filter((d) => d.productivityScore > 0).length
        const avgTimeSpent = dailyData.reduce((sum, d) => sum + d.totalTime, 0) / totalDays / 3600 // hours
        const totalCompletions = dailyData.reduce((sum, d) => sum + d.completions, 0)

        // Peak hours: group by hour of day from sessions
        const sessions = await prisma.userSession.findMany({
          where: {
            userId: data.userId,
            startTime: {
              gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
            },
          },
        })

        const hourCounts: { [hour: number]: number } = {}
        sessions.forEach((session) => {
          const hour = session.startTime.getHours()
          hourCounts[hour] = (hourCounts[hour] || 0) + 1
        })

        const peakHour = Object.entries(hourCounts).reduce((a, b) => hourCounts[parseInt(a[0])] > b[1] ? a : b, ['0', 0])[0]

        return NextResponse.json({
          totalDays,
          productiveDays,
          productivityRate: productiveDays / totalDays,
          avgDailyTime: avgTimeSpent,
          totalCompletions,
          peakHour: parseInt(peakHour),
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
