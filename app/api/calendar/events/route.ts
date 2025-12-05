import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { CalendarAggregator } from '@/lib/calendar-aggregator';

// GET /api/calendar/events - Get calendar events for date range
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
        const startParam = searchParams.get('start');
        const endParam = searchParams.get('end');
        const sourcesParam = searchParams.get('sources');

        if (!startParam || !endParam) {
            return NextResponse.json(
                { error: 'Missing start or end date' },
                { status: 400 }
            );
        }

        const start = new Date(startParam);
        const end = new Date(endParam);

        // Parse sources filter
        const sources = sourcesParam ? sourcesParam.split(',') : undefined;

        const events = await CalendarAggregator.getEventsForRange(
            user.id,
            start,
            end,
            sources
        );

        return NextResponse.json({ events });
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
