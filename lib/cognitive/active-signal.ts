// One shared "what's the active platform signal right now" reader, so the
// Ahora hero card and the AI chat context can never disagree about which
// signal to show. Priority: Notion, then Calendar (both directly actionable
// "do something about your schedule/tasks right now" signals), then Gmail/
// Books (lower-urgency awareness signals) — all logged today wins over
// nothing. (The ambient ToastInsight surface doesn't use this — it shows
// whatever TwinEvolutionLog entry is newest, regardless of type, which is
// the right behavior for a general activity feed.)

import { prisma } from '@/lib/prisma';

export interface ActiveSignal {
  id: string;
  changeType: string;
  description: string;
  createdAt: Date;
  platform: 'notion' | 'todoist' | 'calendar' | 'gmail' | 'books' | 'device';
}

const PLATFORM_PREFIX_PRIORITY: { prefix: string; platform: ActiveSignal['platform'] }[] = [
  { prefix: 'notion_', platform: 'notion' },
  { prefix: 'todoist_', platform: 'todoist' },
  { prefix: 'calendar_', platform: 'calendar' },
  { prefix: 'gmail_', platform: 'gmail' },
  { prefix: 'books_', platform: 'books' },
  { prefix: 'device_', platform: 'device' },
];

export async function getActiveSignal(userId: string): Promise<ActiveSignal | null> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  for (const { prefix, platform } of PLATFORM_PREFIX_PRIORITY) {
    const signal = await prisma.twinEvolutionLog.findFirst({
      where: { userId, changeType: { startsWith: prefix }, createdAt: { gte: todayStart } },
      orderBy: { createdAt: 'desc' },
    });
    if (signal) {
      return {
        id: signal.id,
        changeType: signal.changeType,
        description: signal.description,
        createdAt: signal.createdAt,
        platform,
      };
    }
  }

  return null;
}
