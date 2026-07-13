/// <reference types="jest" />
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
