// Shared TwinEvolutionLog persistence for any PlatformConnector's detected
// signals — extracted from calendar-signal.ts, whose implementation was
// never calendar-specific, just its name and location. Every platform
// (Calendar, Notion, and whatever comes next) writes through this one path.

import type { PlatformSignal } from '@/lib/platform-connectors/types';
import { prisma } from '@/lib/prisma';

export async function persistNewPlatformSignals(
  twinId: string,
  userId: string,
  signals: PlatformSignal[]
): Promise<void> {
  if (signals.length === 0) return;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  for (const signal of signals) {
    const existing = await prisma.twinEvolutionLog.findFirst({
      where: { twinId, changeType: signal.type, createdAt: { gte: todayStart } },
    });
    if (existing) continue;

    await prisma.twinEvolutionLog.create({
      data: {
        twinId,
        userId,
        changeType: signal.type,
        description: `${signal.headline} — ${signal.detail}`,
      },
    });
  }
}
