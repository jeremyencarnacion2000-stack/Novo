// Second PlatformConnector implementation, mirroring
// google-calendar-connector.ts's shape. Reads ChecklistItem rows the
// existing Notion OAuth sync already wrote (app/api/integration/notion/
// route.ts) — no new API calls, no new auth.

import { prisma } from '@/lib/prisma';
import { evaluateNotionThresholds } from '@/lib/cognitive/notion-signal';
import type { PlatformConnector, PlatformSignal } from './types';

export const notionConnector: PlatformConnector = {
  async fetchSignals(userId: string): Promise<PlatformSignal[]> {
    const items = await prisma.checklistItem.findMany({
      where: { userId, source: 'notion' },
      select: { id: true, completed: true, priority: true, dueDate: true, updatedAt: true },
    });
    return evaluateNotionThresholds(items, new Date());
  },
};
