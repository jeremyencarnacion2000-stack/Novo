// One shared "what's the active platform signal right now" reader, so the
// Ahora hero card and the AI chat context can never disagree about which
// signal to show. Priority: a Notion signal logged today wins over a
// Calendar signal logged today. (The ambient ToastInsight surface doesn't
// use this — it shows whatever TwinEvolutionLog entry is newest, regardless
// of type, which is the right behavior for a general activity feed.)

import { prisma } from '@/lib/prisma';

export interface ActiveSignal {
  id: string;
  changeType: string;
  description: string;
  createdAt: Date;
  platform: 'notion' | 'calendar';
}

export async function getActiveSignal(userId: string): Promise<ActiveSignal | null> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const notionSignal = await prisma.twinEvolutionLog.findFirst({
    where: { userId, changeType: { startsWith: 'notion_' }, createdAt: { gte: todayStart } },
    orderBy: { createdAt: 'desc' },
  });
  if (notionSignal) {
    return {
      id: notionSignal.id,
      changeType: notionSignal.changeType,
      description: notionSignal.description,
      createdAt: notionSignal.createdAt,
      platform: 'notion',
    };
  }

  const calendarSignal = await prisma.twinEvolutionLog.findFirst({
    where: { userId, changeType: { startsWith: 'calendar_' }, createdAt: { gte: todayStart } },
    orderBy: { createdAt: 'desc' },
  });
  if (calendarSignal) {
    return {
      id: calendarSignal.id,
      changeType: calendarSignal.changeType,
      description: calendarSignal.description,
      createdAt: calendarSignal.createdAt,
      platform: 'calendar',
    };
  }

  return null;
}
