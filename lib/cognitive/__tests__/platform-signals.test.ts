/// <reference types="jest" />
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    twinEvolutionLog: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    integrationAccount: { findUnique: jest.fn() },
  },
}));

import { persistNewPlatformSignals } from '../platform-signals';

describe('persistNewPlatformSignals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes a new TwinEvolutionLog row when none exists today for that changeType', async () => {
    (prisma.twinEvolutionLog.findMany as jest.Mock).mockResolvedValue([]);

    await persistNewPlatformSignals('twin-1', 'user-1', [
      { type: 'notion_overdue_accumulation', headline: '3 tareas de Notion vencidas', detail: 'detalle', severity: 'warning' },
    ]);

    expect(prisma.twinEvolutionLog.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ twinId: 'twin-1', userId: 'user-1', changeType: 'notion_overdue_accumulation' })] });
  });

  it('does not write a duplicate row when one already exists today for that changeType', async () => {
    (prisma.twinEvolutionLog.findMany as jest.Mock).mockResolvedValue([{ changeType: 'notion_overdue_accumulation' }]);

    await persistNewPlatformSignals('twin-1', 'user-1', [
      { type: 'notion_overdue_accumulation', headline: '3 tareas de Notion vencidas', detail: 'detalle', severity: 'warning' },
    ]);

    expect(prisma.twinEvolutionLog.createMany).not.toHaveBeenCalled();
  });

  it('does nothing when there are no signals', async () => {
    await persistNewPlatformSignals('twin-1', 'user-1', []);
    expect(prisma.twinEvolutionLog.findMany).not.toHaveBeenCalled();
    expect(prisma.twinEvolutionLog.createMany).not.toHaveBeenCalled();
  });
});
