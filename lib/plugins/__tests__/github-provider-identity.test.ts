/** @jest-environment node */

import { fetchGitHubProviderIdentity } from '@/lib/github-provider-identity'

describe('GitHub provider identity', () => {
  it('uses the authenticated GitHub id/login even when the email is private', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ id: 42, login: 'angel', email: null, avatar_url: 'https://github.test/avatar' }), { status: 200 }))
    await expect(fetchGitHubProviderIdentity('token', fetcher)).resolves.toEqual({
      providerAccountId: '42',
      login: 'angel',
      avatarUrl: 'https://github.test/avatar',
    })
    expect(fetcher).toHaveBeenCalledWith('https://api.github.com/user', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer token' }),
    }))
  })

  it('fails closed when GitHub does not return a stable identity', async () => {
    await expect(fetchGitHubProviderIdentity('token', jest.fn().mockResolvedValue(new Response(JSON.stringify({ login: 'angel' }), { status: 200 })))).rejects.toThrow('github_identity_unavailable')
  })

  it('distinguishes revoked authorization from an unavailable provider', async () => {
    await expect(fetchGitHubProviderIdentity('token', jest.fn().mockResolvedValue(new Response('{}', { status: 401 })))).rejects.toThrow('github_reauthorization_required')
  })
})
