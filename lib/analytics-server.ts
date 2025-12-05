import { prisma } from './prisma'

/**
 * Server-side Analytics Functions
 * Direct Prisma queries for maximum efficiency
 * Use only in Server Components
 */

export async function getAnalyticsData(userId: string, days: number = 30) {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - days)

    // Fetch daily analytics and events in parallel
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

    // Merge dailyData with event breakdown
    const enrichedDailyData = dailyData.map(day => {
        const dateStr = day.date.toISOString().split('T')[0]
        const breakdown = dailyBreakdown[dateStr] || { tasks: 0, routines: 0, habits: 0 }
        return {
            id: day.id,
            userId: day.userId,
            date: day.date,
            totalTimeSpent: day.totalTime || 0, // in seconds
            tasksCompleted: breakdown.tasks,
            routinesCompleted: breakdown.routines,
            habitsCompleted: breakdown.habits,
            modulesUsed: typeof day.modulesUsed === 'string' ? JSON.parse(day.modulesUsed) : day.modulesUsed,
            completions: day.completions || 0,
            productivityScore: day.productivityScore || 0,
        }
    })

    // Add days with events but no DailyAnalytics record
    Object.keys(dailyBreakdown).forEach(dateStr => {
        const hasRecord = enrichedDailyData.some(d => d.date.toISOString().split('T')[0] === dateStr)
        if (!hasRecord) {
            enrichedDailyData.push({
                id: `generated-${dateStr}`,
                userId,
                date: new Date(dateStr),
                totalTimeSpent: 0,
                tasksCompleted: dailyBreakdown[dateStr].tasks,
                routinesCompleted: dailyBreakdown[dateStr].routines,
                habitsCompleted: dailyBreakdown[dateStr].habits,
                modulesUsed: [],
                completions: 0,
                productivityScore: 0,
            })
        }
    })

    // Fill in missing days with zeros for consistent charting
    const allDays: typeof enrichedDailyData = []
    for (let i = 0; i < days; i++) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        date.setHours(0, 0, 0, 0)

        const existingDay = enrichedDailyData.find(d => {
            const dDate = new Date(d.date)
            dDate.setHours(0, 0, 0, 0)
            return dDate.getTime() === date.getTime()
        })

        if (existingDay) {
            allDays.push(existingDay)
        } else {
            allDays.push({
                id: `empty-${date.toISOString()}`,
                userId,
                date,
                totalTimeSpent: 0,
                tasksCompleted: 0,
                routinesCompleted: 0,
                habitsCompleted: 0,
                modulesUsed: [],
                completions: 0,
                productivityScore: 0,
            })
        }
    }

    // Sort by date ascending
    allDays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return {
        dailyData: allDays,
        events,
    }
}

export async function calculateProductivityMetrics(userId: string, days: number = 30) {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - days)

    // Fetch all necessary data in parallel
    const [dailyData, events, sessions] = await Promise.all([
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
        }),
        prisma.userSession.findMany({
            where: {
                userId: userId,
                startTime: {
                    gte: startDate,
                },
            },
        }),
    ])

    // Calculate metrics
    const totalDays = days
    const productiveDays = dailyData.filter(d => (d.completions || 0) > 0 || (d.totalTime || 0) > 0).length
    const productivityRate = totalDays > 0 ? productiveDays / totalDays : 0

    const totalTime = dailyData.reduce((sum, d) => sum + (d.totalTime || 0), 0)
    const avgDailyTime = totalDays > 0 ? totalTime / totalDays / 3600 : 0 // in hours

    const totalCompletions = dailyData.reduce((sum, d) => sum + (d.completions || 0), 0)

    // Calculate peak hour from sessions
    const hourCounts: { [hour: number]: number } = {}
    sessions.forEach(session => {
        const hour = session.startTime.getHours()
        hourCounts[hour] = (hourCounts[hour] || 0) + 1
    })

    const peakHourEntry = Object.entries(hourCounts).reduce(
        (max, [hour, count]) => (count > max[1] ? [parseInt(hour), count] : max),
        [9, 0] // default to 9am if no sessions
    )
    const peakHour = peakHourEntry[0]

    return {
        totalDays,
        productiveDays,
        productivityRate,
        avgDailyTime,
        totalCompletions,
        peakHour,
    }
}

/**
 * Get fitness data for analytics integration
 */
export async function getFitnessAnalytics(userId: string, days: number = 7) {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - days)

    const [workouts, stepsData] = await Promise.all([
        prisma.workoutEntry.findMany({
            where: {
                userId,
                date: {
                    gte: startDate,
                },
            },
            orderBy: { date: 'desc' },
        }),
        prisma.fitnessEntry.findMany({
            where: {
                userId,
                date: {
                    gte: startDate,
                },
            },
            orderBy: { date: 'desc' },
        }),
    ])

    const totalWorkouts = workouts.length
    const totalWorkoutMinutes = workouts.reduce((sum, w) => sum + w.durationMinutes, 0)
    const avgWorkoutDuration = totalWorkouts > 0 ? totalWorkoutMinutes / totalWorkouts : 0

    const totalSteps = stepsData.reduce((sum, s) => sum + s.steps, 0)
    const avgDailySteps = stepsData.length > 0 ? totalSteps / stepsData.length : 0

    return {
        workouts: workouts.map(w => ({
            name: w.name,
            durationMinutes: w.durationMinutes,
            startTime: w.date.toISOString(),
        })),
        totalWorkouts,
        totalWorkoutMinutes,
        avgWorkoutDuration,
        totalSteps,
        avgDailySteps,
    }
}
