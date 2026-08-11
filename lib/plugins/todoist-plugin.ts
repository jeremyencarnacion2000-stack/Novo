/**
 * Todoist Plugin — syncs tasks from Todoist REST API v2.
 * Maps overdue/deferred tasks → BehavioralSignals.
 * Learns peak productivity window from task completion timestamps.
 */

import { prisma } from '@/lib/prisma';
import { getOrCreateTwin } from '@/lib/cognitive/get-or-create-twin';

interface TodoistTask {
  id: string;
  content: string;
  description: string;
  is_completed: boolean;
  priority: number; // 1=normal, 2=medium, 3=high, 4=urgent
  due?: { date: string; datetime?: string };
  created_at: string;
  project_id?: string;
  labels: string[];
}

interface TodoistActivity {
  id: number;
  object_type: string;
  event_type: string;
  event_date: string;
}

interface TodoistSyncResult {
  tasksRead: number;
  overdueTasks: number;
  completedToday: number;
  signalsEmitted: number;
  peakCompletionHour?: number;
  error?: string;
}

async function fetchTodoistTasks(apiToken: string): Promise<TodoistTask[]> {
  const res = await fetch('https://api.todoist.com/rest/v2/tasks?filter=overdue', {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) throw new Error(`Todoist API ${res.status}`);
  return res.json();
}

async function fetchTodoistActivity(apiToken: string): Promise<TodoistActivity[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `https://api.todoist.com/sync/v9/activity/get?event_type=completed&since=${since}&limit=50`,
    { headers: { Authorization: `Bearer ${apiToken}` } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.events ?? [];
}

export async function syncTodoistPlugin(userId: string): Promise<TodoistSyncResult> {
  try {
    const account = await prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId, provider: 'todoist' } },
      select: { accessToken: true, metadata: true },
    });

    if (!account?.accessToken) {
      return { tasksRead: 0, overdueTasks: 0, completedToday: 0, signalsEmitted: 0, error: 'not_connected' };
    }

    const [overdueTasks, activity] = await Promise.all([
      fetchTodoistTasks(account.accessToken),
      fetchTodoistActivity(account.accessToken),
    ]);

    const today = new Date().toISOString().split('T')[0];
    const completedToday = activity.filter((a) => a.event_date.startsWith(today)).length;

    // Learn peak completion hour from activity
    const completionHours = activity.map((a) => new Date(a.event_date).getHours());
    const hourCounts: Record<number, number> = {};
    for (const h of completionHours) hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    const peakCompletionHour = completionHours.length > 0
      ? Number(Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0]?.[0])
      : undefined;

    let signalsEmitted = 0;
    const twin = await getOrCreateTwin(userId);

    // Emit deferred signal if ≥2 overdue
    if (overdueTasks.length >= 2) {
      await prisma.behavioralSignal.create({
        data: {
          userId,
          twinId: twin.id,
          signal: 'task_deferred',
          occurredAt: new Date(),
          metadata: {
            source: 'todoist',
            overdueCount: overdueTasks.length,
            titles: overdueTasks.slice(0, 5).map((t) => t.content),
            highPriority: overdueTasks.filter((t) => t.priority >= 3).length,
          },
        },
      });
      signalsEmitted++;
    }

    // Emit task_completed signals for today's completions
    if (completedToday > 0) {
      await prisma.behavioralSignal.create({
        data: {
          userId,
          twinId: twin.id,
          signal: 'task_completed',
          occurredAt: new Date(),
          metadata: { source: 'todoist', count: completedToday },
        },
      });
      signalsEmitted++;
    }

    // Update twin with Todoist productivity pattern
    if (peakCompletionHour !== undefined && completionHours.length >= 5) {
      if (twin) {
        const existing = (twin.energyCurve as any) ?? {};
        await prisma.cognitiveTwinRecord.update({
          where: { userId },
          data: {
            energyCurve: {
              ...existing,
              todoistPeakHour: peakCompletionHour,
              todoistDataPoints: completionHours.length,
            },
          },
        });
      }
    }

    // Sync overdue tasks with two database round trips instead of one pair
    // of queries for each task.
    const overdueToSync = overdueTasks.slice(0, 15);
    const existingItems = await prisma.checklistItem.findMany({
      where: {
        userId,
        source: 'todoist',
        sourceId: { in: overdueToSync.map((task) => task.id) },
      },
      select: { sourceId: true },
    });
    const existingSourceIds = new Set(existingItems.map((item) => item.sourceId));
    const newItems = overdueToSync.filter((task) => !existingSourceIds.has(task.id));

    if (newItems.length > 0) {
      await prisma.checklistItem.createMany({
        data: newItems.map((task) => ({
          userId,
          text: task.content,
          completed: false,
          priority: task.priority >= 3 ? 'high' : task.priority === 2 ? 'medium' : 'low',
          source: 'todoist',
          sourceId: task.id,
          dueDate: task.due?.datetime
            ? new Date(task.due.datetime)
            : task.due?.date ? new Date(task.due.date) : null,
        })),
      });
    }

    return {
      tasksRead: overdueTasks.length,
      overdueTasks: overdueTasks.length,
      completedToday,
      signalsEmitted,
      peakCompletionHour,
    };
  } catch (err) {
    console.error('[TodoistPlugin] Error:', err);
    return { tasksRead: 0, overdueTasks: 0, completedToday: 0, signalsEmitted: 0, error: String(err) };
  }
}
