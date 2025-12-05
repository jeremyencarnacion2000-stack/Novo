import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, durationMinutes, date } = body;

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Workout name is required' }, { status: 400 });
        }

        if (typeof durationMinutes !== 'number' || durationMinutes <= 0) {
            return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
        }

        // Parse date or use now
        const workoutDate = date ? new Date(date) : new Date();

        const workout = await prisma.workoutEntry.create({
            data: {
                userId: session.user.id,
                name,
                durationMinutes,
                date: workoutDate
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Workout logged successfully',
            data: workout
        });
    } catch (error: any) {
        console.error('Error logging workout:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        return NextResponse.json({
            error: 'Failed to log workout',
            details: error.message
        }, { status: 500 });
    }
}
