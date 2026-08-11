import { pullTodoistSelectedProjects } from '../todoist-reconciliation-client'

function response(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response
}

describe('Todoist selected-project reconciliation client', () => {
  it('pulls only the explicit selected projects and normalizes completion-capable activity', async () => {
    const requested: string[] = []
    const fetchImpl = jest.fn(async (input: string | URL | Request) => {
      const url = String(input)
      requested.push(url)
      if (url.includes('/rest/v2/tasks')) {
        return response([{ id: 'task-1', content: 'One', priority: 4, project_id: 'project-1', due: null }])
      }
      return response({ events: [{
        id: 'event-1', object_type: 'item', event_type: 'completed', object_id: 'task-1',
        event_date: '2026-08-11T12:00:00.000Z',
      }] })
    })

    const result = await pullTodoistSelectedProjects({
      accessToken: 'token',
      projectIds: ['project-1'],
      cursor: '2026-08-11T11:00:00.000Z',
      fetchImpl: fetchImpl as typeof fetch,
      now: () => new Date('2026-08-11T12:01:00.000Z'),
    })

    expect(requested).toHaveLength(2)
    expect(requested.every((url) => url.includes('project-1'))).toBe(true)
    expect(result).toMatchObject({
      cursorAfter: '2026-08-11T12:01:00.000Z',
      activeTasks: [{ id: 'task-1', projectId: 'project-1', text: 'One', priority: 'high', dueDate: null }],
      completions: [{ eventId: 'event-1', taskId: 'task-1', projectId: 'project-1' }],
    })
  })

  it('fails the whole bounded pull when one selected project fails', async () => {
    const fetchImpl = jest.fn(async (input: string | URL | Request) => (
      String(input).includes('project-b') ? response({}, false, 503) : response([])
    ))

    await expect(pullTodoistSelectedProjects({
      accessToken: 'token', projectIds: ['project-a', 'project-b'], cursor: null,
      fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toThrow('todoist_active_pull_failed')
  })

  it('rejects a truncated completion window before returning observations', async () => {
    const events = Array.from({ length: 100 }, (_, index) => ({
      id: `event-${index}`, object_type: 'item', event_type: 'completed', object_id: `task-${index}`,
      event_date: '2026-08-11T12:00:00.000Z',
    }))
    const fetchImpl = jest.fn(async (input: string | URL | Request) => (
      String(input).includes('/rest/v2/tasks') ? response([]) : response({ events })
    ))

    await expect(pullTodoistSelectedProjects({
      accessToken: 'token', projectIds: ['project-1'], cursor: '2026-08-11T11:00:00.000Z',
      fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toThrow('todoist_completion_window_truncated')
  })

  it('rejects an unbounded or malformed selected scope before fetch', async () => {
    const fetchImpl = jest.fn()
    await expect(pullTodoistSelectedProjects({
      accessToken: 'token', projectIds: [], cursor: null, fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toThrow('todoist_scope_invalid')
    await expect(pullTodoistSelectedProjects({
      accessToken: 'token', projectIds: Array.from({ length: 21 }, (_, i) => `p-${i}`), cursor: null,
      fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toThrow('todoist_scope_invalid')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
