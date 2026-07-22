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
  const newlyPersisted: PlatformSignal[] = [];

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
    newlyPersisted.push(signal);
  }

  const warnings = newlyPersisted.filter(s => s.severity === 'warning');
  if (warnings.length > 0) {
    await notifySlackIfConnected(userId, warnings);
  }
}

// Slack is a delivery channel, not a data source: connected users get their
// genuinely-new warning-severity signals pushed to their chosen channel the
// same day they're detected, instead of only ever surfacing inside Novo.
async function notifySlackIfConnected(userId: string, warnings: PlatformSignal[]): Promise<void> {
  try {
    const account = await prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId, provider: 'slack' } },
    });
    const channelId = (account?.metadata as any)?.channelId;
    if (!account || !channelId) return;

    const { slackService } = await import('@/lib/slack');
    const text = warnings.map(s => `⚠️ *${s.headline}*\n${s.detail}`).join('\n\n');
    await slackService.postMessage(account.accessToken, channelId, text);
  } catch (err) {
    console.error('Failed to push signal to Slack:', err);
  }
}
