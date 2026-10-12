/**
 * Todoist Plugin — reads the selected Todoist projects through unified API v1.
 * Provider polls become replaceable aggregate observations, not duplicate
 * behavioral events on every heartbeat.
 */

import { prisma } from '@/lib/prisma';
import { getOrCreateTwin } from '@/lib/cognitive/get-or-create-twin';
import { upsertNovoSignals } from '@/lib/cognitive/signal-ledger';
import { withProviderSyncLock } from '@/lib/provider-sync-lock';

const API_BASE = 'https://api.todoist.com/api/v1';
const PAGE_LIMIT = 200;
const MAX_PAGES = 10;
const MAX_SELECTED_PROJECTS = 20;

interface TodoistTask {
  id: string;
  content: string;
  priority: number;
  due?: { date: string; datetime?: string };
  project_id: string;
}

interface TodoistActivity {
  id: string | number;
  object_type: string;
  event_type: string;
  event_date: string;
  parent_project_id?: string | number;
}

interface TodoistSyncResult {
  tasksRead: number;
  overdueTasks: number;
  completedToday: number;
  signalsEmitted: number;
  peakCompletionHour?: number;
  error?: string;
}

function readPage<T>(body: unknown): { results: T[]; nextCursor: string | null } {
  if (typeof body !== 'object' || body === null) throw new Error('todoist_response_invalid');
  const value = body as Record<string, unknown>;
  if (!Array.isArray(value.results)) throw new Error('todoist_response_invalid');
  const cursor = value.next_cursor;
  if (cursor !== null && cursor !== undefined && (typeof cursor !== 'string' || !cursor.trim())) {
    throw new Error('todoist_response_invalid');
  }
  return { results: value.results as T[], nextCursor: typeof cursor === 'string' ? cursor : null };
}

