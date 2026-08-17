export const TODOIST_IDENTITY_URL = 'https://api.todoist.com/api/v1/user';

export type TodoistProviderIdentity = { providerAccountId: string };

/** Fetches identity from Todoist, never from client/OAuth state. */
export async function fetchTodoistProviderIdentity(accessToken: string, fetcher: typeof fetch = fetch): Promise<TodoistProviderIdentity> {
  if (!accessToken) throw new Error('todoist_identity_missing_token');
  const response = await fetcher(TODOIST_IDENTITY_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error('todoist_identity_fetch_failed');
  const body: unknown = await response.json();
  const id = typeof body === 'object' && body !== null && 'id' in body ? (body as { id?: unknown }).id : undefined;
  if ((typeof id !== 'string' && typeof id !== 'number') || String(id).trim() === '') throw new Error('todoist_identity_invalid');
  return { providerAccountId: String(id) };
}

export type TodoistCanonicalTask = {
  id: string;
  is_completed: boolean;
  completed_at?: string | null;
  updated_at?: string | null;
  project_id?: string | null;
};

/** Fetch one task from the current Todoist v1 API. Absence is not completion. */
export async function getCanonicalTodoistTask(accessToken: string, taskId: string, fetcher: typeof fetch = fetch): Promise<TodoistCanonicalTask | null> {
  if (!accessToken || !taskId) throw new Error('todoist_task_invalid_input');
  const response = await fetcher(`https://api.todoist.com/api/v1/tasks/${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('todoist_task_fetch_failed');
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null || typeof (body as any).id !== 'string' || typeof (body as any).is_completed !== 'boolean') throw new Error('todoist_task_invalid');
  return body as TodoistCanonicalTask;
}

export function isTodoistAmbientEligible(connection: { userId: string; expectedUserId?: string; provider: string; providerAccountId?: string | null; accessToken?: string | null; status?: string | null; syncStatus?: string | null }): boolean {
  return connection.userId === connection.expectedUserId && connection.provider === 'todoist' && Boolean(connection.providerAccountId && connection.accessToken) && !['disconnected', 'revoked', 'reauth_required'].includes(String(connection.status ?? connection.syncStatus ?? '').toLowerCase());
}
