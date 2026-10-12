/**
 * Notion Plugin — fetches pages/tasks from Notion API and maps them into
 * durable aggregate observations so the Cognitive Twin can learn from them.
 */

import { prisma } from '@/lib/prisma';
import { getOrCreateTwin } from '@/lib/cognitive/get-or-create-twin';
import { upsertNovoSignals } from '@/lib/cognitive/signal-ledger';
import { withProviderSyncLock } from '@/lib/provider-sync-lock';

const MAX_SELECTED_DATABASES = 20;

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

async function fetchNotionPages(accessToken: string, databaseId: string, signal?: AbortSignal): Promise<NotionPage[]> {
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ page_size: 50 }),
    signal,
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

export async function syncNotionPlugin(userId: string, options: { signal?: AbortSignal } = {}): Promise<NotionSyncResult> {
  try {
    const account = await prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId, provider: 'notion' } },
      select: { accessToken: true, metadata: true },
    });

    if (!account?.accessToken) {
      return { pagesRead: 0, tasksFound: 0, overdueTasks: 0, signalsEmitted: 0, error: 'not_connected' };
    }

    const meta = account.metadata as { databaseIds?: unknown } | null;
    const databaseIds = Array.isArray(meta?.databaseIds)
      ? meta.databaseIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    if (databaseIds.length === 0) {
      return { pagesRead: 0, tasksFound: 0, overdueTasks: 0, signalsEmitted: 0, error: 'scope_not_selected' };
    }

    const pages = (await Promise.all(
      [...new Set(databaseIds)].slice(0, MAX_SELECTED_DATABASES)
        .map((databaseId) => fetchNotionPages(account.accessToken, databaseId, options.signal)),
    )).flat();

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

    // Polling observes a replaceable aggregate snapshot. It must not create a
    // new behavioral event every 15 minutes for the same selected databases.
    await upsertNovoSignals(userId, [{
      source: 'notion',
      sourceRef: 'selected-databases',
      signalType: 'task_state_observed',
      label: `Notion observed: ${pendingTasks.length} pending tasks, ${overdueTasks.length} overdue`,
      observedAt: now,
      reliability: 'direct',
    }]);

    const twin = await getOrCreateTwin(userId);

    // Update twin's chronotype if we have enough data
    if (peakHour !== undefined && editHours.length >= 10) {
      const existing = (twin.energyCurve as Record<string, unknown> | null) ?? {};
      await prisma.cognitiveTwinRecord.update({
        where: { userId },
        data: {
          energyCurve: {
            ...existing,
            notionPeakHour: peakHour,
            notionDataPoints: editHours.length,
          },
        },
      });
    }

    // Upsert task records into Novo for triage. The advisory lock closes the
    // find-then-create race when a heartbeat and a manual sync overlap.
    await withProviderSyncLock(prisma, `novo:checklist-sync:${userId}:notion`, async (db) => {
      for (const task of pendingTasks.slice(0, 20)) {
        const existing = await db.checklistItem.findFirst({
          where: { userId, sourceId: task.id, source: 'notion' },
        });
        if (existing) {
          await db.checklistItem.updateMany({
            where: { id: existing.id, userId, source: 'notion', sourceId: task.id },
            data: {
              text: task.title,
              completed: false,
              dueDate: task.dueDate ? new Date(task.dueDate) : null,
            },
          });
        } else {
          await db.checklistItem.create({
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
    });

    return {
      pagesRead: pages.length,
      tasksFound: pendingTasks.length,
      overdueTasks: overdueTasks.length,
      signalsEmitted: 1,
      peakHour,
    };
  } catch {
    console.error('[NotionPlugin] Provider read failed');
    return { pagesRead: 0, tasksFound: 0, overdueTasks: 0, signalsEmitted: 0, error: 'unavailable' };
  }
}
