/** @jest-environment node */

import { fetchGitHubDeveloperContext } from '@/lib/companion/github'

function apiResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

describe('GitHub developer context', () => {
  it('queries the requested repository even when it is absent from recent repositories',async()=>{
    const fetcher=jest.fn(async(input:RequestInfo|URL)=>{
      const path=new URL(String(input)).pathname
      if(path==='/user/repos')return apiResponse([{full_name:'owner/recent',default_branch:'main'}])
      if(path==='/repos/owner/older/pulls')return apiResponse([{number:4,title:'Fix deployment',requested_reviewers:[]}])
      if(path.endsWith('/reviews'))return apiResponse([])
      if(path==='/repos/owner/older/commits/HEAD/check-runs')return apiResponse({check_runs:[]})
      return apiResponse({},404)
    })
    const data=await fetchGitHubDeveloperContext('fixture',fetcher,{repositories:['owner/older'],query:'older'})
    expect(data[0].repository).toBe('owner/older');expect(data[0].pullRequests).toEqual([{number:4,title:'Fix deployment'}])
    expect(fetcher.mock.calls.some(([url])=>String(url).includes('/repos/owner/recent/'))).toBe(false)
  })
  it('returns only bounded PR, review, and CI summaries without titles, branches, or commit data', async () => {
    const fetcher = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname === '/user/repos') {
        return apiResponse([
          { full_name: 'acme/private-app', default_branch: 'main', private: true },
          { full_name: 'acme/second-app', default_branch: 'release/2026', private: true },
        ])
      }
      if (url.pathname.endsWith('/pulls')) {
        return apiResponse([{ number: 42, title: 'Private title', head: { sha: 'secret-sha' }, requested_reviewers: [{ login: 'reviewer' }] }])
      }
      if (url.pathname.endsWith('/pulls/42/reviews')) {
        return apiResponse([{ state: 'APPROVED', submitted_at: '2026-10-08T10:00:00Z', body: 'private review text' }])
      }
      if (url.pathname.endsWith('/check-runs')) {
        return apiResponse({ check_runs: [
          { name: 'private workflow name', status: 'completed', conclusion: 'success' },
          { name: 'another workflow', status: 'in_progress', conclusion: null },
          { name: 'broken workflow', status: 'completed', conclusion: 'failure' },
        ] })
      }
      return apiResponse({}, 404)
    })

    const summaries = await fetchGitHubDeveloperContext('github-private-token', fetcher)

    expect(summaries).toEqual([
      { repository: 'acme/private-app', openPullRequests: 1, requestedReviewers: 1, latestReviewState: 'approved', ci: { passed: 1, failed: 1, pending: 1 } },
      { repository: 'acme/second-app', openPullRequests: 1, requestedReviewers: 1, latestReviewState: 'approved', ci: { passed: 1, failed: 1, pending: 1 } },
    ])
    expect(fetcher.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true)
    expect(JSON.stringify(summaries)).not.toMatch(/Private title|secret-sha|private review text|workflow name|release\/2026/i)
  })

  it('categorizes missing provider authorization without passing the provider body through', async () => {
    const fetcher = jest.fn().mockResolvedValue(apiResponse({ message: 'github-private-token leaked' }, 401))

    await expect(fetchGitHubDeveloperContext('github-private-token', fetcher)).rejects.toThrow('provider_auth_required')
  })
})
