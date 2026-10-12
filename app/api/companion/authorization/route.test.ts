/** @jest-environment node */

jest.mock('@/lib/mcp/auth', () => ({ validateMcpBearerToken: jest.fn() }))
jest.mock('@/lib/companion/auth', () => ({...jest.requireActual('@/lib/companion/auth'), requireCompanionOAuth:jest.fn()}))
jest.mock('@/lib/companion/devices', () => ({requireActiveCompanionDevice:jest.fn()}))
jest.mock('@/lib/prisma', () => ({prisma:{user:{findUnique:jest.fn()}}}))

import { validateMcpBearerToken } from '@/lib/mcp/auth'
import { GET } from './route'
import {requireCompanionOAuth, CompanionError} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'
import {prisma} from '@/lib/prisma'

describe('GET /api/companion/authorization', () => {
  beforeEach(() => {jest.clearAllMocks();process.env.NOVO_COMPANION_CHAT_ENABLED='true'})
  afterEach(() => delete process.env.NOVO_COMPANION_CHAT_ENABLED)

  it('does not authorize a new companion preflight while account chat is disabled', async () => {
    delete process.env.NOVO_COMPANION_CHAT_ENABLED
    const scopes=['device:connect','ai:chat']
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({ok:true,kind:'oauth',authInfo:{scopes}})
    ;(requireCompanionOAuth as jest.Mock).mockResolvedValue({userId:'candidate-owner',clientId:'candidate-client',grantId:'candidate-grant',scopes:new Set(scopes)})
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({id:'candidate-owner',name:'Candidate'})
    const response=await GET(new Request('https://novo.test/api/companion/authorization',{headers:{'X-Novo-Authorization-Preflight':'1'}}))

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({error:'chat_disabled'})
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(requireActiveCompanionDevice).not.toHaveBeenCalled()
  })

  it('verifies a candidate grant before reconnect mutates a device, never labels preflight connected', async () => {
    const scopes=['device:connect','ai:chat','twin:read']
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({ok:true,kind:'oauth',authInfo:{scopes}})
    const actor={userId:'candidate-owner',clientId:'candidate-client',grantId:'candidate-grant',scopes:new Set(scopes)}
    ;(requireCompanionOAuth as jest.Mock).mockResolvedValue(actor)
    ;(requireActiveCompanionDevice as jest.Mock).mockRejectedValue(new CompanionError(400,'device_id_required'))
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({id:'candidate-owner',name:'Candidate'})
    const response=await GET(new Request('https://novo.test/api/companion/authorization',{headers:{'X-Novo-Authorization-Preflight':'1'}}))
    expect(response.status).toBe(200)
    expect(requireActiveCompanionDevice).not.toHaveBeenCalled()
    expect(requireCompanionOAuth).toHaveBeenCalledWith(expect.any(Request),['device:connect','ai:chat'])
    expect(await response.json()).toMatchObject({state:'permission_required',device:null,user:{id:'candidate-owner'},capabilities:{aiChat:true,deviceConnect:true}})
  })

  it('returns the same preflight capabilities for an explicitly scoped personal token', async () => {
    const scopes=['device:connect','ai:chat','twin:read','device:activity:write']
    const actor={userId:'pat-owner',clientId:'novo-device:pat-1',grantId:'pat:pat-1',scopes:new Set(scopes)}
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({ok:true,kind:'pat',userId:'pat-owner',tokenId:'pat-1',authInfo:{scopes}})
    ;(requireCompanionOAuth as jest.Mock).mockResolvedValue(actor)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({id:'pat-owner',name:'PAT owner'})
    const response=await GET(new Request('https://novo.test/api/companion/authorization',{headers:{authorization:'Bearer novo_mcp_test','X-Novo-Authorization-Preflight':'1'}}))

    expect(response.status).toBe(200)
    expect(requireCompanionOAuth).toHaveBeenCalledWith(expect.any(Request),['device:connect','ai:chat'])
    expect(await response.json()).toMatchObject({state:'permission_required',device:null,user:{id:'pat-owner'},capabilities:{aiChat:true,deviceConnect:true,twinRead:true,activityWrite:true}})
  })

  it('accepts an activity-only token and reports independent capabilities', async () => {
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({
      ok: true,
      userId: 'owner-1',
      authInfo: { scopes: ['device:activity:write'] },
    })

    const response = await GET(new Request('http://localhost/api/companion/authorization', {
      headers: { authorization: 'Bearer novo-device-token' },
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ activityRead: false, activityWrite: true, workContextRead: false, workContextWrite: false, contextRead: false, integrationsRead: false })
  })

  it('rejects a valid Novo token that has no Companion capability', async () => {
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({
      ok: true,
      userId: 'owner-1',
      authInfo: { scopes: ['tasks:read', 'tasks:write'] },
    })

    const response = await GET(new Request('http://localhost/api/companion/authorization', {
      headers: { authorization: 'Bearer tasks-only-token' },
    }) as never)

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'companion_permission_required' })
  })

  it('accepts a signed-in account OAuth device token with the Companion scopes', async () => {
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({
      ok: true,
      userId: 'owner-1',
      authInfo: { scopes: ['twin:read', 'device:activity:write', 'integrations:read'] },
    })

    const response = await GET(new Request('https://novo.example/api/companion/authorization', {
      headers: { authorization: 'Bearer oauth-access-token' },
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ activityRead: false, activityWrite: true, workContextRead: false, workContextWrite: false, contextRead: true, integrationsRead: true })
  })

  it('reports the actual owner, active device and independent capabilities only after server verification', async () => {
    const deviceId = 'cd78b30e-93ca-4bd0-893a-a3f709b2f105'
    const scopes = ['device:connect', 'ai:chat', 'twin:read', 'device:activity:read', 'device:work-context:read', 'device:work-context:write']
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({ok:true, kind:'oauth', userId:'owner-1', authInfo:{scopes}})
    const actor = {userId:'owner-1', clientId:'client', grantId:'grant', scopes:new Set(scopes)}
    ;(requireCompanionOAuth as jest.Mock).mockResolvedValue(actor)
    ;(requireActiveCompanionDevice as jest.Mock).mockResolvedValue({id:deviceId, name:'Novo PC', platform:'windows', connectedAt:'2026-10-09T18:00:00.000Z', lastVerifiedAt:'2026-10-09T18:00:00.000Z', revokedAt:null, scopes})
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({id:'owner-1', name:'Account name'})
    const response = await GET(new Request('https://novo.test/api/companion/authorization', {headers:{'X-Novo-Device-Id':deviceId}}))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({version:1, state:'connected', user:{id:'owner-1', displayName:'Account name'}, device:{id:deviceId}, capabilities:{deviceConnect:true, aiChat:true, activityRead:true, activityWrite:false, twinRead:true, integrationsRead:false, workContextRead:true, workContextWrite:true}})
    expect(requireActiveCompanionDevice).toHaveBeenCalledWith(actor, deviceId)
    expect(JSON.stringify(body)).not.toMatch(/grantId|clientId|access_token/)
  })
  it('a new grant with a revoked device is never reported as connected', async () => {
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({ok:true, kind:'oauth', userId:'owner', authInfo:{scopes:['device:connect', 'ai:chat']}})
    ;(requireCompanionOAuth as jest.Mock).mockResolvedValue({userId:'owner'})
    ;(requireActiveCompanionDevice as jest.Mock).mockRejectedValue(new CompanionError(403, 'device_revoked'))
    const response = await GET(new Request('https://novo.test/api/companion/authorization', {headers:{'X-Novo-Device-Id':'cd78b30e-93ca-4bd0-893a-a3f709b2f105'}}))
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({error:'device_revoked'})
  })
})
