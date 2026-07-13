// First real PlatformConnector implementation. Wraps the already-working
// calendarService (lib/google.ts) behind the generic PlatformConnector
// contract, so future platforms (which may connect via MCP instead of a
// direct API) slot in without anything downstream changing.

import { calendarService } from '@/lib/google';
import { prisma } from '@/lib/prisma';
import { computeCalendarSignal, evaluateCalendarThresholds } from '@/lib/cognitive/calendar-signal';
import type { PlatformConnector, PlatformSignal } from './types';

const DEFAULT_PEAK_START = '09:00';
const DEFAULT_PEAK_END = '11:00';

export const googleCalendarConnector: PlatformConnector = {
  // ponytail: calendarService.listEvents() resolves its Google token from the
  // ambient server session (getGoogleAuthClient -> getServerSession), not
  // from the `userId` param below — only `userId`'s twin/peak-window lookup
  // actually honors it. Safe today (every real caller runs inside that
  // user's own request), but wrong for any future non-request caller (a
  // cron job, a caller acting on another user). Fix when that caller shows
  // up: thread a real per-user token through calendarService instead.
  async fetchSignals(userId: string): Promise<PlatformSignal[]> {
    try {
      const now = new Date();
      const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const events = await calendarService.listEvents(dayStart.toISOString(), 50, dayEnd.toISOString());
      const signal = computeCalendarSignal(events as any, now);

      const twinRecord = await prisma.cognitiveTwinRecord.findUnique({ where: { userId } });
      const energyCurve = (twinRecord?.energyCurve as any) || {};
      const peakStart = energyCurve.peakFocusStart || DEFAULT_PEAK_START;
      const peakEnd = energyCurve.peakFocusEnd || DEFAULT_PEAK_END;

      return evaluateCalendarThresholds(events as any, signal, peakStart, peakEnd, now);
    } catch {
      // Not connected via Google, or the API call failed — no signals this run.
      return [];
    }
  },
};
