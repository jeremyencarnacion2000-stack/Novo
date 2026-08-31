import { pullTodoistSelectedProjects } from '../todoist-reconciliation-client'

function response(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response
}

describe('Todoist selected-project reconciliation client', () => {
  it('uses unified API v1, explicit project scope and date-bounded completion activity', async () => {
    const requested: string[] = []
    const fetchImpl = jest.fn(async (input: string | URL | Request) => {
      const url = String(input)
      requested.push(url)
      if (url.includes('/api/v1/tasks')) {
        return response({
          results: [{ id: 'task-1', content: 'One', priority: 4, project_id: 'project-1', due: null }],
          next_cursor: null,
        })
      }
      return response({
        results: [{
          id: 'event-1', object_type: 'item', event_type: 'completed', object_id: 'task-1',
          parent_project_id: 'project-1', event_date: '2026-08-11T12:00:00.000Z',
        }],
        next_cursor: null,
      })
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
    expect(requested[0]).toContain('/api/v1/tasks')
    expect(requested[1]).toContain('/api/v1/activities')
    expect(requested[1]).toContain('date_from=2026-08-11T11%3A00%3A00.000Z')
    expect(requested[1]).toContain('date_to=2026-08-11T12%3A01%3A00.000Z')
    expect(result).toMatchObject({
      cursorAfter: '2026-08-11T12:01:00.000Z',
      activeTasks: [{ id: 'task-1', projectId: 'project-1', text: 'One', priority: 'high', dueDate: null }],
      completions: [{ eventId: 'event-1', taskId: 'task-1', projectId: 'project-1' }],
    })
  })

  it('follows cursor pagination without confusing provider cursors with Novo time cursors', async () => {
    const fetchImpl = jest.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/tasks')) {
        return url.searchParams.get('cursor')
          ? response({ results: [{ id: 'task-2', content: 'Two', priority: 1, project_id: 'project-1' }], next_cursor: null })
          : response({ results: [{ id: 'task-1', content: 'One', priority: 4, project_id: 'project-1' }], next_cursor: 'provider-page-2' })
      }
      return response({ results: [], next_cursor: null })
    })

    const result = await pullTodoistSelectedProjects({
      accessToken: 'token', projectIds: ['project-1'], cursor: null,
      fetchImpl: fetchImpl as typeof fetch,
    })

    expect(result.activeTasks.map((task) => task.id)).toEqual(['task-1', 'task-2'])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('fails the whole bounded pull when one selected project fails', async () => {
    const fetchImpl = jest.fn(async (input: string | URL | Request) => (
      String(input).includes('project-b')
        ? response({}, false, 503)
        : response({ results: [], next_cursor: null })
    ))

    await expect(pullTodoistSelectedProjects({
      accessToken: 'token', projectIds: ['project-a', 'project-b'], cursor: null,
      fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toThrow('todoist_active_pull_failed')
  })

  it('rejects a provider cursor loop before returning observations', async () => {
    const fetchImpl = jest.fn(async (input: string | URL | Request) => (
      String(input).includes('/api/v1/tasks')
        ? response({ results: [], next_cursor: null })
        : response({ results: [], next_cursor: 'same-cursor' })
    ))

    await expect(pullTodoistSelectedProjects({
      accessToken: 'token', projectIds: ['project-1'], cursor: '2026-08-11T11:00:00.000Z',
      fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toThrow('todoist_response_invalid')
  })

  it('rejects a malformed or cross-project task row', async () => {
    const fetchImpl = jest.fn(async () => response({
      results: [{ id: 'task-1', content: 'Wrong lane', project_id: 'project-2' }],
      next_cursor: null,
    }))

    await expect(pullTodoistSelectedProjects({
      accessToken: 'token', projectIds: ['project-1'], cursor: null,
      fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toThrow('todoist_response_invalid')
  })

  it.each([
    [{ object_type: 'item', event_type: 'completed', object_id: 'task-1', event_date: '2026-08-11T12:00:00.000Z' }],
    [{ id: 'event-1', object_type: 'item', event_type: 'completed', event_date: '2026-08-11T12:00:00.000Z' }],
    [{ id: 'event-1', object_type: 'item', event_type: 'completed', object_id: 'task-1', event_date: 'not-a-date' }],
  ])('rejects a malformed completion-capable event row', async (events) => {
    const fetchImpl = jest.fn(async (input: string | URL | Request) => (
      String(input).includes('/api/v1/tasks')
        ? response({ results: [], next_cursor: null })
        : response({ results: events, next_cursor: null })
    ))

    await expect(pullTodoistSelectedProjects({
      accessToken: 'token', projectIds: ['project-1'], cursor: '2026-08-11T11:00:00.000Z',
      fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toThrow('todoist_response_invalid')
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
