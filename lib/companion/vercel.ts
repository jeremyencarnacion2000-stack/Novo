export type VercelProjectOption = { id: string; name: string; repository?:string }

export type VercelProjectSelection = {
  projects: VercelProjectOption[]
  teamId?: string
}

export type VercelDeploymentSummary = {
  id: string
  projectId: string
  projectName: string
  state: string
  createdAt: string
  url: string | null
}

type Fetcher = typeof fetch

const SAFE_PROVIDER_ID = /^[a-z0-9_-]{1,128}$/i
const MAX_STORED_PROJECTS = 100
const MAX_SELECTED_PROJECTS = 10
const DEPLOYMENT_LOOKUP_DEADLINE_MS = 8_000
const DEPLOYMENT_REQUEST_TIMEOUT_MS = 4_000
const DEPLOYMENT_CONCURRENCY = 5

/** Parse persisted integration metadata defensively and return only selected, safe project labels. */
export function readVercelProjectSelection(metadataValue: unknown): VercelProjectSelection {
  const metadata = metadataValue && typeof metadataValue === 'object' && !Array.isArray(metadataValue)
    ? metadataValue as Record<string, unknown>
    : {}
  const rows = Array.isArray(metadata.projects) ? metadata.projects.flatMap((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    const project = value as Record<string, unknown>
    if (typeof project.id !== 'string' || !SAFE_PROVIDER_ID.test(project.id)) return []
    if (typeof project.name !== 'string' || !project.name.trim()) return []
    return [{ id: project.id, name: project.name.trim().slice(0, 100) }]
  }).slice(0, MAX_STORED_PROJECTS) : []
  const projectsById = new Map(rows.map((project) => [project.id, project]))
  const selectedIds = Array.isArray(metadata.selectedProjectIds)
    ? [...new Set(metadata.selectedProjectIds.filter((id): id is string => typeof id === 'string' && projectsById.has(id)))].slice(0, MAX_SELECTED_PROJECTS)
    : []
  const teamId = typeof metadata.teamId === 'string' && SAFE_PROVIDER_ID.test(metadata.teamId)
    ? metadata.teamId
    : undefined

  return {
    projects: selectedIds.flatMap((id) => {
      const project = projectsById.get(id)
      return project ? [project] : []
    }),
    teamId,
  }
}

function providerError(status: number): Error {
  if (status === 401) return new Error('provider_auth_required')
  if (status === 403) return new Error('provider_permission_denied')
  if (status === 429) return new Error('provider_rate_limited')
  return new Error('provider_unavailable')
}

async function requestJson(url: URL, token: string, fetcher: Fetcher, timeoutMs = 10_000) {
  let response: Response
  try {
    response = await fetcher(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    throw new Error('provider_unavailable')
  }
  if (!response.ok) throw providerError(response.status)
  try {
    return await response.json() as unknown
  } catch {
    throw new Error('provider_unavailable')
  }
}

export async function fetchVercelProjects(
  token: string,
  teamId?: string,
  fetcher: Fetcher = fetch,
): Promise<VercelProjectOption[]> {
  const url = new URL('https://api.vercel.com/v10/projects')
  url.searchParams.set('limit', '100')
  if (teamId) url.searchParams.set('teamId', teamId)
  const payload = await requestJson(url, token, fetcher)
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { projects?: unknown }).projects)) {
    throw new Error('provider_unavailable')
  }

  return ((payload as { projects: unknown[] }).projects).flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const project = item as { id?: unknown; name?: unknown; link?:{type?:unknown;org?:unknown;repo?:unknown} }
    if (typeof project.id !== 'string' || typeof project.name !== 'string') return []
    const repo=project.link?.type==='github'&&typeof project.link.org==='string'&&typeof project.link.repo==='string'?`${project.link.org}/${project.link.repo}`:undefined
    return [{ id: project.id.slice(0, 128), name: project.name.slice(0, 100), ...(repo&&/^[\w.-]+\/[\w.-]+$/.test(repo)?{repository:repo.toLowerCase()}:{}) }]
  })
}

function safeDeploymentUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 255) return null
  try {
    const url = new URL(value.startsWith('https://') ? value : `https://${value}`)
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null
    return url.origin
  } catch {
    return null
  }
}

function deploymentDate(value: unknown): string | null {
  const date = typeof value === 'number' ? new Date(value) : typeof value === 'string' ? new Date(value) : null
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null
}

export async function fetchVercelDeployments(
  token: string,
  selectedProjects: VercelProjectOption[],
  teamId?: string,
  fetcher: Fetcher = fetch,
): Promise<VercelDeploymentSummary[]> {
  const summaries: VercelDeploymentSummary[] = []
  const projects = selectedProjects.slice(0, MAX_SELECTED_PROJECTS)
  const deadline = Date.now() + DEPLOYMENT_LOOKUP_DEADLINE_MS
  let nextProject = 0
  let firstError: unknown

  // Selected projects are user-bounded, while small bounded concurrency and
  // a total deadline keep provider latency below a serverless request budget.
  // Failed projects don't discard deployments already retrieved from others.
  await Promise.all(Array.from({ length: Math.min(DEPLOYMENT_CONCURRENCY, projects.length) }, async () => {
    while (true) {
      const index = nextProject++
      const project = projects[index]
      if (!project) return
      const remainingMs = deadline - Date.now()
      if (remainingMs <= 0) {
        firstError ??= new Error('provider_unavailable')
        return
      }

      const url = new URL('https://api.vercel.com/v7/deployments')
      url.searchParams.set('limit', '5')
      url.searchParams.set('projectId', project.id)
      if (teamId) url.searchParams.set('teamId', teamId)
      try {
        const payload = await requestJson(url, token, fetcher, Math.max(1, Math.min(DEPLOYMENT_REQUEST_TIMEOUT_MS, remainingMs)))
        if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { deployments?: unknown }).deployments)) {
          throw new Error('provider_unavailable')
        }

        for (const item of (payload as { deployments: unknown[] }).deployments) {
          if (!item || typeof item !== 'object') continue
          const deployment = item as { uid?: unknown; id?: unknown; state?: unknown; readyState?: unknown; createdAt?: unknown; url?: unknown }
          const id = typeof deployment.uid === 'string' ? deployment.uid : deployment.id
          const createdAt = deploymentDate(deployment.createdAt)
          if (typeof id !== 'string' || !createdAt) continue
          const stateValue = typeof deployment.readyState === 'string' ? deployment.readyState : deployment.state
          summaries.push({
            id: id.slice(0, 128),
            projectId: project.id,
            projectName: project.name,
            state: typeof stateValue === 'string' ? stateValue.slice(0, 32).toUpperCase() : 'UNKNOWN',
            createdAt,
            url: safeDeploymentUrl(deployment.url),
          })
        }
      } catch (error) {
        firstError ??= error
      }
    }
  }))

  if (summaries.length === 0 && firstError) throw firstError
  return summaries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}
