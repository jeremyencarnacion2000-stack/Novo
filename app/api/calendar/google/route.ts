import { NextResponse } from 'next/server';
import { calendarService } from '@/lib/google';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const timeMin = searchParams.get('timeMin') || new Date().toISOString();
        const maxResults = parseInt(searchParams.get('maxResults') || '50');

        try {
            const events = await calendarService.listEvents(timeMin, maxResults);
            return NextResponse.json(events);
        } catch (calendarError: any) {
            console.error('Calendar service error:', calendarError);
            // Return empty array instead of erroring, calendar might not be connected yet
            return NextResponse.json([]);
        }
    } catch (error: any) {
        console.error('Error in calendar route:', error);
        return NextResponse.json({ error: 'Failed to fetch calendar events', details: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { summary, description, startTime, endTime } = body;

        if (!summary || !startTime || !endTime) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const event = await calendarService.createEvent(summary, description || '', startTime, endTime);

        return NextResponse.json(event);
    } catch (error) {
        console.error('Error creating calendar event:', error);
        return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 });
    }
}
