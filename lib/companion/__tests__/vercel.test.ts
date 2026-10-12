/** @jest-environment node */

import { fetchVercelDeployments, fetchVercelProjects, readVercelProjectSelection } from '@/lib/companion/vercel'

function apiResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('Vercel read-only connector', () => {
  it('retains the GitHub repository identity without carrying environment values',async()=>{
    const fetcher=jest.fn().mockResolvedValue(apiResponse({projects:[{id:'prj_1',name:'Novo',link:{type:'github',org:'Angel',repo:'Novo'},env:[{value:'secret'}]}]}))
    expect(await fetchVercelProjects('fixture',undefined,fetcher)).toEqual([{id:'prj_1',name:'Novo',repository:'angel/novo'}])
  })
  it('reads only valid, selected project metadata and bounds provider identifiers', () => {
    expect(readVercelProjectSelection({
      teamId: ' team_legacy ',
      projects: [
        { id: 'prj_valid', name: '  Novo Web  ' },
        { id: 'bad/id', name: 'unsafe-id' },
        { id: 'prj_empty', name: '  ' },
        null,
      ],
      selectedProjectIds: ['prj_valid', 'prj_missing', 'prj_valid', 7],
    })).toEqual({ projects: [{ id: 'prj_valid', name: 'Novo Web' }], teamId: undefined })
  })

  it('rejects malformed metadata and caps selected projects', () => {
    const projects = Array.from({ length: 12 }, (_, index) => ({ id: `prj_${index}`, name: `Project ${index}` }))
    expect(readVercelProjectSelection({
      teamId: 'team_1',
      projects,
      selectedProjectIds: projects.map(({ id }) => id),
    })).toEqual({ projects: projects.slice(0, 10), teamId: 'team_1' })
    expect(readVercelProjectSelection([])).toEqual({ projects: [], teamId: undefined })
  })

  it('normalizes only project identifiers and names from the projects response', async () => {
    const fetcher = jest.fn().mockResolvedValue(apiResponse({
      projects: [{ id: 'prj_123', name: 'novo-web', framework: 'nextjs', env: [{ value: 'secret' }] }],
    }))

    await expect(fetchVercelProjects('vercel-secret', 'team_1', fetcher)).resolves.toEqual([
      { id: 'prj_123', name: 'novo-web' },
    ])
    const [url, init] = fetcher.mock.calls[0]
    expect(String(url)).toBe('https://api.vercel.com/v10/projects?limit=100&teamId=team_1')
    expect(init.method).toBe('GET')
    expect(init.headers.Authorization).toBe('Bearer vercel-secret')
  })

  it('loads deployments for selected projects and discards provider metadata and commit details', async () => {
    const fetcher = jest.fn().mockResolvedValue(apiResponse({ deployments: [{
      uid: 'dep_1', name: 'novo-web', projectId: 'prj_123', state: 'READY', createdAt: 1791450000000,
      url: 'novo-web.example', meta: { githubCommitMessage: 'private message', githubCommitSha: 'deadbeef' },
    }] }))

    const summaries = await fetchVercelDeployments('vercel-secret', [
      { id: 'prj_123', name: 'novo-web' },
    ], 'team_1', fetcher)

    expect(summaries).toEqual([{
      id: 'dep_1', projectId: 'prj_123', projectName: 'novo-web', state: 'READY',
      createdAt: '2026-10-08T09:00:00.000Z', url: 'https://novo-web.example',
    }])
    expect(String(fetcher.mock.calls[0][0])).toContain('https://api.vercel.com/v7/deployments?limit=5&projectId=prj_123&teamId=team_1')
    expect(JSON.stringify(summaries)).not.toMatch(/private message|deadbeef|meta/i)
    expect(fetcher.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
  })

  it('returns a safe provider error category without forwarding provider response text', async () => {
    const fetcher = jest.fn().mockResolvedValue(apiResponse({ error: { message: 'vercel-secret-echo' } }, 403))

    await expect(fetchVercelProjects('vercel-secret', undefined, fetcher)).rejects.toThrow('provider_permission_denied')
  })

  it('bounds project lookup concurrency and keeps successful results when one project fails', async () => {
    let active = 0
    let peak = 0
    const fetcher = jest.fn(async (input: URL | RequestInfo) => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 5))
      active -= 1
      if (String(input).includes('projectId=prj_0')) return apiResponse({ error: 'denied' }, 403)
      const projectId = new URL(String(input)).searchParams.get('projectId')
      return apiResponse({ deployments: [{ uid: `dep_${projectId}`, state: 'READY', createdAt: 1791450000000 }] })
    })

    const projects = Array.from({ length: 10 }, (_, index) => ({ id: `prj_${index}`, name: `Project ${index}` }))
    const deployments = await fetchVercelDeployments('vercel-secret', projects, undefined, fetcher)

    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThanOrEqual(5)
    expect(deployments).toHaveLength(9)
    expect(deployments.every(deployment => deployment.projectId !== 'prj_0')).toBe(true)
  })
})
