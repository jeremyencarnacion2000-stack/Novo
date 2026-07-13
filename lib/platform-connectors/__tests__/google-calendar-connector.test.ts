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
    const event1Start = new Date(); event1Start.setHours(9, 0, 0, 0);
    const event1End = new Date(); event1End.setHours(9, 30, 0, 0);
    const event2Start = new Date(); event2Start.setHours(9, 35, 0, 0);
    const event2End = new Date(); event2End.setHours(10, 0, 0, 0);
    const event3Start = new Date(); event3Start.setHours(10, 5, 0, 0);
    const event3End = new Date(); event3End.setHours(10, 30, 0, 0);

    (calendarService.listEvents as jest.Mock).mockResolvedValue([
      { start: { dateTime: event1Start.toISOString() }, end: { dateTime: event1End.toISOString() } },
      { start: { dateTime: event2Start.toISOString() }, end: { dateTime: event2End.toISOString() } },
      { start: { dateTime: event3Start.toISOString() }, end: { dateTime: event3End.toISOString() } },
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
    const peakMoment = new Date(); peakMoment.setHours(9, 0, 0, 0);
    const peakMomentEnd = new Date(); peakMomentEnd.setHours(9, 30, 0, 0);
    (calendarService.listEvents as jest.Mock).mockResolvedValue([
      { start: { dateTime: peakMoment.toISOString() }, end: { dateTime: peakMomentEnd.toISOString() } },
    ]);
    (prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue({ id: 'twin-1', energyCurve: {} });

    const signals = await googleCalendarConnector.fetchSignals('user-1');

    expect(signals.length).toBeGreaterThan(0);
    expect(signals.some(s => s.type === 'calendar_peak_conflict')).toBe(true);
  });
});
