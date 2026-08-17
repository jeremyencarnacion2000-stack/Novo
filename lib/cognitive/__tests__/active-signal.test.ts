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
      if (where.changeType.startsWith === 'calendar_') {
        return Promise.resolve({
          id: 'c1', changeType: 'calendar_meeting_overload',
          description: '3 reuniones seguidas', createdAt: new Date(),
        });
      }
      return Promise.resolve(null);
    });

    const result = await getActiveSignal('user-1');
    expect(result?.platform).toBe('notion');
    expect(result?.id).toBe('n1');
  });

  it('returns the Calendar signal when only a Calendar signal exists today', async () => {
    (prisma.twinEvolutionLog.findFirst as jest.Mock).mockImplementation(({ where }: any) => {
      if (where.changeType.startsWith === 'calendar_') {
        return Promise.resolve({
          id: 'c1', changeType: 'calendar_meeting_overload',
          description: '3 reuniones seguidas', createdAt: new Date(),
        });
      }
      return Promise.resolve(null);
    });

    const result = await getActiveSignal('user-1');
    expect(result?.platform).toBe('calendar');
    expect(result?.id).toBe('c1');
  });

  it('returns the Todoist signal when both a Todoist and a Calendar signal exist today', async () => {
    (prisma.twinEvolutionLog.findFirst as jest.Mock).mockImplementation(({ where }: any) => {
      if (where.changeType.startsWith === 'todoist_') {
        return Promise.resolve({
          id: 't1', changeType: 'todoist_overdue_accumulation',
          description: '3 tareas de Todoist vencidas', createdAt: new Date(),
        });
      }
      if (where.changeType.startsWith === 'calendar_') {
        return Promise.resolve({
          id: 'c1', changeType: 'calendar_meeting_overload',
          description: '3 reuniones seguidas', createdAt: new Date(),
        });
      }
      return Promise.resolve(null);
    });

    const result = await getActiveSignal('user-1');
    expect(result?.platform).toBe('todoist');
    expect(result?.id).toBe('t1');
  });

  it('returns null when neither signal exists today', async () => {
    (prisma.twinEvolutionLog.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await getActiveSignal('user-1');
    expect(result).toBeNull();
  });

  it('ranks a device signal below every other platform when they coexist today', async () => {
    (prisma.twinEvolutionLog.findFirst as jest.Mock).mockImplementation(({ where }: any) => {
      if (where.changeType.startsWith === 'device_') {
        return Promise.resolve({
          id: 'd1', changeType: 'device_long_session',
          description: 'Tuviste una sesión de más de 2 horas seguidas en Novo', createdAt: new Date(),
        });
      }
      return Promise.resolve(null);
    });

    const result = await getActiveSignal('user-1');
    expect(result?.platform).toBe('device');
    expect(result?.id).toBe('d1');
  });
});
