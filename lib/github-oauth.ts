export const GITHUB_OAUTH_SCOPES = 'read:user repo'

export type GitHubOAuthConfig = {
  clientId: string
  clientSecret?: string
  redirectUri: string
}

export function buildGitHubAuthorizationUrl(
  config: Pick<GitHubOAuthConfig, 'clientId' | 'redirectUri'>,
  state: string,
) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: GITHUB_OAUTH_SCOPES,
    state,
  })
  return `https://github.com/login/oauth/authorize?${params.toString()}`
}

export type GitHubToken = { accessToken: string; tokenType: string; scope: string }

export async function exchangeGitHubCode(
  config: Required<GitHubOAuthConfig>,
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<GitHubToken> {
  const response = await fetcher('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
  })
  if (!response.ok) throw new Error('github_token_exchange_failed')
  const payload = await response.json() as { access_token?: string; token_type?: string; scope?: string }
  if (!payload.access_token) throw new Error('github_token_exchange_failed')
  return {
    accessToken: payload.access_token,
    tokenType: payload.token_type || 'bearer',
    scope: payload.scope || GITHUB_OAUTH_SCOPES,
  }
}
