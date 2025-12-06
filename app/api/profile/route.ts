import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// GET /api/profile - Get user profile with stats
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession();

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                goals: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get activity counts - handle errors gracefully
        let tasksCount = 0;
        let projectsCount = 0;
        let focusMinutes = 0;
        let habitsCount = 0;
        let streakDays = 0;

        try {
            const results = await Promise.all([
                prisma.checklistItem.count({
                    where: { userId: user.id, completed: true },
                }).catch(() => 0),
                prisma.project.count({
                    where: { userId: user.id },
                }).catch(() => 0),
                prisma.focusSession.aggregate({
                    where: { userId: user.id, completed: true },
                    _sum: { duration: true },
                }).catch(() => ({ _sum: { duration: 0 } })),
                prisma.tracker.count({
                    where: { userId: user.id },
                }).catch(() => 0),
                calculateStreak(user.id).catch(() => 0),
            ]);

            tasksCount = results[0] as number;
            projectsCount = results[1] as number;
            focusMinutes = (results[2] as any)?._sum?.duration || 0;
            habitsCount = results[3] as number;
            streakDays = results[4] as number;
        } catch (e) {
            console.error('Error fetching stats:', e);
        }

        // Use current date if createdAt doesn't exist
        const memberSince = new Date();
        const daysSinceMember = 0;

        return NextResponse.json({
            profile: {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                memberSince: memberSince.toISOString(),
                daysSinceMember,
            },
            stats: {
                tasksCompleted: tasksCount,
                projectsCreated: projectsCount,
                focusHours: Math.round(focusMinutes / 60),
                habitsTracked: habitsCount,
                currentStreak: streakDays,
            },
            goals: user.goals.map(g => ({
                id: g.id,
                title: g.title,
                description: g.description,
                category: g.category,
                progress: g.progress,
                targetDate: g.targetDate,
                status: g.status,
                createdAt: g.createdAt,
            })),
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

async function calculateStreak(userId: string): Promise<number> {
    try {
        const tasks = await prisma.checklistItem.findMany({
            where: { userId, completed: true },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
            take: 365,
        });

        if (tasks.length === 0) return 0;

        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        for (let i = 0; i <= 30; i++) { // Check only last 30 days for performance
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
    } catch (error) {
        console.error('Error calculating streak:', error);
        return 0;
    }
}
