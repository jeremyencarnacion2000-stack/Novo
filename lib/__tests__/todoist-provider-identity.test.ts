import { fetchTodoistProviderIdentity, getCanonicalTodoistTask, isTodoistAmbientEligible } from '../todoist-provider-identity'

describe('Todoist provider identity', () => {
  it('accepts only server-returned stable id', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 123, email: 'private@example.com' }) })
    await expect(fetchTodoistProviderIdentity('secret', fetcher as any)).resolves.toEqual({ providerAccountId: '123' })
    expect(fetcher).toHaveBeenCalledWith('https://api.todoist.com/api/v1/user', expect.objectContaining({ headers: { Authorization: 'Bearer secret' } }))
  })
  it('fails closed for malformed or unavailable identity', async () => {
    await expect(fetchTodoistProviderIdentity('x', jest.fn().mockResolvedValue({ ok: false }) as any)).rejects.toThrow('todoist_identity_fetch_failed')
    await expect(fetchTodoistProviderIdentity('x', jest.fn().mockResolvedValue({ ok: true, json: async () => ({ email: 'x' }) }) as any)).rejects.toThrow('todoist_identity_invalid')
  })

  it('uses the current v1 identity endpoint', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'abc' }) })
    await fetchTodoistProviderIdentity('secret', fetcher as any)
    expect(fetcher.mock.calls[0][0]).toBe('https://api.todoist.com/api/v1/user')
  })

  it('fetches canonical task and keeps 404 distinct from completion', async () => {
    const fetcher = jest.fn().mockResolvedValue({ status: 404, ok: false, json: async () => ({}) })
    await expect(getCanonicalTodoistTask('x', 'task', fetcher as any)).resolves.toBeNull()
    expect(fetcher.mock.calls[0][0]).toContain('/api/v1/tasks/task')
  })

  it('fails ambient eligibility closed for legacy or disconnected connections', () => {
    expect(isTodoistAmbientEligible({ userId: 'u', expectedUserId: 'u', provider: 'todoist', accessToken: 'x', providerAccountId: null })).toBe(false)
    expect(isTodoistAmbientEligible({ userId: 'u', expectedUserId: 'u', provider: 'todoist', accessToken: 'x', providerAccountId: 'p', status: 'disconnected' })).toBe(false)
    expect(isTodoistAmbientEligible({ userId: 'u', expectedUserId: 'u', provider: 'todoist', accessToken: 'x', providerAccountId: 'p', status: 'active' })).toBe(true)
  })
})
