import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAdvancedInsights } from '@/lib/analytics-server'
import { inngest } from '@/lib/inngest/client'
import { updateDailyAnalytics as sharedUpdateDailyAnalytics } from '@/lib/analytics-server'
import { calculateCurrentStreak } from '@/app/api/stats/productivity/route'

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

    const [dailyData, events, focusSessions] = await Promise.all([
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
      // DailyAnalytics.totalTime tracks generic app-session (tab-open) time,
      // not dedicated focus work — using it for the "Focus Time" stat showed
      // real elapsed session time as if it were focused work. FocusSession
      // is the real source (the actual Pomodoro/focus-timer feature).
      prisma.focusSession.findMany({
        where: {
          userId: userId,
          sessionType: 'work',
          startTime: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
    ])

    // Real focus minutes per day (seconds, to match totalTime's existing unit)
    const focusSecondsByDay = focusSessions.reduce((acc, s) => {
      const dateStr = s.startTime.toISOString().split('T')[0]
      const minutes = s.actualDuration ?? s.duration
      acc[dateStr] = (acc[dateStr] || 0) + minutes * 60
      return acc
    }, {} as Record<string, number>)

    // Process events to get daily breakdowns
    const dailyBreakdown = events.reduce((acc, event) => {
      const dateStr = event.timestamp.toISOString().split('T')[0]
      if (!acc[dateStr]) {
        acc[dateStr] = { tasks: 0, routines: 0, habits: 0 }
      }
      if (event.eventType === 'task_complete' || event.eventType === 'task_completed') acc[dateStr].tasks++
      if (event.eventType === 'routine_complete' || event.eventType === 'routine_completed') acc[dateStr].routines++
      if (event.eventType === 'habit_complete' || event.eventType === 'habit_completed') acc[dateStr].habits++
      return acc
    }, {} as Record<string, { tasks: number; routines: number; habits: number }>)

    // Merge dailyData with breakdown — totalTime is overridden with real
    // focus-session minutes (see focusSecondsByDay above) instead of the
    // generic app-session time DailyAnalytics itself tracks.
    const enrichedDailyData = dailyData.map(day => {
      const dateStr = day.date.toISOString().split('T')[0]
      const breakdown = dailyBreakdown[dateStr] || { tasks: 0, routines: 0, habits: 0 }
      return {
        ...day,
        totalTime: focusSecondsByDay[dateStr] || 0,
        tasksCompleted: breakdown.tasks,
        routinesCompleted: breakdown.routines,
        habitsCompleted: breakdown.habits,
      }
    })

    // If there are days with events or real focus sessions but no
    // DailyAnalytics record, add them
    const extraDayKeys = new Set([...Object.keys(dailyBreakdown), ...Object.keys(focusSecondsByDay)])
    extraDayKeys.forEach(dateStr => {
      const hasRecord = enrichedDailyData.some(d => d.date.toISOString().split('T')[0] === dateStr)
      if (!hasRecord) {
        const breakdown = dailyBreakdown[dateStr] || { tasks: 0, routines: 0, habits: 0 }
        enrichedDailyData.push({
          id: `generated-${dateStr}`,
          userId,
          date: new Date(dateStr),
          totalTime: focusSecondsByDay[dateStr] || 0,
          modulesUsed: '[]',
          completions: 0,
          productivityScore: 0,
          tasksCompleted: breakdown.tasks,
          routinesCompleted: breakdown.routines,
          habitsCompleted: breakdown.habits,
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

    const goalTrend = 0 // Need historical goal data for trend

    // Get advanced insights with error handling
    let insights = null
    try {
      insights = await getAdvancedInsights(userId)
    } catch (insightError) {
      console.error('Failed to get advanced insights:', insightError)
      // Fallback to empty insights instead of failing the whole request
      insights = {
        bestDay: 'N/A',
        habitInsights: { top: [], bottom: [] },
        routineConsistency: [],
        goals: []
      }
    }

    // The Focus page's "Active streak" stat reads this field — it was never
    // included here, so the card was permanently stuck at "0d" regardless of
    // actual activity. /api/stats/productivity already computes a real
    // current-streak from completed checklist items; reuse it instead of a
    // second implementation.
    let streak = 0
    try {
      streak = await calculateCurrentStreak(userId)
    } catch (streakError) {
      console.error('Failed to calculate streak:', streakError)
    }

    return NextResponse.json({
      dailyData: enrichedDailyData,
      events,
      tasksCompleted: totalTasksCompleted,
      taskCompletionRate: 0,
      taskTrend,
      focusTime: focusTimeString,
      focusTrend,
      streak,
      habitsMastered: totalHabitsCompleted,
      habitCompletionRate: 0,
      habitTrend,
      goalsAchieved,
      goalCompletionRate,
      goalTrend,
      insights
    })
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function calculateProductivityScore(completions: number, totalTimeSeconds: number): number {
  // Formula: (completions * 10) + (hours * 5)
  // Max score: 100
  const hours = totalTimeSeconds / 3600;
  const score = (completions * 10) + (hours * 5);
  return Math.min(Math.round(score * 10) / 10, 100);
}


async function updateDailyAnalytics(userId: string, module: string, duration: number, isCompletion: boolean = false) {
    return sharedUpdateDailyAnalytics(userId, module, duration, isCompletion)
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    const { action, ...data } = body

    // Use session userId if not provided in body
    const userId = data.userId || session?.user?.id

    if (!userId && action !== 'endSession') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    switch (action) {
      case 'startSession': {
        const sessionRecord = await prisma.userSession.create({
          data: {
            userId: userId,
            modulesUsed: JSON.stringify([data.module]),
            startTime: new Date(),
          },
        })
        return NextResponse.json({ sessionId: sessionRecord.id })
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
            userId: userId,
            eventType: data.eventType,
            eventData: data.metadata ? JSON.stringify(data.metadata) : (data.module || ''),
          },
        })

        // If it's a focus session completion, update total time
        if (data.eventType === 'focus_session_complete' && data.metadata?.duration) {
          await updateDailyAnalytics(userId, data.module, data.metadata.duration)

          // Dispatch Event to Cognitive Engine
          // Note: duration from focus timer is in seconds, our engine expects minutes.
          try {
            await inngest.send({
              name: 'focus.completed',
              data: {
                userId,
                focusSessionId: data.metadata.taskId || 'session',
                duration: Math.round(data.metadata.duration / 60),
                quality: data.metadata.quality || 3
              }
            })
          } catch (e) {
            console.error('Failed to dispatch focus.completed to Inngest:', e)
          }
        }

        return NextResponse.json({ success: true })
      }

      case 'trackCompletion': {
        const eventType = `${data.type}_complete` as 'task_complete' | 'routine_complete' | 'habit_complete'
        await prisma.analyticsEvent.create({
          data: {
            userId: userId,
            eventType,
            eventData: data.metadata ? JSON.stringify(data.metadata) : (data.module || ''),
          },
        })

        await updateDailyAnalytics(userId, data.module, 0, true)
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

        const totalDays = dailyData.length
        const productiveDays = dailyData.filter((d) => d.productivityScore > 0).length
        const avgTimeSpent = dailyData.reduce((sum, d) => sum + d.totalTime, 0) / totalDays / 3600 // hours
        const totalCompletions = dailyData.reduce((sum, d) => sum + d.completions, 0)

        // Peak hours: group by hour of day from sessions
        const sessions = await prisma.userSession.findMany({
          where: {
            userId: userId,
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
