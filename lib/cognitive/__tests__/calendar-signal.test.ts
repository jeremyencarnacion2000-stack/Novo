/// <reference types="jest" />
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    twinEvolutionLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { computeCalendarSignal } from '../calendar-signal';

describe('computeCalendarSignal', () => {
  const now = new Date('2026-07-13T12:00:00');

  it('reports not connected as zeroed-out signal when given no events and connected is set by caller', () => {
    const result = computeCalendarSignal([], now);
    expect(result.meetingCount).toBe(0);
    expect(result.meetingMinutesToday).toBe(0);
    expect(result.largestFreeGapMinutes).toBe(15 * 60); // full 7:00-22:00 window free
  });

  it('counts timed events within waking hours and computes minutes busy', () => {
    const events = [
      { start: { dateTime: '2026-07-13T09:00:00' }, end: { dateTime: '2026-07-13T09:30:00' } },
      { start: { dateTime: '2026-07-13T10:00:00' }, end: { dateTime: '2026-07-13T11:00:00' } },
    ];
    const result = computeCalendarSignal(events, now);
    expect(result.meetingCount).toBe(2);
    expect(result.meetingMinutesToday).toBe(90);
  });

  it('ignores all-day events (no dateTime)', () => {
    const events = [
      { start: { date: '2026-07-13' } as any, end: { date: '2026-07-14' } as any },
    ];
    const result = computeCalendarSignal(events, now);
    expect(result.meetingCount).toBe(0);
  });

  it('computes the largest free gap correctly around a single meeting', () => {
    const events = [
      { start: { dateTime: '2026-07-13T09:00:00' }, end: { dateTime: '2026-07-13T09:30:00' } },
    ];
    const result = computeCalendarSignal(events, now);
    // Free from 07:00-09:00 (120 min) and 09:30-22:00 (750 min) — largest is 750
    expect(result.largestFreeGapMinutes).toBe(750);
  });
});

import { evaluateCalendarThresholds } from '../calendar-signal';

describe('evaluateCalendarThresholds', () => {
  const now = new Date('2026-07-13T12:00:00');

  it('returns no signals when not connected', () => {
    const signal = { connected: false, meetingCount: 0, meetingMinutesToday: 0, largestFreeGapMinutes: null };
    const result = evaluateCalendarThresholds([], signal, '09:00', '11:00', now);
    expect(result).toEqual([]);
  });

  it('flags meeting overload for 3+ consecutive events with <10 min gaps', () => {
    const events = [
      { start: { dateTime: '2026-07-13T09:00:00' }, end: { dateTime: '2026-07-13T09:30:00' } },
      { start: { dateTime: '2026-07-13T09:35:00' }, end: { dateTime: '2026-07-13T10:00:00' } },
      { start: { dateTime: '2026-07-13T10:05:00' }, end: { dateTime: '2026-07-13T10:30:00' } },
    ];
    const signal = { connected: true, meetingCount: 3, meetingMinutesToday: 85, largestFreeGapMinutes: 600 };
    const result = evaluateCalendarThresholds(events, signal, '14:00', '16:00', now);
    expect(result.find(s => s.type === 'calendar_meeting_overload')).toBeDefined();
    expect(result.find(s => s.type === 'calendar_meeting_overload')?.headline).toContain('3');
  });

  it('does not flag meeting overload when gaps are >= 10 min', () => {
    const events = [
      { start: { dateTime: '2026-07-13T09:00:00' }, end: { dateTime: '2026-07-13T09:30:00' } },
      { start: { dateTime: '2026-07-13T09:45:00' }, end: { dateTime: '2026-07-13T10:15:00' } },
      { start: { dateTime: '2026-07-13T10:30:00' }, end: { dateTime: '2026-07-13T11:00:00' } },
    ];
    const signal = { connected: true, meetingCount: 3, meetingMinutesToday: 90, largestFreeGapMinutes: 600 };
    const result = evaluateCalendarThresholds(events, signal, '14:00', '16:00', now);
    expect(result.find(s => s.type === 'calendar_meeting_overload')).toBeUndefined();
  });

  it('flags no real focus window when largest free gap is under 30 minutes', () => {
    const signal = { connected: true, meetingCount: 1, meetingMinutesToday: 800, largestFreeGapMinutes: 25 };
    const result = evaluateCalendarThresholds([], signal, '09:00', '11:00', now);
    expect(result.find(s => s.type === 'calendar_no_focus_window')).toBeDefined();
  });

  it('does not flag no-focus-window when the largest gap is 30 minutes or more', () => {
    const signal = { connected: true, meetingCount: 1, meetingMinutesToday: 60, largestFreeGapMinutes: 30 };
    const result = evaluateCalendarThresholds([], signal, '09:00', '11:00', now);
    expect(result.find(s => s.type === 'calendar_no_focus_window')).toBeUndefined();
  });

  it('flags a peak-window conflict when an event overlaps the declared peak window', () => {
    const events = [
      { start: { dateTime: '2026-07-13T09:30:00' }, end: { dateTime: '2026-07-13T10:00:00' } },
    ];
    const signal = { connected: true, meetingCount: 1, meetingMinutesToday: 30, largestFreeGapMinutes: 600 };
    const result = evaluateCalendarThresholds(events, signal, '09:00', '11:00', now);
    expect(result.find(s => s.type === 'calendar_peak_conflict')).toBeDefined();
  });

  it('does not flag a peak-window conflict when no event overlaps it', () => {
    const events = [
      { start: { dateTime: '2026-07-13T13:00:00' }, end: { dateTime: '2026-07-13T13:30:00' } },
    ];
    const signal = { connected: true, meetingCount: 1, meetingMinutesToday: 30, largestFreeGapMinutes: 600 };
    const result = evaluateCalendarThresholds(events, signal, '09:00', '11:00', now);
    expect(result.find(s => s.type === 'calendar_peak_conflict')).toBeUndefined();
  });
});

import { persistNewCalendarSignals } from '../calendar-signal';

describe('persistNewCalendarSignals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes a new TwinEvolutionLog row when none exists today for that changeType', async () => {
    (prisma.twinEvolutionLog.findFirst as jest.Mock).mockResolvedValue(null);

    await persistNewCalendarSignals('twin-1', 'user-1', [
      { type: 'calendar_meeting_overload', headline: '3 reuniones seguidas', detail: 'detalle', severity: 'warning' },
    ]);

    expect(prisma.twinEvolutionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        twinId: 'twin-1',
        userId: 'user-1',
        changeType: 'calendar_meeting_overload',
      }),
    });
  });

  it('does not write a duplicate row when one already exists today for that changeType', async () => {
    (prisma.twinEvolutionLog.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-row' });

    await persistNewCalendarSignals('twin-1', 'user-1', [
      { type: 'calendar_meeting_overload', headline: '3 reuniones seguidas', detail: 'detalle', severity: 'warning' },
    ]);

    expect(prisma.twinEvolutionLog.create).not.toHaveBeenCalled();
  });

  it('does nothing when there are no signals', async () => {
    await persistNewCalendarSignals('twin-1', 'user-1', []);
    expect(prisma.twinEvolutionLog.findFirst).not.toHaveBeenCalled();
    expect(prisma.twinEvolutionLog.create).not.toHaveBeenCalled();
  });
});
