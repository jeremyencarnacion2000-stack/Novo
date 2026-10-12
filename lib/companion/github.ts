export type GitHubDeveloperRepositorySummary = {
  repository: string
  openPullRequests: number
  requestedReviewers: number
  latestReviewState: 'approved' | 'changes_requested' | 'commented' | 'pending' | 'none'
  ci: { passed: number; failed: number; pending: number }
  pullRequests?: {number:number;title:string}[]
}

type Fetcher = typeof fetch

async function requestJson(url: string, token: string, fetcher: Fetcher): Promise<unknown> {
  let response: Response
  try {
    response = await fetcher(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new Error('provider_unavailable')
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error('provider_auth_required')
    if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') throw new Error('provider_rate_limited')
    if (response.status === 403 || response.status === 404) throw new Error('provider_permission_denied')
    throw new Error('provider_unavailable')
  }

  try {
    return await response.json() as unknown
  } catch {
    throw new Error('provider_unavailable')
  }
}

type GitHubRepo = { full_name: string; default_branch: string }

function parseRepositories(payload: unknown): GitHubRepo[] {
  if (!Array.isArray(payload)) throw new Error('provider_unavailable')
  return payload.flatMap((value) => {
    if (!value || typeof value !== 'object') return []
    const repo = value as Record<string, unknown>
    if (typeof repo.full_name !== 'string' || typeof repo.default_branch !== 'string') return []
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo.full_name)) return []
    return [{ full_name: repo.full_name.slice(0, 200), default_branch: repo.default_branch.slice(0, 200) }]
  }).slice(0, 5)
}

function repoPath(fullName: string): string {
  return fullName.split('/').map(encodeURIComponent).join('/')
}

function latestReviewState(reviews: unknown, hasRequests: boolean): GitHubDeveloperRepositorySummary['latestReviewState'] {
  if (!Array.isArray(reviews) || reviews.length === 0) return hasRequests ? 'pending' : 'none'
  const valid = reviews.flatMap((value) => {
    if (!value || typeof value !== 'object') return []
    const review = value as Record<string, unknown>
    if (typeof review.state !== 'string') return []
    return [{ state: review.state.toUpperCase(), submittedAt: typeof review.submitted_at === 'string' ? review.submitted_at : '' }]
  }).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

  switch (valid[0]?.state) {
    case 'APPROVED': return 'approved'
    case 'CHANGES_REQUESTED': return 'changes_requested'
    case 'COMMENTED': return 'commented'
    default: return hasRequests ? 'pending' : 'none'
  }
}

function checkCounts(payload: unknown) {
  const runs = payload && typeof payload === 'object' && Array.isArray((payload as { check_runs?: unknown }).check_runs)
    ? (payload as { check_runs: unknown[] }).check_runs
    : []
  const counts = { passed: 0, failed: 0, pending: 0 }
  for (const value of runs) {
    if (!value || typeof value !== 'object') continue
    const run = value as { status?: unknown; conclusion?: unknown }
    if (run.status !== 'completed') counts.pending++
    else if (run.conclusion === 'success' || run.conclusion === 'neutral' || run.conclusion === 'skipped') counts.passed++
    else counts.failed++
  }
  return counts
}

async function summarizeRepository(repo: GitHubRepo, token: string, fetcher: Fetcher, detailed=false): Promise<GitHubDeveloperRepositorySummary> {
  const path = repoPath(repo.full_name)
  const [pullPayload, checksPayload] = await Promise.all([
    requestJson(`https://api.github.com/repos/${path}/pulls?state=open&sort=updated&direction=desc&per_page=100`, token, fetcher),
    requestJson(`https://api.github.com/repos/${path}/commits/${encodeURIComponent(repo.default_branch)}/check-runs?per_page=100`, token, fetcher),
  ])
  if (!Array.isArray(pullPayload)) throw new Error('provider_unavailable')
  const pulls = pullPayload.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
  const requestedReviewers = pulls.reduce((total, pull) => {
    const reviewers = Array.isArray(pull.requested_reviewers) ? pull.requested_reviewers.length : 0
    return total + reviewers
  }, 0)
  const latestPull = pulls[0]
  let reviewPayload: unknown = []
  if (latestPull && Number.isSafeInteger(latestPull.number) && Number(latestPull.number) > 0) {
    reviewPayload = await requestJson(`https://api.github.com/repos/${path}/pulls/${Number(latestPull.number)}/reviews?per_page=100`, token, fetcher)
  }

  return {
    repository: repo.full_name,
    openPullRequests: pulls.length,
    requestedReviewers,
    latestReviewState: latestReviewState(reviewPayload, requestedReviewers > 0),
    ci: checkCounts(checksPayload),
    ...(detailed?{pullRequests:pulls.slice(0,8).flatMap(p=>typeof p.title==='string'&&Number.isSafeInteger(p.number)?[{number:Number(p.number),title:p.title.slice(0,180)}]:[])}:{}),
  }
}

export async function fetchGitHubDeveloperContext(
  token: string,
  fetcher: Fetcher = fetch,
  lookup?: {repositories:string[];query:string},
): Promise<GitHubDeveloperRepositorySummary[]> {
  const payload = await requestJson(`https://api.github.com/user/repos?sort=pushed&per_page=${lookup?'100':'5'}`, token, fetcher)
  let repositories = parseRepositories(payload)
  if(lookup){
    const catalog=Array.isArray(payload)?payload.filter((r):r is GitHubRepo=>Boolean(r&&typeof r.full_name==='string'&&/^[\w.-]+\/[\w.-]+$/.test(r.full_name)&&typeof r.default_branch==='string')):[]
    const targets=lookup.repositories.filter(name=>/^[\w.-]+\/[\w.-]+$/.test(name)).map(name=>name.toLowerCase())
    targets.push(...catalog.filter(repo=>lookup.query.toLowerCase().includes(repo.full_name.split('/')[1].toLowerCase())).map(repo=>repo.full_name.toLowerCase()))
    if(targets.length)repositories=[...new Set(targets)].slice(0,3).map(name=>catalog.find(repo=>repo.full_name.toLowerCase()===name)??{full_name:name,default_branch:'HEAD'})
    else repositories=repositories.slice(0,3)
  }
  const results=await Promise.allSettled(repositories.map(repo=>summarizeRepository(repo,token,fetcher,Boolean(lookup))))
  const successes=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[])
  if(!successes.length){const failure=results.find(result=>result.status==='rejected');if(failure?.status==='rejected')throw failure.reason}
  return successes
}
