/// <reference types="jest" />
import { googleCalendarConnector } from '../google-calendar-connector';
import { calendarService } from '@/lib/google';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/google', () => ({
  calendarService: { listEvents: jest.fn() },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: { cognitiveTwinRecord: { findUnique: jest.fn() } },
}));

describe('googleCalendarConnector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns signals derived from real calendar events and the twin peak window', async () => {
    (calendarService.listEvents as jest.Mock).mockResolvedValue([
      { start: { dateTime: '2026-07-13T09:00:00' }, end: { dateTime: '2026-07-13T09:30:00' } },
      { start: { dateTime: '2026-07-13T09:35:00' }, end: { dateTime: '2026-07-13T10:00:00' } },
      { start: { dateTime: '2026-07-13T10:05:00' }, end: { dateTime: '2026-07-13T10:30:00' } },
    ]);
    (prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue({
      id: 'twin-1',
      energyCurve: { peakFocusStart: '09:00', peakFocusEnd: '11:00' },
    });

    const signals = await googleCalendarConnector.fetchSignals('user-1');

    expect(signals.length).toBeGreaterThan(0);
    expect(signals.some(s => s.type === 'calendar_meeting_overload')).toBe(true);
  });

  it('returns an empty array when the Google API call fails (not connected)', async () => {
    (calendarService.listEvents as jest.Mock).mockRejectedValue(new Error('no token'));
    (prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue(null);

    const signals = await googleCalendarConnector.fetchSignals('user-1');

    expect(signals).toEqual([]);
  });

  it('falls back to default peak window when the twin has none set', async () => {
    const today = new Date().toISOString().slice(0, 10);
    (calendarService.listEvents as jest.Mock).mockResolvedValue([
      { start: { dateTime: `${today}T09:00:00` }, end: { dateTime: `${today}T09:30:00` } },
    ]);
    (prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue({ id: 'twin-1', energyCurve: {} });

    const signals = await googleCalendarConnector.fetchSignals('user-1');

    expect(signals.length).toBeGreaterThan(0);
    expect(signals.some(s => s.type === 'calendar_peak_conflict')).toBe(true);
  });
});