async function fetchPages<T>(
  initialUrl: URL,
  apiToken: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const results: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(initialUrl);
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiToken}` },
      signal,
    });
    if (!res.ok) throw new Error(`todoist_api_${res.status}`);
    const parsed = readPage<T>(await res.json());
    results.push(...parsed.results);
    if (!parsed.nextCursor) return results;
    if (parsed.nextCursor === cursor) throw new Error('todoist_response_invalid');
    cursor = parsed.nextCursor;
  }
  throw new Error('todoist_window_truncated');
}

async function fetchTodoistTasks(
  apiToken: string,
  projectIds: string[],
  signal?: AbortSignal,
): Promise<TodoistTask[]> {
  const tasks = await Promise.all(projectIds.map(async (projectId) => {
    const url = new URL(`${API_BASE}/tasks`);
    url.searchParams.set('project_id', projectId);
    url.searchParams.set('limit', String(PAGE_LIMIT));
    const rows = await fetchPages<TodoistTask>(url, apiToken, signal);
    if (rows.some((task) => String(task.project_id) !== projectId || typeof task.content !== 'string')) {
      throw new Error('todoist_scope_mismatch');
    }
    return rows;
  }));
  return tasks.flat();
}

async function fetchTodoistActivity(
  apiToken: string,
  projectIds: string[],
  now: Date,
  signal?: AbortSignal,
): Promise<TodoistActivity[]> {
  const dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const byProject = await Promise.all(projectIds.map(async (projectId) => {
    const url = new URL(`${API_BASE}/activities`);
    url.searchParams.set('object_type', 'item');
    url.searchParams.set('event_type', 'completed');
    url.searchParams.set('parent_project_id', projectId);
    url.searchParams.set('date_from', dateFrom);
    url.searchParams.set('date_to', now.toISOString());
    url.searchParams.set('limit', String(PAGE_LIMIT));
    try {
      const rows = await fetchPages<TodoistActivity>(url, apiToken, signal);
      if (rows.some((event) => event.parent_project_id !== undefined
        && String(event.parent_project_id) !== projectId)) {
        throw new Error('todoist_scope_mismatch');
      }
      return rows.filter((event) => event.object_type === 'item' && event.event_type === 'completed');
    } catch (error) {
      // Activity history depends on the Todoist plan. A 403 must not prevent
      // the selected active-task snapshot from reaching Novo.
      if (error instanceof Error && error.message === 'todoist_api_403') return [];
      throw error;
    }
  }));
  return byProject.flat();
}

function isOverdue(task: TodoistTask, now: Date) {
  const raw = task.due?.datetime ?? task.due?.date;
  if (!raw) return false;
  const due = new Date(raw);
  return Number.isFinite(due.getTime()) && due < now;
}

export async function syncTodoistPlugin(
  userId: string,
  options: { signal?: AbortSignal } = {},
): Promise<TodoistSyncResult> {
  try {
    const account = await prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId, provider: 'todoist' } },
      select: { accessToken: true, metadata: true },
    });

    if (!account?.accessToken) {
      return { tasksRead: 0, overdueTasks: 0, completedToday: 0, signalsEmitted: 0, error: 'not_connected' };
    }

    const metadata = account.metadata as { projectIds?: unknown } | null;
    const projectIds = Array.isArray(metadata?.projectIds)
      ? [...new Set(metadata.projectIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0))]
        .slice(0, MAX_SELECTED_PROJECTS)
      : [];
    if (projectIds.length === 0) {
      return { tasksRead: 0, overdueTasks: 0, completedToday: 0, signalsEmitted: 0, error: 'scope_not_selected' };
    }

    const now = new Date();
    const [activeTasks, activity] = await Promise.all([
      fetchTodoistTasks(account.accessToken, projectIds, options.signal),
      fetchTodoistActivity(account.accessToken, projectIds, now, options.signal),
    ]);
    const overdueTasks = activeTasks.filter((task) => isOverdue(task, now));
    const today = now.toISOString().split('T')[0];
    const completionDates = activity
      .map((event) => new Date(event.event_date))
      .filter((date) => Number.isFinite(date.getTime()));
    const completedToday = completionDates.filter((date) => date.toISOString().startsWith(today)).length;
    const completionHours = completionDates.map((date) => date.getHours());
    const hourCounts: Record<number, number> = {};
    for (const hour of completionHours) hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
    const peakCompletionHour = completionHours.length > 0
      ? Number(Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0]?.[0])
      : undefined;

    await upsertNovoSignals(userId, [
      {
        source: 'todoist',
        sourceRef: 'selected-projects',
        signalType: 'task_state_observed',
        label: `Todoist observed: ${activeTasks.length} active tasks, ${overdueTasks.length} overdue`,
        observedAt: now,
        reliability: 'direct',
      },
      {
        source: 'todoist',
        sourceRef: 'completion-window',
        signalType: 'completion_activity_observed',
        label: `Todoist observed: ${completionDates.length} completions in 7 days, ${completedToday} today`,
        observedAt: now,
        reliability: 'direct',
      },
    ]);

    const twin = await getOrCreateTwin(userId);
    if (peakCompletionHour !== undefined && completionHours.length >= 5) {
      const existing = (twin.energyCurve as Record<string, unknown> | null) ?? {};
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

    const overdueToSync = overdueTasks.slice(0, 15);
    await withProviderSyncLock(prisma, `novo:checklist-sync:${userId}:todoist`, async (db) => {
      const existingItems = await db.checklistItem.findMany({
        where: {
          userId,
          source: 'todoist',
          sourceId: { in: overdueToSync.map((task) => task.id) },
        },
        select: { id: true, sourceId: true },
      });
      const existingSourceIds = new Set(existingItems.map((item) => item.sourceId));
      const newItems = overdueToSync.filter((task) => !existingSourceIds.has(task.id));

      // Provider data is the source of truth for imported rows. Updating an
      // existing item prevents stale titles, priorities, and due dates from
      // becoming permanent Twin context after a task changes in Todoist.
      for (const task of overdueToSync.filter((candidate) => existingSourceIds.has(candidate.id))) {
        await db.checklistItem.updateMany({
          where: { userId, source: 'todoist', sourceId: task.id },
          data: {
            text: task.content,
            completed: false,
            priority: task.priority >= 3 ? 'high' : task.priority === 2 ? 'medium' : 'low',
            dueDate: task.due?.datetime
              ? new Date(task.due.datetime)
              : task.due?.date ? new Date(task.due.date) : null,
          },
        });
      }

      if (newItems.length > 0) {
        await db.checklistItem.createMany({
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
    });

    return {
      tasksRead: activeTasks.length,
      overdueTasks: overdueTasks.length,
      completedToday,
      signalsEmitted: 2,
      peakCompletionHour,
    };
  } catch {
    console.error('[TodoistPlugin] Provider read failed');
    return { tasksRead: 0, overdueTasks: 0, completedToday: 0, signalsEmitted: 0, error: 'unavailable' };
  }
}
