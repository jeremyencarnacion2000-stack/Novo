// Calendar signal: meeting density + biggest free block within waking hours.
// Extracted from app/api/ai/cognitive-engine/route.ts so both the cognitive
// engine's report generation and the PlatformConnector layer (see
// lib/platform-connectors/) can share one implementation instead of two.

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
