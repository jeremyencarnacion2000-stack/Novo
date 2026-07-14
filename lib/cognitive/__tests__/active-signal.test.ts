/// <reference types="jest" />
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    twinEvolutionLog: {
      findFirst: jest.fn(),
    },
  },
}));

import { getActiveSignal } from '../active-signal';

describe('getActiveSignal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the Notion signal when both a Notion and a Calendar signal exist today', async () => {
    (prisma.twinEvolutionLog.findFirst as jest.Mock).mockImplementation(({ where }: any) => {
      if (where.changeType.startsWith === 'notion_') {
        return Promise.resolve({
          id: 'n1', changeType: 'notion_overdue_accumulation',
          description: '3 tareas de Notion vencidas', createdAt: new Date(),
        });
      }
      return Promise.resolve({
        id: 'c1', changeType: 'calendar_meeting_overload',
        description: '3 reuniones seguidas', createdAt: new Date(),
      });
    });

    const result = await getActiveSignal('user-1');
    expect(result?.platform).toBe('notion');
    expect(result?.id).toBe('n1');
  });

  it('returns the Calendar signal when only a Calendar signal exists today', async () => {
    (prisma.twinEvolutionLog.findFirst as jest.Mock).mockImplementation(({ where }: any) => {
      if (where.changeType.startsWith === 'notion_') return Promise.resolve(null);
      return Promise.resolve({
        id: 'c1', changeType: 'calendar_meeting_overload',
        description: '3 reuniones seguidas', createdAt: new Date(),
      });
    });

    const result = await getActiveSignal('user-1');
    expect(result?.platform).toBe('calendar');
    expect(result?.id).toBe('c1');
  });

  it('returns null when neither signal exists today', async () => {
    (prisma.twinEvolutionLog.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await getActiveSignal('user-1');
    expect(result).toBeNull();
  });
});
