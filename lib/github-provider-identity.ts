export type GitHubProviderIdentity = {
  providerAccountId: string
  login: string
  avatarUrl: string | null
}

type GitHubUserPayload = {
  id?: number | string
  login?: string
  avatar_url?: string | null
}

export async function fetchGitHubProviderIdentity(
  accessToken: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<GitHubProviderIdentity> {
  const response = await fetcher('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal,
  })
  if (response.status === 401 || response.status === 403) throw new Error('github_reauthorization_required')
  if (!response.ok) throw new Error('github_identity_unavailable')
  const payload = await response.json() as GitHubUserPayload
  if ((typeof payload.id !== 'number' && typeof payload.id !== 'string') || !String(payload.id) || typeof payload.login !== 'string' || !payload.login.trim()) {
    throw new Error('github_identity_unavailable')
  }
  return {
    providerAccountId: String(payload.id),
    login: payload.login.trim(),
    avatarUrl: typeof payload.avatar_url === 'string' ? payload.avatar_url : null,
  }
}
