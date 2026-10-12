import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decryptIntegrationCredential, resolveIntegrationCredential } from '@/lib/companion/credential-vault'
import { fetchGitHubDeveloperContext, type GitHubDeveloperRepositorySummary } from '@/lib/companion/github'
import { fetchVercelDeployments, readVercelProjectSelection, type VercelProjectOption } from '@/lib/companion/vercel'
import { validateMcpBearerToken } from '@/lib/mcp/auth'
import { CompanionError, requireCompanionOAuth } from '@/lib/companion/auth'
import { requireActiveCompanionDevice } from '@/lib/companion/devices'
import { companionErrorResponse } from '@/lib/companion/http'

export const dynamic = 'force-dynamic'

type ProviderView<T> = {
  connected: boolean
  sourceExcluded: boolean
  repositories?: T[]
  projects?: VercelProjectOption[]
  deployments?: Awaited<ReturnType<typeof fetchVercelDeployments>>
  error?: 'provider_auth_required' | 'provider_permission_denied' | 'provider_rate_limited' | 'provider_unavailable' | 'reauthorization_required'
}

async function resolveUserId(request: Request): Promise<{ userId: string | null; status: number }> {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) return { userId: session.user.id, status: 200 }

  const validated = await validateMcpBearerToken(request)
  if (!validated.ok) return { userId: null, status: 401 }
  const scopes = Array.isArray(validated.authInfo.scopes) ? validated.authInfo.scopes : []
  const developmentRead=scopes.includes('development:read')
  const integrationsRead=scopes.includes('integrations:read')
  if (!developmentRead && !integrationsRead) return { userId: null, status: 403 }
  if (scopes.includes('device:connect')) {
    const sourceScope=integrationsRead?'integrations:read':'development:read'
    const actor = await requireCompanionOAuth(request, ['device:connect', sourceScope])
    await requireActiveCompanionDevice(actor, request.headers.get('X-Novo-Device-Id'))
  }
  return { userId: validated.userId, status: 200 }
}

function providerFailure(error: unknown): ProviderView<never>['error'] {
  const code = error instanceof Error ? error.message : ''
  if (code === 'provider_auth_required' || code === 'provider_permission_denied' || code === 'provider_rate_limited') return code
  return 'provider_unavailable'
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveUserId(request)
    if (!auth.userId) return NextResponse.json({ error: auth.status === 403 ? 'Insufficient development read permission.' : 'Unauthorized' }, { status: auth.status })
    const [github, vercel, preferences] = await Promise.all([
      prisma.integrationAccount.findUnique({
        where: { userId_provider: { userId: auth.userId, provider: 'github' } },
        select: { accessToken: true },
      }),
      prisma.integrationAccount.findUnique({
        where: { userId_provider: { userId: auth.userId, provider: 'vercel' } },
        select: { accessToken: true, metadata: true },
      }),
      prisma.novoSignalSourcePreference.findMany({
        where: { userId: auth.userId, source: { in: ['github', 'vercel'] }, excludedAt: { not: null } },
        select: { source: true },
      }),
    ])

    const excludedSources = new Set((preferences ?? []).map((item: { source: string }) => item.source))
    const githubExcluded = excludedSources.has('github')
    const vercelExcluded = excludedSources.has('vercel')

    const githubResult: ProviderView<GitHubDeveloperRepositorySummary> = !github?.accessToken
      ? { connected: false, sourceExcluded: githubExcluded, repositories: [] }
      : githubExcluded
        ? { connected: true, sourceExcluded: true, repositories: [] }
      : await fetchGitHubDeveloperContext(resolveIntegrationCredential(github.accessToken, { userId: auth.userId, provider: 'github' }))
          .then((repositories) => ({ connected: true, sourceExcluded: false, repositories }))
          .catch((error) => ({
            connected: true,
            sourceExcluded: false,
            repositories: [],
            error: error instanceof Error && error.message === 'credential_decryption_failed' ? 'reauthorization_required' as const : providerFailure(error),
          }))

    let vercelResult: ProviderView<never> = !vercel?.accessToken
      ? { connected: false, sourceExcluded: vercelExcluded, projects: [], deployments: [] }
      : { connected: true, sourceExcluded: vercelExcluded, projects: [], deployments: [] }
    if (vercel?.accessToken && !vercelExcluded) {
      try {
        const selected = readVercelProjectSelection(vercel.metadata)
        const accessToken = decryptIntegrationCredential(vercel.accessToken, { userId: auth.userId, provider: 'vercel' })
        const deployments = await fetchVercelDeployments(accessToken, selected.projects, selected.teamId)
        vercelResult = { connected: true, sourceExcluded: false, projects: selected.projects, deployments }
      } catch (error) {
        const category = error instanceof Error && error.message === 'credential_decryption_failed'
          ? 'reauthorization_required'
          : providerFailure(error)
        vercelResult = { connected: true, sourceExcluded: false, projects: [], deployments: [], error: category }
      }
    }

    return NextResponse.json({ github: githubResult, vercel: vercelResult }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof CompanionError) return companionErrorResponse(error)
    console.error('[companion/developer-context GET] Context lookup failed.')
    return NextResponse.json({ error: 'developer_context_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
