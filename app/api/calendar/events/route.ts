import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CalendarAggregator } from '@/lib/calendar-aggregator';
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime';

const CALENDAR_EVENT_CREATE_SCOPE = 'calendar_event_create'
const IDEMPOTENCY_KEY_MAX_LENGTH = 128
const MAX_CALENDAR_RANGE_MS = 366 * 24 * 60 * 60 * 1000
const MAX_EVENT_TITLE_LENGTH = 200
const MAX_EVENT_DESCRIPTION_LENGTH = 10_000
const CALENDAR_SOURCE_KEYS = new Set(['google', 'checklist', 'project', 'school', 'routine', 'habit', 'business', 'holidays', 'novo'])

function isUniqueConstraintError(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function eventResponse(event: { id: string }, replay: boolean) {
    const response = NextResponse.json({ event }, { status: replay ? 200 : 201 })
    response.headers.set('X-Idempotent-Replay', String(replay))
    return response
}

// GET /api/calendar/events - Get calendar events for date range
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;

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
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            return NextResponse.json(
                { error: 'Invalid calendar event range' },
                { status: 400 }
            );
        }
        if (end.getTime() - start.getTime() > MAX_CALENDAR_RANGE_MS) {
            return NextResponse.json(
                { error: 'Calendar range is too large' },
                { status: 400 }
            );
        }

        // Parse sources filter
        const sources = sourcesParam
            ? [...new Set(sourcesParam.split(',').map(source => source.trim()).filter(source => CALENDAR_SOURCE_KEYS.has(source)))]
            : undefined;

        const events = await CalendarAggregator.getEventsForRange(
            userId,
            start,
            end,
            sources
        );

        return NextResponse.json({ events });
    } catch {
        console.error('Error fetching calendar events.');
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

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;

        const body = await request.json();
        const { title, description, start, end, allDay } = body;

        if (!title || !start || !end) {
            return NextResponse.json(
                { error: 'Missing title, start, or end' },
                { status: 400 }
            );
        }

        const normalizedTitle = typeof title === 'string' ? title.trim() : ''
        const normalizedDescription = typeof description === 'string' ? description.trim() : null
        if (!normalizedTitle || normalizedTitle.length > MAX_EVENT_TITLE_LENGTH) {
            return NextResponse.json({ error: 'Invalid calendar event title' }, { status: 400 })
        }
        if (normalizedDescription && normalizedDescription.length > MAX_EVENT_DESCRIPTION_LENGTH) {
            return NextResponse.json({ error: 'Calendar event description is too long' }, { status: 400 })
        }

        const startAt = new Date(start)
        const endAt = new Date(end)
        if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
            return NextResponse.json({ error: 'Invalid calendar event range' }, { status: 400 })
        }

        const normalized = {
            title: normalizedTitle,
            description: normalizedDescription,
            start: startAt.toISOString(),
            end: endAt.toISOString(),
            allDay: !!allDay,
        }
        const rawIdempotencyKey = request.headers.get('Idempotency-Key')
        const idempotencyKey = rawIdempotencyKey?.trim() || null
        if (idempotencyKey && idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
            return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
        }
        const fingerprint = JSON.stringify(normalized)

        if (idempotencyKey) {
            const existing = await prisma.mutationRequest.findUnique({
                where: { userId_scope_idempotencyKey: { userId, scope: CALENDAR_EVENT_CREATE_SCOPE, idempotencyKey } },
            })
            if (existing) {
                if (existing.fingerprint !== fingerprint) {
                    return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
                }
                const previousEvent = await prisma.calendarEvent.findFirst({ where: { id: existing.resourceId, userId } })
                if (previousEvent) return eventResponse(previousEvent, true)
                return NextResponse.json({ error: 'Idempotent request result is unavailable' }, { status: 409 })
            }
        }

        const createEvent = (db: typeof prisma) => db.calendarEvent.create({
            data: { userId, title: normalized.title, description: normalized.description, start: startAt, end: endAt, allDay: normalized.allDay },
        })

        let event
        if (!idempotencyKey) {
            event = await createEvent(prisma)
        } else {
            try {
                event = await prisma.$transaction(async (tx) => {
                    await tx.mutationRequest.create({
                        data: { userId, scope: CALENDAR_EVENT_CREATE_SCOPE, idempotencyKey, fingerprint, resourceType: 'calendar_event', resourceId: 'pending' },
                    })
                    const created = await createEvent(tx as typeof prisma)
                    await tx.mutationRequest.update({
                        where: { userId_scope_idempotencyKey: { userId, scope: CALENDAR_EVENT_CREATE_SCOPE, idempotencyKey } },
                        data: { resourceId: created.id },
                    })
                    return created
                })
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    const winner = await prisma.mutationRequest.findUnique({
                        where: { userId_scope_idempotencyKey: { userId, scope: CALENDAR_EVENT_CREATE_SCOPE, idempotencyKey } },
                    })
                    if (winner?.fingerprint === fingerprint && winner.resourceId !== 'pending') {
                        const existingEvent = await prisma.calendarEvent.findFirst({ where: { id: winner.resourceId, userId } })
                        if (existingEvent) return eventResponse(existingEvent, true)
                    }
                }
                throw error
            }
        }

        void runAmbientTwinForUser(userId, { trigger: 'calendar_changed' }).catch(() => undefined)

        return eventResponse(event, false);
    } catch {
        console.error('Error creating calendar event.');
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
