import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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