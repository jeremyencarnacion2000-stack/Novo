/**
 * Todoist API service layer.
 *
 * Unified API v1, using plain fetch. Access tokens come from IntegrationAccount records —
 * Todoist uses its own OAuth 2.0 flow, not NextAuth.
 *
 * Security: this file is server-only. Never import it in client components.
 */

import type { IntegratedTask } from './integration-engine';

const API_BASE = 'https://api.todoist.com/api/v1';
const PAGE_LIMIT = 200;
const MAX_PAGES = 25;
const MAX_PROJECTS_PER_SYNC = 50;

function authHeaders(accessToken: string) {
    return { Authorization: `Bearer ${accessToken}` };
}

// Todoist priority is 1 (normal) to 4 (urgent) — inverted from how most
// people read "priority 1 = most important", which trips up a lot of
// integrations; mapped explicitly rather than left as a raw number.
function mapPriority(p: number): 'low' | 'medium' | 'high' {
    if (p >= 4) return 'high';
    if (p === 1) return 'low';
    return 'medium';
}

function mapTaskToIntegratedTask(task: any): IntegratedTask {
    return {
        id: `todoist:task:${task.id}`,
        text: task.content,
        completed: false, // /tasks only ever returns active (incomplete) tasks
        priority: mapPriority(task.priority),
        source: 'todoist' as any,
        sourceId: task.id,
        dueDate: task.due?.date ? new Date(task.due.date) : undefined,
        metadata: { category: 'todoist' },
    };
}

function readPage(body: unknown): { results: any[]; nextCursor: string | null } {
    if (typeof body !== 'object' || body === null) throw new Error('Todoist response invalid');
    const value = body as Record<string, unknown>;
    if (!Array.isArray(value.results)) throw new Error('Todoist response invalid');
    if (value.next_cursor !== null && value.next_cursor !== undefined
        && (typeof value.next_cursor !== 'string' || !value.next_cursor.trim())) {
        throw new Error('Todoist response invalid');
    }
    return {
        results: value.results,
        nextCursor: typeof value.next_cursor === 'string' ? value.next_cursor : null,
    };
}

async function fetchAllPages(
    endpoint: string,
    accessToken: string,
    query: Record<string, string> = {},
): Promise<any[]> {
    const results: any[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < MAX_PAGES; page++) {
        const url = new URL(`${API_BASE}/${endpoint}`);
        for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
        url.searchParams.set('limit', String(PAGE_LIMIT));
        if (cursor) url.searchParams.set('cursor', cursor);

        const res = await fetch(url, { headers: authHeaders(accessToken) });
        if (!res.ok) throw new Error(`Todoist ${endpoint} failed: ${res.status}`);
        const parsed = readPage(await res.json());
        results.push(...parsed.results);
        if (!parsed.nextCursor) return results;
        if (parsed.nextCursor === cursor) throw new Error('Todoist response invalid');
        cursor = parsed.nextCursor;
    }

    throw new Error(`Todoist ${endpoint} pagination limit exceeded`);
}

export const todoistService = {
    /** Lists the user's projects, for the project picker UI (mirrors Notion's database picker). */
    listProjects: async (accessToken: string) => {
        const projects = await fetchAllPages('projects', accessToken);
        return projects.map(p => ({ id: p.id, title: p.name }));
    },

    /** Fetches all active tasks across the given project IDs. */
    fetchAllTasks: async (accessToken: string, projectIds: string[]): Promise<IntegratedTask[]> => {
        const selectedProjects = [...new Set(projectIds.filter((id) => id.trim()))];
        if (selectedProjects.length === 0 || selectedProjects.length > MAX_PROJECTS_PER_SYNC) {
            throw new Error('Todoist project scope invalid');
        }
        const results = await Promise.all(
            selectedProjects.map(async (projectId) => {
                const tasks = await fetchAllPages('tasks', accessToken, { project_id: projectId });
                if (tasks.some((task) => String(task?.project_id ?? '') !== projectId
                    || typeof task?.content !== 'string')) {
                    throw new Error('Todoist task scope mismatch');
                }
                return tasks.map(mapTaskToIntegratedTask);
            })
        );
        return results.flat();
    },

    /** Marks a task complete in Todoist so checking it off in Novo isn't a local-only fake. */
    closeTask: async (accessToken: string, taskId: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/tasks/${taskId}/close`, {
            method: 'POST',
            headers: authHeaders(accessToken),
        });
        if (!res.ok) throw new Error(`Todoist closeTask failed: ${res.status}`);
    },

    /** Reopens a task in Todoist (unchecking it in Novo). */
    reopenTask: async (accessToken: string, taskId: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/tasks/${taskId}/reopen`, {
            method: 'POST',
            headers: authHeaders(accessToken),
        });
        if (!res.ok) throw new Error(`Todoist reopenTask failed: ${res.status}`);
    },
};
