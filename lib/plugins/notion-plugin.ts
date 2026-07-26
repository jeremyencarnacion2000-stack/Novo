/**
 * Notion Plugin — fetches pages/tasks from Notion API and maps them into
 * BehavioralSignal rows so the Cognitive Twin can learn from them.
 */

import { prisma } from '@/lib/prisma';
import { getOrCreateTwin } from '@/lib/cognitive/get-or-create-twin';

interface NotionPage {
  id: string;
  properties: Record<string, any>;
  created_time: string;
  last_edited_time: string;
  url: string;
  archived: boolean;
}

interface NotionTask {
  id: string;
  title: string;
  done: boolean;
  dueDate?: string;
  createdAt: string;
  lastEdited: string;
  url: string;
}

interface NotionSyncResult {
  pagesRead: number;
  tasksFound: number;
  overdueTasks: number;
  signalsEmitted: number;
  peakHour?: number;
  error?: string;
}

async function fetchNotionPages(accessToken: string, databaseId?: string): Promise<NotionPage[]> {
  const endpoint = databaseId
    ? `https://api.notion.com/v1/databases/${databaseId}/query`
    : 'https://api.notion.com/v1/search';

  const body = databaseId
    ? { page_size: 50, filter: { property: 'Done', checkbox: { equals: false } } }
    : { filter: { value: 'page', property: 'object' }, page_size: 50 };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Notion API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.results ?? [];
}

function extractTitle(page: NotionPage): string {
  for (const key of Object.keys(page.properties)) {
    const prop = page.properties[key];
    if (prop.type === 'title' && prop.title?.length > 0) {
      return prop.title.map((t: any) => t.plain_text).join('');
    }
  }
  return 'Untitled';
}

function extractDueDate(page: NotionPage): string | undefined {
  for (const key of Object.keys(page.properties)) {
    const prop = page.properties[key];
    if (prop.type === 'date' && prop.date?.start) return prop.date.start;
  }
  return undefined;
}

function isDone(page: NotionPage): boolean {
  for (const key of Object.keys(page.properties)) {
    const prop = page.properties[key];
    if (prop.type === 'checkbox') return prop.checkbox === true;
    if (prop.type === 'status') {
      const name = prop.status?.name?.toLowerCase() ?? '';
      return name === 'done' || name === 'complete' || name === 'completed';
    }
    if (prop.type === 'select') {
      const name = prop.select?.name?.toLowerCase() ?? '';
      return name === 'done' || name === 'complete';
    }
  }
  return false;
}

export async function syncNotionPlugin(userId: string): Promise<NotionSyncResult> {
  try {
    const account = await prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId, provider: 'notion' } },
      select: { accessToken: true, metadata: true },
    });

    if (!account?.accessToken) {
      return { pagesRead: 0, tasksFound: 0, overdueTasks: 0, signalsEmitted: 0, error: 'not_connected' };
    }

    const meta = account.metadata as any;
    const databaseId: string | undefined = meta?.databaseId;

    const pages = await fetchNotionPages(account.accessToken, databaseId);

    const tasks: NotionTask[] = pages.map((p) => ({
      id: p.id,
      title: extractTitle(p),
      done: isDone(p),
      dueDate: extractDueDate(p),
      createdAt: p.created_time,
      lastEdited: p.last_edited_time,
      url: p.url,
    }));

    const now = new Date();
    const pendingTasks = tasks.filter((t) => !t.done);
    const overdueTasks = pendingTasks.filter((t) => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < now;
    });

    // Detect editing hour patterns for chronotype learning
    const editHours = tasks.map((t) => new Date(t.lastEdited).getHours());
    const hourCounts: Record<number, number> = {};
    for (const h of editHours) hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    const peakHour = editHours.length > 0
      ? Number(Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0]?.[0])
      : undefined;

    // Emit behavioral signals
    let signalsEmitted = 0;

    if (overdueTasks.length >= 2) {
      const twin = await getOrCreateTwin(userId);
      await prisma.behavioralSignal.create({
        data: {
          userId,
          twinId: twin.id,
          signal: 'task_deferred',
          occurredAt: new Date(),
          metadata: {
            source: 'notion',
            overdueCount: overdueTasks.length,
            titles: overdueTasks.slice(0, 5).map((t) => t.title),
          },
        },
      });
      signalsEmitted++;
    }

    // Update twin's chronotype if we have enough data
    if (peakHour !== undefined && editHours.length >= 10) {
      await prisma.cognitiveTwinRecord.updateMany({
        where: { userId },
        data: {
          energyCurve: {
            notionPeakHour: peakHour,
            notionDataPoints: editHours.length,
          } as any,
        },
      });
    }

    // Upsert task records into Novo for triage
    for (const task of pendingTasks.slice(0, 20)) {
      const existing = await prisma.checklistItem.findFirst({
        where: { userId, sourceId: task.id, source: 'notion' },
      });
      if (!existing) {
        await prisma.checklistItem.create({
          data: {
            userId,
            text: task.title,
            completed: false,
            priority: 'medium',
            source: 'notion',
            sourceId: task.id,
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
          },
        });
      }
    }

    return {
      pagesRead: pages.length,
      tasksFound: pendingTasks.length,
      overdueTasks: overdueTasks.length,
      signalsEmitted,
      peakHour,
    };
  } catch (err) {
    console.error('[NotionPlugin] Error:', err);
    return { pagesRead: 0, tasksFound: 0, overdueTasks: 0, signalsEmitted: 0, error: String(err) };
  }
}
