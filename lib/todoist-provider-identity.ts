const TODOIST_IDENTITY_URL = 'https://api.todoist.com/sync/v9/user';

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
