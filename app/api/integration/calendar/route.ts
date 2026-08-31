/**
 * /api/integration/calendar
 *
 * GET  — Checks if the Google integration includes the 'calendar' scope.
 * POST — { action: 'sync_from_google' } pulls events from the user's Google
 *        Calendar (next 30 days) and upserts them into Novo's CalendarEvent
 *        table, deduped by googleEventId.
 */

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calendarService } from '@/lib/google';
import { findGoogleAccountForScopes } from '@/lib/google-account';

// ── GET — Check Connection / Scope Status ────────────────────────────────────

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const googleAccount = await findGoogleAccountForScopes(session.user.id, ['calendar']);

    if (!googleAccount) {
        return NextResponse.json({
            connected: false,
            hasScope: false,
            message: 'Google account not connected to Novo',
        });
    }

    return NextResponse.json({ connected: true, hasScope: true });
}

// ── POST — Sync From Google ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const googleAccount = await findGoogleAccountForScopes(session.user.id, ['calendar']);

    if (!googleAccount) {
        return NextResponse.json({ error: 'Google account not connected' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    if (body.action !== 'sync_from_google') {
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    try {
        const timeMin = new Date();
        const timeMax = new Date(timeMin.getTime() + 30 * 24 * 60 * 60 * 1000);
        const googleEvents = await calendarService.listEventsForUser(session.user.id, timeMin.toISOString(), 250, timeMax.toISOString());

        let created = 0;
        let updated = 0;

        for (const gEvent of googleEvents) {
            if (!gEvent.id) continue;

            const startStr = gEvent.start?.dateTime || gEvent.start?.date;
            const endStr = gEvent.end?.dateTime || gEvent.end?.date;
            if (!startStr || !endStr) continue; // skip malformed entries (no start/end)

            const allDay = !gEvent.start?.dateTime;
            const data = {
                title: gEvent.summary || '(Sin título)',
                description: gEvent.description || null,
                start: new Date(startStr),
                end: new Date(endStr),
                allDay,
            };

            const existing = await prisma.calendarEvent.findFirst({
                where: { userId: session.user.id, googleEventId: gEvent.id },
            });

            if (existing) {
                await prisma.calendarEvent.update({ where: { id: existing.id }, data });
                updated++;
            } else {
                await prisma.calendarEvent.create({
                    data: {
                        ...data,
                        source: 'google',
                        googleEventId: gEvent.id,
                        userId: session.user.id,
                    },
                });
                created++;
            }
        }

        return NextResponse.json({
            success: true,
            total: googleEvents.length,
            created,
            updated,
        });
    } catch {
        console.error('[Google Calendar Sync] Failed.');
        return NextResponse.json({
            error: 'Google Calendar sync failed',
            code: 'GOOGLE_CALENDAR_UNAVAILABLE',
        }, { status: 502 });
    }
}
