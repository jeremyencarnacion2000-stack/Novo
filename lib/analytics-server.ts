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

export async function getAdvancedInsights(userId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [dailyData, trackers, routineCompletions, goals] = await Promise.all([
        prisma.dailyAnalytics.findMany({
            where: { userId, date: { gte: thirtyDaysAgo } },
        }),
        prisma.tracker.findMany({
            where: { userId, type: 'habit' },
            include: { entries: { where: { updatedAt: { gte: thirtyDaysAgo } } } }
        }),
        prisma.routineCompletion.findMany({
            where: { routine: { userId }, completedAt: { gte: thirtyDaysAgo } },
            include: { routine: true }
        }),
        prisma.goal.findMany({
            where: { userId }
        })
    ]);

    // 1. Best Productivity Periods
    const dayOfWeekScores: Record<number, { total: number, count: number }> = {};
    dailyData.forEach(day => {
        const dow = day.date.getDay();
        if (!dayOfWeekScores[dow]) dayOfWeekScores[dow] = { total: 0, count: 0 };
        dayOfWeekScores[dow].total += day.productivityScore;
        dayOfWeekScores[dow].count++;
    });

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let bestDayIdx = -1;
    let maxAvg = -1;
    Object.entries(dayOfWeekScores).forEach(([dow, data]) => {
        const avg = data.total / data.count;
        if (avg > maxAvg) {
            maxAvg = avg;
            bestDayIdx = parseInt(dow);
        }
    });

    // 2. Habit Performance
    const habitInsights = trackers.map(t => {
        const completionRate = (t.entries.length / 30) * 100;
        return { name: t.name, rate: Math.min(Math.round(completionRate), 100) };
    }).sort((a, b) => b.rate - a.rate);

    // 3. Routine Consistency
    const routineConsistency: Record<string, number> = {};
    days.forEach(d => routineConsistency[d] = 0);
    routineCompletions.forEach(c => {
        const day = days[c.completedAt.getDay()];
        routineConsistency[day]++;
    });

    return {
        bestDay: bestDayIdx !== -1 ? days[bestDayIdx] : 'N/A',
        habitInsights: {
            top: habitInsights.slice(0, 3),
            bottom: habitInsights.slice(-3).reverse().filter(h => h.rate < 50)
        },
        routineConsistency: Object.entries(routineConsistency).map(([day, count]) => ({ day, count })),
        goals: goals.map(g => ({ title: g.title, progress: g.progress, status: g.status }))
    };
}
