/**
 * Todoist API service layer.
 *
 * REST API v2, plain fetch (no official SDK dependency needed for the two
 * endpoints this uses). Access tokens come from IntegrationAccount records —
 * Todoist uses its own OAuth 2.0 flow, not NextAuth.
 *
 * Security: this file is server-only. Never import it in client components.
 */

import type { IntegratedTask } from './integration-engine';

const API_BASE = 'https://api.todoist.com/rest/v2';

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

export const todoistService = {
    /** Lists the user's projects, for the project picker UI (mirrors Notion's database picker). */
    listProjects: async (accessToken: string) => {
        const res = await fetch(`${API_BASE}/projects`, { headers: authHeaders(accessToken) });
        if (!res.ok) throw new Error(`Todoist listProjects failed: ${res.status}`);
        const projects = await res.json();
        return (projects as any[]).map(p => ({ id: p.id, title: p.name }));
    },

    /** Fetches all active tasks across the given project IDs. */
    fetchAllTasks: async (accessToken: string, projectIds: string[]): Promise<IntegratedTask[]> => {
        const results = await Promise.all(
            projectIds.map(async (projectId) => {
                const res = await fetch(`${API_BASE}/tasks?project_id=${projectId}`, { headers: authHeaders(accessToken) });
                if (!res.ok) return [];
                const tasks = await res.json();
                return (tasks as any[]).map(mapTaskToIntegratedTask);
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
