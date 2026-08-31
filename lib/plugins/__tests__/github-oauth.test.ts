/** @jest-environment node */

import { buildGitHubAuthorizationUrl, exchangeGitHubCode } from '@/lib/github-oauth'

describe('GitHub OAuth helpers', () => {
  it('builds a least-privilege authorization URL', () => {
    const url = buildGitHubAuthorizationUrl({ clientId: 'client', redirectUri: 'https://novo.test/api/integration/github/callback' }, 'state-value')
    expect(url).toContain('https://github.com/login/oauth/authorize?')
    expect(url).toContain('client_id=client')
    expect(url).toContain('scope=read%3Auser+repo')
    expect(url).toContain('state=state-value')
  })

  it('exchanges a code without exposing provider response details', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'token', token_type: 'bearer', scope: 'read:user,repo' }), { status: 200 }))
    await expect(exchangeGitHubCode({ clientId: 'client', clientSecret: 'secret', redirectUri: 'https://novo.test/callback' }, 'code', fetcher)).resolves.toEqual({ accessToken: 'token', tokenType: 'bearer', scope: 'read:user,repo' })
    expect(fetcher).toHaveBeenCalledWith('https://github.com/login/oauth/access_token', expect.objectContaining({ method: 'POST' }))
  })

  it('fails closed when the token response has no access token', async () => {
    await expect(exchangeGitHubCode({ clientId: 'client', clientSecret: 'secret', redirectUri: 'https://novo.test/callback' }, 'code', jest.fn().mockResolvedValue(new Response('{}', { status: 200 })))).rejects.toThrow('github_token_exchange_failed')
  })
})
