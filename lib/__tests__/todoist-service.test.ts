/** @jest-environment node */

import { todoistService } from '../todoist'

function response(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response
}

describe('Todoist API v1 service', () => {
  afterEach(() => jest.restoreAllMocks())

  it('paginates projects and active tasks through the unified API', async () => {
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/projects')) {
        return url.searchParams.get('cursor')
          ? response({ results: [{ id: 'p2', name: 'Second' }], next_cursor: null })
          : response({ results: [{ id: 'p1', name: 'First' }], next_cursor: 'page-2' })
      }
      return response({
        results: [{ id: 't1', content: 'Task', project_id: 'p1', priority: 4, due: null }],
        next_cursor: null,
      })
    }) as jest.Mock

    await expect(todoistService.listProjects('token')).resolves.toEqual([
      { id: 'p1', title: 'First' }, { id: 'p2', title: 'Second' },
    ])
    await expect(todoistService.fetchAllTasks('token', ['p1'])).resolves.toEqual([
      expect.objectContaining({ id: 'todoist:task:t1', text: 'Task', sourceId: 't1', priority: 'high' }),
    ])
    expect((global.fetch as jest.Mock).mock.calls.every(([input]) => String(input).includes('/api/v1/'))).toBe(true)
  })

  it('fails closed if Todoist returns a task from a different project', async () => {
    global.fetch = jest.fn(async () => response({
      results: [{ id: 't1', content: 'Wrong lane', project_id: 'p2', priority: 1 }],
      next_cursor: null,
    })) as jest.Mock

    await expect(todoistService.fetchAllTasks('token', ['p1'])).rejects.toThrow('scope mismatch')
  })
})
