import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CalendarAggregator } from '@/lib/calendar-aggregator';

// GET /api/calendar/events - Get calendar events for date range
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

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

// POST /api/calendar/events - Create a native Novo calendar event
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const body = await request.json();
        const { title, description, start, end, allDay } = body;

        if (!title || !start || !end) {
            return NextResponse.json(
                { error: 'Missing title, start, or end' },
                { status: 400 }
            );
        }

        const event = await prisma.calendarEvent.create({
            data: {
                userId: user.id,
                title,
                description: description || null,
                start: new Date(start),
                end: new Date(end),
                allDay: !!allDay,
            },
        });

        return NextResponse.json({ event }, { status: 201 });
    } catch (error) {
        console.error('Error creating calendar event:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
