/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    integrationAccount: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { DELETE, GET, PATCH, POST } from './route'

function jsonRequest(method: string, body?: unknown) {
  return new Request('http://localhost/api/integration/vercel', {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('/api/integration/vercel', () => {
  const originalSecret = process.env.NEXTAUTH_SECRET
  const fetchMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXTAUTH_SECRET = 'test-secret-for-provider-token-encryption'
    global.fetch = fetchMock as typeof fetch
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.integrationAccount.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.integrationAccount.upsert as jest.Mock).mockResolvedValue({})
    ;(prisma.integrationAccount.update as jest.Mock).mockResolvedValue({})
    ;(prisma.integrationAccount.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
  })

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.NEXTAUTH_SECRET
    else process.env.NEXTAUTH_SECRET = originalSecret
  })

  it('requires a Novo session before connecting a provider token', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const result = await POST(jsonRequest('POST', { accessToken: 'private-token' }) as never)

    expect(result.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(prisma.integrationAccount.upsert).not.toHaveBeenCalled()
  })

  it('validates the token with a read-only request and stores it encrypted without returning it', async () => {
    fetchMock.mockResolvedValue(response({ projects: [
      { id: 'prj_one', name: 'novo-dashboard', env: [{ value: 'provider-secret' }] },
      { id: 'prj_two', name: 'novo-api' },
    ] }))

    const result = await POST(jsonRequest('POST', { accessToken: 'vercel-private-token', teamId: 'team_1' }) as never)
    const body = await result.json()
    const call = (prisma.integrationAccount.upsert as jest.Mock).mock.calls[0][0]

    expect(result.status).toBe(200)
    expect(body).toEqual({ connected: true, projects: [{ id: 'prj_one', name: 'novo-dashboard' }, { id: 'prj_two', name: 'novo-api' }], selectedProjectIds: [] })
    expect(fetchMock.mock.calls[0][1].method).toBe('GET')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer vercel-private-token')
    expect(call.where).toEqual({ userId_provider: { userId: 'owner-1', provider: 'vercel' } })
    expect(call.create.accessToken).not.toContain('vercel-private-token')
    expect(call.create.metadata).toEqual({ teamId: 'team_1', projects: body.projects, selectedProjectIds: [] })
    expect(JSON.stringify(body)).not.toMatch(/private-token|provider-secret/)
  })

  it('keeps a provider permission failure generic and does not persist rejected credentials', async () => {
    fetchMock.mockResolvedValue(response({ error: { message: 'provider echoed private-token' } }, 403))

    const result = await POST(jsonRequest('POST', { accessToken: 'private-token' }) as never)
    const body = await result.json()

    expect(result.status).toBe(400)
    expect(body).toEqual({ error: 'provider_permission_denied' })
    expect(JSON.stringify(body)).not.toContain('private-token')
    expect(prisma.integrationAccount.upsert).not.toHaveBeenCalled()
  })

  it('only returns safe connection state and project options for the signed-in owner', async () => {
    ;(prisma.integrationAccount.findUnique as jest.Mock).mockResolvedValue({
      accessToken: 'encrypted-private-token',
      metadata: { teamId: 'team_1', projects: [{ id: 'prj_one', name: 'novo-dashboard' }], selectedProjectIds: ['prj_one'] },
      syncStatus: 'connected', lastSuccessfulSyncAt: new Date('2026-10-08T10:00:00.000Z'),
    })

    const result = await GET()
    const body = await result.json()

    expect(result.status).toBe(200)
    expect(body).toMatchObject({ connected: true, projects: [{ id: 'prj_one', name: 'novo-dashboard', selected: true }] })
    expect(JSON.stringify(body)).not.toContain('encrypted-private-token')
    expect(prisma.integrationAccount.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_provider: { userId: 'owner-1', provider: 'vercel' } } }))
  })

  it('rejects project IDs not returned by Vercel before saving selection', async () => {
    ;(prisma.integrationAccount.findUnique as jest.Mock).mockResolvedValue({
      metadata: { teamId: 'team_1', projects: [{ id: 'prj_one', name: 'novo-dashboard' }], selectedProjectIds: [] },
    })

    const result = await PATCH(jsonRequest('PATCH', { selectedProjectIds: ['prj_victim'] }) as never)

    expect(result.status).toBe(400)
    expect(prisma.integrationAccount.update).not.toHaveBeenCalled()
  })

  it('persists only selected project IDs on the current owner connection', async () => {
    ;(prisma.integrationAccount.findUnique as jest.Mock).mockResolvedValue({
      metadata: { teamId: 'team_1', projects: [{ id: 'prj_one', name: 'novo-dashboard' }, { id: 'prj_two', name: 'novo-api' }], selectedProjectIds: [] },
    })

    const result = await PATCH(jsonRequest('PATCH', { selectedProjectIds: ['prj_two'] }) as never)
    const body = await result.json()

    expect(result.status).toBe(200)
    expect(body.selectedProjectIds).toEqual(['prj_two'])
    expect(prisma.integrationAccount.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_provider: { userId: 'owner-1', provider: 'vercel' } },
      data: expect.objectContaining({ metadata: expect.objectContaining({ selectedProjectIds: ['prj_two'] }) }),
    }))
  })

  it('disconnects only the signed-in owner Vercel credential', async () => {
    const result = await DELETE()

    expect(result.status).toBe(200)
    expect(prisma.integrationAccount.deleteMany).toHaveBeenCalledWith({ where: { userId: 'owner-1', provider: 'vercel' } })
  })
})
