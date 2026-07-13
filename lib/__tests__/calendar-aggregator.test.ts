/// <reference types="jest" />
import { CalendarAggregator } from '../calendar-aggregator';
import { calendarService } from '@/lib/google';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/google', () => ({
  calendarService: { listEvents: jest.fn() },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    checklistItem: { findMany: jest.fn().mockResolvedValue([]) },
    project: { findMany: jest.fn().mockResolvedValue([]) },
    course: { findMany: jest.fn().mockResolvedValue([]) },
    routine: { findMany: jest.fn().mockResolvedValue([]) },
    tracker: { findMany: jest.fn().mockResolvedValue([]) },
    deal: { findMany: jest.fn().mockResolvedValue([]) },
    calendarEvent: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

describe('CalendarAggregator google events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps real Google Calendar API events into CalendarEvent shape', async () => {
    (calendarService.listEvents as jest.Mock).mockResolvedValue([
      {
        id: 'abc123',
        summary: 'Team sync',
        start: { dateTime: '2026-07-13T09:00:00' },
        end: { dateTime: '2026-07-13T09:30:00' },
      },
    ]);

    const start = new Date('2026-07-13T00:00:00');
    const end = new Date('2026-07-13T23:59:59');
    const events = await CalendarAggregator.getEventsForRange('user-1', start, end, ['google']);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'google:event:abc123',
      title: 'Team sync',
      allDay: false,
      source: 'google',
    });
  });

  it('returns an empty array when Google is not connected (API call fails)', async () => {
    (calendarService.listEvents as jest.Mock).mockRejectedValue(new Error('no token'));

    const start = new Date('2026-07-13T00:00:00');
    const end = new Date('2026-07-13T23:59:59');
    const events = await CalendarAggregator.getEventsForRange('user-1', start, end, ['google']);

    expect(events).toEqual([]);
  });
});
