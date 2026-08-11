import { fetchTodoistProviderIdentity } from '../todoist-provider-identity'

describe('Todoist provider identity', () => {
  it('accepts only server-returned stable id', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 123, email: 'private@example.com' }) })
    await expect(fetchTodoistProviderIdentity('secret', fetcher as any)).resolves.toEqual({ providerAccountId: '123' })
    expect(fetcher).toHaveBeenCalledWith('https://api.todoist.com/sync/v9/user', expect.objectContaining({ headers: { Authorization: 'Bearer secret' } }))
  })
  it('fails closed for malformed or unavailable identity', async () => {
    await expect(fetchTodoistProviderIdentity('x', jest.fn().mockResolvedValue({ ok: false }) as any)).rejects.toThrow('todoist_identity_fetch_failed')
    await expect(fetchTodoistProviderIdentity('x', jest.fn().mockResolvedValue({ ok: true, json: async () => ({ email: 'x' }) }) as any)).rejects.toThrow('todoist_identity_invalid')
  })
})
