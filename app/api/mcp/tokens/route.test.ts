/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/provider-sync-lock', () => ({
  withProviderSyncLock: (_db: unknown, _key: string, callback: (tx: unknown) => Promise<unknown>) => callback({
    mcpPersonalAccessToken: { count: jest.fn().mockResolvedValue(0) },
  }),
}))
jest.mock('@/lib/mcp/personal-access-token', () => ({
  issueMcpPersonalAccessToken: jest.fn(),
}))

import { getServerSession } from 'next-auth'
import { issueMcpPersonalAccessToken } from '@/lib/mcp/personal-access-token'
import { POST } from './route'

describe('POST /api/mcp/tokens', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(issueMcpPersonalAccessToken as jest.Mock).mockResolvedValue({
      record: { id: 'token-1', name: 'Novo Companion', tokenPrefix: 'novo_mcp_prefix', scopes: [], expiresAt: new Date(), createdAt: new Date() },
      token: 'novo_mcp_secret_returned_once',
    })
  })

  it('issues device activity permission without task or integration write access', async () => {
    const request = new Request('http://localhost/api/mcp/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Novo Companion', allowDeviceActivity: true }),
    })

    const response = await POST(request as never)
    const body = await response.json()
    const requestedScopes = (issueMcpPersonalAccessToken as jest.Mock).mock.calls[0][0].scopes as string[]

    expect(response.status).toBe(201)
    expect(body.token).toBe('novo_mcp_secret_returned_once')
    expect(requestedScopes).toContain('device:activity:write')
    expect(requestedScopes).not.toContain('tasks:write')
    expect(requestedScopes).not.toContain('integrations:write')
  })

  it('grants project context only when explicitly selected',async()=>{
    const request=new Request('http://localhost/api/mcp/tokens',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Companion',allowProjectsRead:true})})
    expect((await POST(request as never)).status).toBe(201)
    const scopes=(issueMcpPersonalAccessToken as jest.Mock).mock.calls[0][0].scopes
    expect(scopes).toContain('projects:read');expect(scopes).not.toContain('tasks:write');expect(scopes).not.toContain('twin:write')
  })

  it('allows read-only integration context without integration writes', async () => {
    const request = new Request('http://localhost/api/mcp/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Novo Companion', allowIntegrationRead: true }),
    })

    const response = await POST(request as never)
    const requestedScopes = (issueMcpPersonalAccessToken as jest.Mock).mock.calls[0][0].scopes as string[]

    expect(response.status).toBe(201)
    expect(requestedScopes).toContain('integrations:read')
    expect(requestedScopes).not.toContain('integrations:write')
    expect(requestedScopes).not.toContain('tasks:write')
  })

  it('issues Companion login and chat permissions without granting task or capture writes', async () => {
    const request = new Request('http://localhost/api/mcp/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Novo Companion', allowCompanion: true }),
    })

    const response = await POST(request as never)
    const requestedScopes = (issueMcpPersonalAccessToken as jest.Mock).mock.calls[0][0].scopes as string[]

    expect(response.status).toBe(201)
    expect(requestedScopes).toContain('device:connect')
    expect(requestedScopes).toContain('ai:chat')
    expect(requestedScopes).not.toContain('tasks:write')
    expect(requestedScopes).not.toContain('device:activity:write')
  })
})
