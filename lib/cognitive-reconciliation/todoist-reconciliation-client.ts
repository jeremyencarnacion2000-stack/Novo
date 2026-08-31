import type { TodoistHumanPullResult, TodoistImportedTask } from './todoist-human-reconciliation'

const TODOIST_TASKS = 'https://api.todoist.com/api/v1/tasks'
const TODOIST_ACTIVITY = 'https://api.todoist.com/api/v1/activities'
const MAX_PROJECTS = 20
const PAGE_LIMIT = 100
const MAX_PAGES_PER_PROJECT = 20

type PullInput = {
  accessToken: string
  projectIds: string[]
  cursor: string | null
  fetchImpl?: typeof fetch
  now?: () => Date
}

function providerId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value
    : typeof value === 'number' && Number.isFinite(value) ? String(value)
      : null
}

function priority(value: unknown): TodoistImportedTask['priority'] {
  return value === 4 ? 'high' : value === 1 ? 'low' : 'medium'
}

function dueDate(value: unknown) {
  if (typeof value !== 'object' || value === null || !('date' in value) || typeof value.date !== 'string') return null
  const parsed = new Date(value.date)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function jsonArray(value: unknown) {
  if (!Array.isArray(value)) throw new Error('todoist_response_invalid')
  return value
}

function nextCursor(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || !value.trim()) throw new Error('todoist_response_invalid')
  return value
}

function cursorPage(body: unknown) {
  if (typeof body !== 'object' || body === null || !('results' in body)) {
    throw new Error('todoist_response_invalid')
  }
  const value = body as Record<string, unknown>
  return {
    rows: jsonArray(value.results),
    nextCursor: nextCursor(value.next_cursor),
  }
}

async function pullCursorPages({
  initialUrl,
  headers,
  fetchImpl,
  failure,
  truncated,
}: {
  initialUrl: URL
  headers: { Authorization: string }
  fetchImpl: typeof fetch
  failure: string
  truncated: string
}) {
  const rows: unknown[] = []
  let providerCursor: string | null = null

  for (let page = 0; page < MAX_PAGES_PER_PROJECT; page++) {
    const url = new URL(initialUrl)
    if (providerCursor) url.searchParams.set('cursor', providerCursor)
    const response = await fetchImpl(url, { headers })
    if (!response.ok) throw new Error(failure)

    const result = cursorPage(await response.json())
    rows.push(...result.rows)
    if (!result.nextCursor) return rows
    if (result.nextCursor === providerCursor) throw new Error('todoist_response_invalid')
    providerCursor = result.nextCursor
  }

  throw new Error(truncated)
}

export async function pullTodoistSelectedProjects({
  accessToken,
  projectIds,
  cursor,
  fetchImpl = fetch,
  now = () => new Date(),
}: PullInput): Promise<TodoistHumanPullResult> {
  const uniqueProjects = [...new Set(projectIds)]
  if (!accessToken || uniqueProjects.length === 0 || uniqueProjects.length > MAX_PROJECTS
    || uniqueProjects.some((id) => !id.trim())) {
    throw new Error('todoist_scope_invalid')
  }

  const fetchedAt = now()
  const headers = { Authorization: `Bearer ${accessToken}` }
  const activeByProject = await Promise.all(uniqueProjects.map(async (projectId) => {
    const url = new URL(TODOIST_TASKS)
    url.searchParams.set('project_id', projectId)
    url.searchParams.set('limit', String(PAGE_LIMIT))
    const rows = await pullCursorPages({
      initialUrl: url,
      headers,
      fetchImpl,
      failure: 'todoist_active_pull_failed',
      truncated: 'todoist_active_window_truncated',
    })
    return rows.map((row): TodoistImportedTask => {
      if (typeof row !== 'object' || row === null) throw new Error('todoist_response_invalid')
      const value = row as Record<string, unknown>
      const id = providerId(value.id)
      const rowProjectId = providerId(value.project_id)
      if (!id || rowProjectId !== projectId || typeof value.content !== 'string') {
        throw new Error('todoist_response_invalid')
      }
      return {
        id,
        projectId: rowProjectId,
        text: value.content,
        priority: priority(value.priority),
        dueDate: dueDate(value.due),
      }
    })
  }))

  const completions = cursor ? (await Promise.all(uniqueProjects.map(async (projectId) => {
    const url = new URL(TODOIST_ACTIVITY)
    url.searchParams.set('event_type', 'completed')
    url.searchParams.set('object_type', 'item')
    url.searchParams.set('parent_project_id', projectId)
    url.searchParams.set('date_from', cursor)
    url.searchParams.set('date_to', fetchedAt.toISOString())
    url.searchParams.set('limit', String(PAGE_LIMIT))
    const events = await pullCursorPages({
      initialUrl: url,
      headers,
      fetchImpl,
      failure: 'todoist_completion_pull_failed',
      truncated: 'todoist_completion_window_truncated',
    })
    return events.flatMap((event) => {
      if (typeof event !== 'object' || event === null) return []
      const value = event as Record<string, unknown>
      if (value.object_type !== 'item' || value.event_type !== 'completed') return []
      const eventId = providerId(value.id)
      const taskId = providerId(value.object_id)
      const eventProjectId = providerId(value.parent_project_id)
      const occurredAt = typeof value.event_date === 'string' ? new Date(value.event_date) : new Date(Number.NaN)
      if (!eventId || !taskId || (eventProjectId !== null && eventProjectId !== projectId)
        || !Number.isFinite(occurredAt.getTime())) {
        throw new Error('todoist_response_invalid')
      }
      return [{ eventId, taskId, projectId, occurredAt }]
    })
  }))).flat() : []

  return {
    fetchedAt,
    cursorAfter: fetchedAt.toISOString(),
    activeTasks: activeByProject.flat(),
    completions,
  }
}
