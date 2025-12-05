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
        const { steps, date } = body;

        if (typeof steps !== 'number' || steps < 0) {
            return NextResponse.json({ error: 'Invalid steps value' }, { status: 400 });
        }

        // Parse date or use today
        const entryDate = date ? new Date(date) : new Date();
        entryDate.setHours(0, 0, 0, 0); // Normalize to start of day

        // Check if entry exists for this date
        const existing = await prisma.fitnessEntry.findFirst({
            where: {
                userId: session.user.id,
                date: {
                    gte: entryDate,
                    lt: new Date(entryDate.getTime() + 24 * 60 * 60 * 1000) // Next day
                }
            }
        });

        let entry;
        if (existing) {
            // Update existing entry
            entry = await prisma.fitnessEntry.update({
                where: { id: existing.id },
                data: { steps }
            });
        } else {
            // Create new entry
            entry = await prisma.fitnessEntry.create({
                data: {
                    userId: session.user.id,
                    steps,
                    date: entryDate
                }
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Steps logged successfully',
            data: entry
        });
    } catch (error: any) {
        console.error('Error logging steps:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        return NextResponse.json({
            error: 'Failed to log steps',
            details: error.message
        }, { status: 500 });
    }
}
