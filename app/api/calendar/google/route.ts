import { NextResponse } from 'next/server';
import { calendarService } from '@/lib/google';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readIdempotencyKey } from '@/lib/server-idempotency';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const timeMin = searchParams.get('timeMin') || new Date().toISOString();
        const requestedMaxResults = Number.parseInt(searchParams.get('maxResults') || '50', 10)
        // Keep the browser-facing read bounded. Google supports larger pages,
        // but Novo only needs a compact agenda signal and an unbounded query
        // makes a slow provider response block the whole app surface.
        const maxResults = Number.isFinite(requestedMaxResults)
            ? Math.min(Math.max(requestedMaxResults, 1), 250)
            : 50

        try {
            const events = await calendarService.listEventsForUser(session.user.id, timeMin, maxResults);
            return NextResponse.json(events);
        } catch {
            console.error('[Google Calendar] Read unavailable');
            // Return empty array instead of erroring, calendar might not be connected yet
            return NextResponse.json([]);
        }
    } catch {
        console.error('[Google Calendar] Read request failed');
        return NextResponse.json({ error: 'Calendar events temporarily unavailable' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const idempotency = readIdempotencyKey(request)
        if (idempotency.invalid) {
            return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
        }

        const body = await request.json();
        const { summary, description, startTime, endTime } = body;

        if (!summary || !startTime || !endTime) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const event = await calendarService.createEventForUser(
            session.user.id,
            summary,
            description || '',
            startTime,
            endTime,
            idempotency.key ?? undefined,
        );

        return NextResponse.json(event);
    } catch {
        console.error('[Google Calendar] Create request failed');
        return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 });
    }
}
