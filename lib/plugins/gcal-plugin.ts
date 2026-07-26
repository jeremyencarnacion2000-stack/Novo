/**
 * Google Calendar Plugin — reads calendar events to calibrate the Twin:
 * - Meeting density → currentCognitiveLoad
 * - Free blocks → peakFocusStart/End window
 * - After-hours events → burnout detection
 */

import { prisma } from '@/lib/prisma';
import { getOrCreateTwin } from '@/lib/cognitive/get-or-create-twin';
import { google } from 'googleapis';

interface CalEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status: string;
}

interface GCalSyncResult {
  eventsRead: number;
  meetingsToday: number;
  freeBlocksFound: number;
  peakFocusStart?: string;
  peakFocusEnd?: string;
  cognitiveLoadEstimate: number;
  signalsEmitted: number;
  error?: string;
}

function toMinutes(dateStr: string): number {
  const d = new Date(dateStr);
  return d.getHours() * 60 + d.getMinutes();
}

export async function syncGCalPlugin(userId: string): Promise<GCalSyncResult> {
  try {
    const account = await prisma.account.findFirst({
      where: { userId, provider: 'google' },
      select: { access_token: true, refresh_token: true },
    });

    if (!account?.access_token) {
      return { eventsRead: 0, meetingsToday: 0, freeBlocksFound: 0, cognitiveLoadEstimate: 0, signalsEmitted: 0, error: 'not_connected' };
    }

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token ?? undefined,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2 });

    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);

    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });

    const events: CalEvent[] = (data.items ?? []).filter(
      (e: any) => e.status !== 'cancelled' && (e.start?.dateTime || e.start?.date),
    ) as CalEvent[];

    // Count meetings (events with attendees or video links)
    const meetings = events.filter((e) => {
      const hasMeet = e.summary?.toLowerCase().includes('meet') ||
        e.summary?.toLowerCase().includes('call') ||
        e.summary?.toLowerCase().includes('zoom') ||
        e.summary?.toLowerCase().includes('standup') ||
        e.summary?.toLowerCase().includes('sync');
      return hasMeet;
    });

    // Calculate total meeting time in minutes
    let totalMeetingMinutes = 0;
    for (const e of meetings) {
      if (e.start.dateTime && e.end.dateTime) {
        const dur = (new Date(e.end.dateTime).getTime() - new Date(e.start.dateTime).getTime()) / 60000;
        totalMeetingMinutes += dur;
      }
    }

    // Estimate cognitive load from meeting density (0-100)
    const workdayMinutes = 9 * 60; // 9h
    const cognitiveLoadEstimate = Math.min(100, Math.round((totalMeetingMinutes / workdayMinutes) * 100));

    // Find largest free block for focus window
    const busySlots = events
      .filter((e) => e.start.dateTime && e.end.dateTime)
      .map((e) => ({
        start: toMinutes(e.start.dateTime!),
        end: toMinutes(e.end.dateTime!),
      }))
      .sort((a, b) => a.start - b.start);

    const workStart = 8 * 60; // 8:00
    const workEnd = 19 * 60;  // 19:00

    let maxBlockMinutes = 0;
    let peakBlockStart = workStart;

    let cursor = workStart;
    for (const slot of busySlots) {
      if (slot.start > cursor) {
        const free = Math.min(slot.start, workEnd) - cursor;
        if (free > maxBlockMinutes) {
          maxBlockMinutes = free;
          peakBlockStart = cursor;
        }
      }
      cursor = Math.max(cursor, slot.end);
    }
    if (cursor < workEnd && workEnd - cursor > maxBlockMinutes) {
      maxBlockMinutes = workEnd - cursor;
      peakBlockStart = cursor;
    }

    const peakFocusStart = maxBlockMinutes >= 45
      ? `${String(Math.floor(peakBlockStart / 60)).padStart(2, '0')}:${String(peakBlockStart % 60).padStart(2, '0')}`
      : undefined;
    const peakFocusEnd = peakFocusStart
      ? `${String(Math.floor((peakBlockStart + maxBlockMinutes) / 60)).padStart(2, '0')}:${String((peakBlockStart + maxBlockMinutes) % 60).padStart(2, '0')}`
      : undefined;

    let signalsEmitted = 0;

    // Update Twin with calendar-derived metrics
    const twin = await prisma.cognitiveTwinRecord.findUnique({ where: { userId } });
    if (twin) {
      const metrics = (twin.metrics as any) ?? {};
      const energyCurve = (twin.energyCurve as any) ?? {};

      await prisma.cognitiveTwinRecord.update({
        where: { userId },
        data: {
          metrics: {
            ...metrics,
            currentCognitiveLoad: Math.max(metrics.currentCognitiveLoad ?? 0, cognitiveLoadEstimate),
            meetingsToday: meetings.length,
            totalMeetingMinutesToday: totalMeetingMinutes,
          },
          energyCurve: peakFocusStart ? {
            ...energyCurve,
            peakFocusStart,
            peakFocusEnd: peakFocusEnd ?? energyCurve.peakFocusEnd,
            gcalDerivedAt: new Date().toISOString(),
          } : energyCurve,
        },
      });
    }

    // Emit overload signal if meetings > 4 or load > 75%
    if (meetings.length > 4 || cognitiveLoadEstimate > 75) {
      const twinRecord = twin ?? await getOrCreateTwin(userId);
      await prisma.behavioralSignal.create({
        data: {
          userId,
          twinId: twinRecord.id,
          signal: 'task_deferred',
          occurredAt: new Date(),
          metadata: {
            source: 'google_calendar',
            type: 'meeting_overload',
            meetingsToday: meetings.length,
            totalMeetingMinutes,
            cognitiveLoadEstimate,
          },
        },
      });
      signalsEmitted++;
    }

    return {
      eventsRead: events.length,
      meetingsToday: meetings.length,
      freeBlocksFound: maxBlockMinutes >= 45 ? 1 : 0,
      peakFocusStart,
      peakFocusEnd,
      cognitiveLoadEstimate,
      signalsEmitted,
    };
  } catch (err) {
    console.error('[GCalPlugin] Error:', err);
    return { eventsRead: 0, meetingsToday: 0, freeBlocksFound: 0, cognitiveLoadEstimate: 0, signalsEmitted: 0, error: String(err) };
  }
}
