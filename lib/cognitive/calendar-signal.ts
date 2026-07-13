// Calendar signal: meeting density + biggest free block within waking hours.
// Extracted from app/api/ai/cognitive-engine/route.ts so both the cognitive
// engine's report generation and the PlatformConnector layer (see
// lib/platform-connectors/) can share one implementation instead of two.

import type { PlatformSignal } from '@/lib/platform-connectors/types';
import { prisma } from '@/lib/prisma';

export interface CalendarSignal {
  connected: boolean;
  meetingCount: number;
  meetingMinutesToday: number;
  largestFreeGapMinutes: number | null;
}

export const WAKING_HOURS_START = 7;
export const WAKING_HOURS_END = 22;

export function computeCalendarSignal(
  events: { start?: { dateTime?: string | null } | null; end?: { dateTime?: string | null } | null }[],
  now: Date
): CalendarSignal {
  const dayStart = new Date(now); dayStart.setHours(WAKING_HOURS_START, 0, 0, 0);
  const dayEnd = new Date(now); dayEnd.setHours(WAKING_HOURS_END, 0, 0, 0);

  // Only timed events count as "busy" — all-day events (date-only, no dateTime) don't block focus time.
  const busy = events
    .filter(e => e.start?.dateTime && e.end?.dateTime)
    .map(e => ({ start: new Date(e.start!.dateTime!), end: new Date(e.end!.dateTime!) }))
    .filter(e => e.end > dayStart && e.start < dayEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const meetingMinutesToday = Math.round(
    busy.reduce((acc, e) =>
      acc + (Math.min(e.end.getTime(), dayEnd.getTime()) - Math.max(e.start.getTime(), dayStart.getTime())), 0
    ) / 60000
  );

  let cursor = dayStart.getTime();
  let largestGapMs = 0;
  for (const e of busy) {
    const s = Math.max(e.start.getTime(), dayStart.getTime());
    if (s > cursor) largestGapMs = Math.max(largestGapMs, s - cursor);
    cursor = Math.max(cursor, Math.min(e.end.getTime(), dayEnd.getTime()));
  }
  if (dayEnd.getTime() > cursor) largestGapMs = Math.max(largestGapMs, dayEnd.getTime() - cursor);

  return {
    connected: true,
    meetingCount: busy.length,
    meetingMinutesToday,
    largestFreeGapMinutes: Math.round(largestGapMs / 60000),
  };
}

export function evaluateCalendarThresholds(
  events: { start?: { dateTime?: string | null } | null; end?: { dateTime?: string | null } | null }[],
  signal: CalendarSignal,
  peakStart: string,
  peakEnd: string,
  now: Date
): PlatformSignal[] {
  const results: PlatformSignal[] = [];
  if (!signal.connected) return results;

  const busy = events
    .filter(e => e.start?.dateTime && e.end?.dateTime)
    .map(e => ({ start: new Date(e.start!.dateTime!), end: new Date(e.end!.dateTime!) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Meeting overload: a run of 3+ consecutive events where every gap < 10 min.
  let runLength = busy.length > 0 ? 1 : 0;
  let maxRun = runLength;
  for (let i = 1; i < busy.length; i++) {
    const gapMinutes = (busy[i].start.getTime() - busy[i - 1].end.getTime()) / 60000;
    if (gapMinutes < 10) {
      runLength += 1;
      maxRun = Math.max(maxRun, runLength);
    } else {
      runLength = 1;
    }
  }
  if (maxRun >= 3) {
    results.push({
      type: 'calendar_meeting_overload',
      headline: `${maxRun} reuniones seguidas sin respiro hoy`,
      detail: 'Considera un buffer de 10 minutos entre reuniones para no llegar agotado a la siguiente.',
      severity: 'warning',
    });
  }

  // No real focus window: largest free gap under 30 minutes.
  if (signal.largestFreeGapMinutes !== null && signal.largestFreeGapMinutes < 30) {
    results.push({
      type: 'calendar_no_focus_window',
      headline: `Hoy tu hueco más grande es de ${signal.largestFreeGapMinutes} min`,
      detail: 'No hay espacio real para trabajo profundo hoy — considera mover algo de baja prioridad.',
      severity: 'warning',
    });
  }

  // Peak-window conflict: any event overlaps the user's declared peak focus window.
  const [peakStartH, peakStartM] = peakStart.split(':').map(Number);
  const [peakEndH, peakEndM] = peakEnd.split(':').map(Number);
  const peakStartDate = new Date(now); peakStartDate.setHours(peakStartH, peakStartM || 0, 0, 0);
  const peakEndDate = new Date(now); peakEndDate.setHours(peakEndH, peakEndM || 0, 0, 0);
  const conflict = busy.find(e => e.start < peakEndDate && e.end > peakStartDate);
  if (conflict) {
    results.push({
      type: 'calendar_peak_conflict',
      headline: `Una reunión cae dentro de tu ventana pico (${peakStart}–${peakEnd})`,
      detail: 'Vale la pena revisar si esa hora es realmente necesaria para la reunión.',
      severity: 'info',
    });
  }

  return results;
}

// Writes newly-detected calendar signals to TwinEvolutionLog (the same table
// powering the Bitácora feed and Twin Insight Toast), deduped so at most one
// row per changeType gets written per calendar day.
export async function persistNewCalendarSignals(
  twinId: string,
  userId: string,
  signals: PlatformSignal[]
): Promise<void> {
  if (signals.length === 0) return;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  for (const signal of signals) {
    const existing = await prisma.twinEvolutionLog.findFirst({
      where: { twinId, changeType: signal.type, createdAt: { gte: todayStart } },
    });
    if (existing) continue;

    await prisma.twinEvolutionLog.create({
      data: {
        twinId,
        userId,
        changeType: signal.type,
        description: `${signal.headline} — ${signal.detail}`,
      },
    });
  }
}
