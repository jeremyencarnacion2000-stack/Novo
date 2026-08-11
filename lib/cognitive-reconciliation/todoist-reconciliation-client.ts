import type { TodoistHumanPullResult, TodoistImportedTask } from './todoist-human-reconciliation'

const TODOIST_REST_TASKS = 'https://api.todoist.com/rest/v2/tasks'
const TODOIST_ACTIVITY = 'https://api.todoist.com/sync/v9/activity/get'
const MAX_PROJECTS = 20
const PAGE_LIMIT = 100

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
    const url = new URL(TODOIST_REST_TASKS)
    url.searchParams.set('project_id', projectId)
    url.searchParams.set('limit', String(PAGE_LIMIT))
    const response = await fetchImpl(url, { headers })
    if (!response.ok) throw new Error('todoist_active_pull_failed')
    const rows = jsonArray(await response.json())
    if (rows.length >= PAGE_LIMIT) throw new Error('todoist_active_window_truncated')
    return rows.flatMap((row): TodoistImportedTask[] => {
      if (typeof row !== 'object' || row === null) return []
      const value = row as Record<string, unknown>
      const id = providerId(value.id)
      if (!id || typeof value.content !== 'string') return []
      return [{
        id,
        projectId,
        text: value.content,
        priority: priority(value.priority),
        dueDate: dueDate(value.due),
      }]
    })
  }))

  const completions = cursor ? (await Promise.all(uniqueProjects.map(async (projectId) => {
    const url = new URL(TODOIST_ACTIVITY)
    url.searchParams.set('event_type', 'completed')
    url.searchParams.set('object_type', 'item')
    url.searchParams.set('parent_project_id', projectId)
    url.searchParams.set('since', cursor)
    url.searchParams.set('until', fetchedAt.toISOString())
    url.searchParams.set('limit', String(PAGE_LIMIT))
    const response = await fetchImpl(url, { headers })
    if (!response.ok) throw new Error('todoist_completion_pull_failed')
    const body = await response.json()
    if (typeof body !== 'object' || body === null || !('events' in body)) throw new Error('todoist_response_invalid')
    const events = jsonArray(body.events)
    if (events.length >= PAGE_LIMIT) throw new Error('todoist_completion_window_truncated')
    return events.flatMap((event) => {
      if (typeof event !== 'object' || event === null) return []
      const value = event as Record<string, unknown>
      const eventId = providerId(value.id)
      const taskId = providerId(value.object_id)
      const occurredAt = typeof value.event_date === 'string' ? new Date(value.event_date) : new Date(Number.NaN)
      if (value.object_type !== 'item' || value.event_type !== 'completed' || !eventId || !taskId
        || !Number.isFinite(occurredAt.getTime())) return []
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
