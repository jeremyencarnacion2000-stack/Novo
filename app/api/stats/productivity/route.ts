import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// GET /api/stats/productivity - Get comprehensive productivity statistics
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession();

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || 'week'; // 'day' | 'week' | 'month' | 'year'

        const now = new Date();
        let startDate: Date;

        switch (period) {
            case 'day':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        // Fetch all relevant data
        const [
            tasks,
            projects,
            routines,
            habits,
            focusSessions,
            goals,
        ] = await Promise.all([
            // Tasks (Checklist items)
            prisma.checklistItem.findMany({
                where: {
                    userId: user.id,
                    createdAt: { gte: startDate },
                },
            }),
            // Projects
            prisma.project.findMany({
                where: {
                    userId: user.id,
                },
                include: {
                    tasks: {
                        where: {
                            createdAt: { gte: startDate },
                        },
                    },
                },
            }),
            // Routines
            prisma.routine.findMany({
                where: { userId: user.id },
                include: {
                    items: true,
                },
            }),
            // Habits (trackers)
            prisma.habitTracker.findMany({
                where: { userId: user.id },
                include: {
                    entries: {
                        where: {
                            date: { gte: startDate },
                        },
                    },
                },
            }),
            // Focus sessions
            prisma.focusSession.findMany({
                where: {
                    userId: user.id,
                    startTime: { gte: startDate },
                },
            }),
            // Goals
            prisma.goal.findMany({
                where: { userId: user.id },
            }),
        ]);

        // Calculate task statistics
        const completedTasks = tasks.filter(t => t.completed).length;
        const totalTasks = tasks.length;
        const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        // Calculate project statistics
        const activeProjects = projects.filter(p => p.status === 'in_progress').length;
        const completedProjects = projects.filter(p => p.status === 'completed').length;
        const projectTasks = projects.flatMap(p => p.tasks);
        const completedProjectTasks = projectTasks.filter(t => t.completed).length;

        // Calculate focus statistics
        const totalFocusMinutes = focusSessions
            .filter(s => s.completed)
            .reduce((sum, s) => sum + (s.actualDuration || s.duration), 0);
        const focusSessiosnCount = focusSessions.filter(s => s.completed).length;
        const avgFocusQuality = focusSessions
            .filter(s => s.focusQuality)
            .reduce((sum, s, _, arr) => sum + (s.focusQuality || 0) / arr.length, 0);

        // Calculate habit statistics
        const habitCompletionRates = habits.map(h => {
            const entries = h.entries;
            const completedEntries = entries.filter((e: any) => e.completed).length;
            return {
                name: h.name,
                rate: entries.length > 0 ? (completedEntries / entries.length) * 100 : 0,
            };
        });
        const avgHabitCompletion = habitCompletionRates.length > 0
            ? habitCompletionRates.reduce((sum, h) => sum + h.rate, 0) / habitCompletionRates.length
            : 0;

        // Calculate goal progress
        const goalsWithProgress = goals.map(g => ({
            title: g.title,
            progress: g.progress || 0,
        }));
        const avgGoalProgress = goalsWithProgress.length > 0
            ? goalsWithProgress.reduce((sum, g) => sum + g.progress, 0) / goalsWithProgress.length
            : 0;

        // Calculate productivity score (weighted average)
        const productivityScore = Math.round(
            (taskCompletionRate * 0.3) +
            (avgHabitCompletion * 0.25) +
            (avgGoalProgress * 0.25) +
            (Math.min(totalFocusMinutes / (period === 'day' ? 120 : period === 'week' ? 600 : 2400), 1) * 100 * 0.2)
        );

        // Daily breakdown for charts
        const days = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 365;
        const dailyStats = [];

        for (let i = 0; i < Math.min(days, 30); i++) {
            const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

            const dayTasks = tasks.filter(t => {
                const created = new Date(t.createdAt);
                return created >= dayStart && created < dayEnd;
            });

            const dayFocus = focusSessions.filter(s => {
                const start = new Date(s.startTime);
                return start >= dayStart && start < dayEnd;
            });

            dailyStats.unshift({
                date: dayStart.toISOString().split('T')[0],
                tasksCompleted: dayTasks.filter(t => t.completed).length,
                tasksCreated: dayTasks.length,
                focusMinutes: dayFocus
                    .filter(s => s.completed)
                    .reduce((sum, s) => sum + (s.actualDuration || s.duration), 0),
                focusSessions: dayFocus.filter(s => s.completed).length,
            });
        }

        return NextResponse.json({
            period,
            productivityScore,
            summary: {
                tasks: {
                    total: totalTasks,
                    completed: completedTasks,
                    completionRate: Math.round(taskCompletionRate),
                },
                projects: {
                    active: activeProjects,
                    completed: completedProjects,
                    totalTasks: projectTasks.length,
                    completedTasks: completedProjectTasks,
                },
                focus: {
                    totalMinutes: totalFocusMinutes,
                    totalHours: Math.round(totalFocusMinutes / 60 * 10) / 10,
                    sessions: focusSessiosnCount,
                    avgQuality: Math.round(avgFocusQuality * 10) / 10,
                },
                habits: {
                    total: habits.length,
                    avgCompletionRate: Math.round(avgHabitCompletion),
                    topPerformers: habitCompletionRates
                        .sort((a, b) => b.rate - a.rate)
                        .slice(0, 3),
                },
                goals: {
                    total: goals.length,
                    avgProgress: Math.round(avgGoalProgress),
                },
            },
            dailyStats,
            streaks: {
                current: await calculateCurrentStreak(user.id),
                longest: await calculateLongestStreak(user.id),
            },
        });
    } catch (error) {
        console.error('Error fetching productivity stats:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

async function calculateCurrentStreak(userId: string): Promise<number> {
    const tasks = await prisma.checklistItem.findMany({
        where: { userId, completed: true },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
    });

    if (tasks.length === 0) return 0;

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (let i = 0; i <= 365; i++) {
        const checkDate = new Date(currentDate.getTime() - i * 24 * 60 * 60 * 1000);
        const hasActivity = tasks.some(t => {
            const taskDate = new Date(t.createdAt);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate.getTime() === checkDate.getTime();
        });

        if (hasActivity) {
            streak++;
        } else if (i > 0) {
            break;
        }
    }

    return streak;
}

async function calculateLongestStreak(userId: string): Promise<number> {
    const tasks = await prisma.checklistItem.findMany({
        where: { userId, completed: true },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
    });

    if (tasks.length === 0) return 0;

    let longestStreak = 0;
    let currentStreak = 1;
    let prevDate: Date | null = null;

    for (const task of tasks) {
        const taskDate = new Date(task.createdAt);
        taskDate.setHours(0, 0, 0, 0);

        if (prevDate) {
            const diffDays = Math.floor((taskDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));

            if (diffDays === 1) {
                currentStreak++;
            } else if (diffDays > 1) {
                longestStreak = Math.max(longestStreak, currentStreak);
                currentStreak = 1;
            }
        }

        prevDate = taskDate;
    }

    return Math.max(longestStreak, currentStreak);
}
