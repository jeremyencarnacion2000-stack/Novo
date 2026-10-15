/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    integrationAccount: { findUnique: jest.fn() },
    novoSignalSourcePreference: { findMany: jest.fn() },
    novoSignalLedger: { findFirst: jest.fn() },
  },
}))
jest.mock('@/lib/mcp/auth', () => ({ validateMcpBearerToken: jest.fn() }))
jest.mock('@/lib/companion/auth', () => ({...jest.requireActual('@/lib/companion/auth'), requireCompanionOAuth:jest.fn()}))
jest.mock('@/lib/companion/devices', () => ({requireActiveCompanionDevice:jest.fn()}))
jest.mock('@/lib/companion/credential-vault', () => ({
  decryptIntegrationCredential: jest.fn(() => 'vercel-token'),
  resolveIntegrationCredential: jest.fn((value: string) => value),
}))
jest.mock('@/lib/companion/github', () => ({ fetchGitHubDeveloperContext: jest.fn() }))
jest.mock('@/lib/companion/vercel', () => ({
  ...jest.requireActual('@/lib/companion/vercel'),
  fetchVercelDeployments: jest.fn(),
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { validateMcpBearerToken } from '@/lib/mcp/auth'
import { CompanionError, requireCompanionOAuth } from '@/lib/companion/auth'
import { requireActiveCompanionDevice } from '@/lib/companion/devices'
import { decryptIntegrationCredential } from '@/lib/companion/credential-vault'
import { fetchGitHubDeveloperContext } from '@/lib/companion/github'
import { fetchVercelDeployments } from '@/lib/companion/vercel'
import { GET } from './route'

function request(token?: string) {
  return new Request('http://localhost/api/companion/developer-context', {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  })
}

describe('GET /api/companion/developer-context', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({ ok: true, userId: 'owner-1', authInfo: { scopes: ['integrations:read'] } })
    ;(prisma.integrationAccount.findUnique as jest.Mock).mockImplementation(({ where }: { where: { userId_provider: { provider: string } } }) => {
      if (where.userId_provider.provider === 'github') return Promise.resolve({ accessToken: 'github-secret', metadata: { login: 'angel' } })
      return Promise.resolve({ accessToken: 'encrypted-vercel-secret', metadata: { teamId: 'team_1', projects: [{ id: 'prj_1', name: 'novo-web' }], selectedProjectIds: ['prj_1'] } })
    })
    ;(prisma.novoSignalSourcePreference.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.novoSignalLedger.findFirst as jest.Mock).mockResolvedValue({ label: 'Tarea de Codex · novo-web: Fix the Twin context bridge', observedAt: new Date('2026-10-14T10:00:00.000Z') })
    ;(fetchGitHubDeveloperContext as jest.Mock).mockResolvedValue([{ repository: 'acme/private-app', openPullRequests: 1, requestedReviewers: 1, latestReviewState: 'approved', ci: { passed: 1, failed: 0, pending: 0 } }])
    ;(fetchVercelDeployments as jest.Mock).mockResolvedValue([{ id: 'dep_1', projectId: 'prj_1', projectName: 'novo-web', state: 'READY', createdAt: '2026-10-08T10:00:00Z', url: 'https://novo-web.example' }])
  })

  it('requires integrations:read for a device token rather than accepting twin or task read access', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({ ok: true, userId: 'owner-1', authInfo: { scopes: ['twin:read', 'tasks:read'] } })

    const result = await GET(request('device-token') as never)

    expect(result.status).toBe(403)
    expect(prisma.integrationAccount.findUnique).not.toHaveBeenCalled()
  })

  it('reads both connected providers only for the authenticated owner and returns sanitized context', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const result = await GET(request('device-token') as never)
    const body = await result.json()

    expect(result.status).toBe(200)
    expect(body.github.repositories[0]).toMatchObject({ repository: 'acme/private-app', latestReviewState: 'approved' })
    expect(body.vercel.deployments[0]).toMatchObject({ id: 'dep_1', state: 'READY' })
    expect(body.codex).toMatchObject({ connected: true, sourceExcluded: false, latestSignal: { label: 'Tarea de Codex · novo-web: Fix the Twin context bridge' } })
    expect(JSON.stringify(body)).not.toMatch(/github-secret|encrypted-vercel-secret|vercel-token/)
    expect(prisma.integrationAccount.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_provider: { userId: 'owner-1', provider: 'github' } } }))
    expect(decryptIntegrationCredential).toHaveBeenCalledWith('encrypted-vercel-secret', { userId: 'owner-1', provider: 'vercel' })
  })

  it('accepts the narrow development:read capability without integrations:read',async()=>{
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({ok:true,userId:'owner-1',authInfo:{clientId:'novo-device:pat-1',scopes:['device:connect','development:read']}})
    const tokenRequest=new Request('http://localhost/api/companion/developer-context',{headers:{authorization:'Bearer device-token','X-Novo-Device-Id':'29a9fe6a-fae4-4394-af55-638ad1186f78'}})
    const result=await GET(tokenRequest as never)
    expect(result.status).toBe(200)
    expect(requireCompanionOAuth).toHaveBeenCalledWith(tokenRequest,['device:connect','development:read'])
  })

  it('accepts an account OAuth token only when it includes integrations:read', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({
      ok: true,
      userId: 'owner-1',
      authInfo: { clientId: 'novo-companion', scopes: ['integrations:read'] },
    })

    const result = await GET(request('oauth-access-token') as never)

    expect(result.status).toBe(200)
    expect(validateMcpBearerToken).toHaveBeenCalledWith(expect.objectContaining({ headers: expect.any(Headers) }))
    expect(prisma.integrationAccount.findUnique).toHaveBeenCalledTimes(2)
  })

  it('does not contact a provider whose signal source the owner excluded', async () => {
    ;(prisma.novoSignalSourcePreference.findMany as jest.Mock).mockResolvedValue([{ source: 'github' }, { source: 'codex' }])

    const result = await GET(request('device-token') as never)
    const body = await result.json()

    expect(result.status).toBe(200)
    expect(body.github).toEqual({ connected: true, sourceExcluded: true, repositories: [] })
    expect(body.codex).toEqual({ connected: false, sourceExcluded: true, latestSignal: null })
    expect(fetchGitHubDeveloperContext).not.toHaveBeenCalled()
    expect(prisma.novoSignalLedger.findFirst).not.toHaveBeenCalled()
  })

  it('rejects a revoked companion before reading credentials or contacting providers', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({
      ok: true, kind: 'oauth', userId: 'owner-1', grantId: 'grant-1',
      authInfo: { clientId: 'novo-companion', scopes: ['device:connect', 'integrations:read'] },
    })
    ;(requireCompanionOAuth as jest.Mock).mockResolvedValue({ userId: 'owner-1' })
    ;(requireActiveCompanionDevice as jest.Mock).mockRejectedValue(new CompanionError(403, 'device_revoked'))
    const result = await GET(new Request('http://localhost/api/companion/developer-context', {
      headers: { authorization: 'Bearer oauth-access-token', 'X-Novo-Device-Id': '29a9fe6a-fae4-4394-af55-638ad1186f78' },
    }) as never)
    expect(result.status).toBe(403)
    expect(prisma.integrationAccount.findUnique).not.toHaveBeenCalled()
    expect(fetchGitHubDeveloperContext).not.toHaveBeenCalled()
    expect(fetchVercelDeployments).not.toHaveBeenCalled()
  })
})
