import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get today's date normalized to start of day
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

        // Get today's steps
        const todaySteps = await prisma.fitnessEntry.findFirst({
            where: {
                userId: session.user.id,
                date: {
                    gte: today,
                    lt: tomorrow
                }
            }
        });

        // Get last 7 days of workouts
        const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const workouts = await prisma.workoutEntry.findMany({
            where: {
                userId: session.user.id,
                date: {
                    gte: sevenDaysAgo
                }
            },
            orderBy: {
                date: 'desc'
            }
        });

        return NextResponse.json({
            steps: todaySteps?.steps || 0,
            workouts: workouts.map(w => ({
                name: w.name,
                durationMinutes: w.durationMinutes,
                startTime: w.date.toISOString()
            }))
        });
    } catch (error) {
        console.error('Error fetching fitness data:', error);
        return NextResponse.json({ error: 'Failed to fetch fitness data' }, { status: 500 });
    }
}
