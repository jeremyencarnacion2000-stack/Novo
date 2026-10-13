/** @jest-environment node */
import { prisma } from '@/lib/prisma'
import { registerCompanionDevice, requireActiveCompanionDevice, listCompanionDevices, revokeCompanionDevice } from '../devices'
import type { CompanionOAuthPrincipal } from '../auth'

jest.mock('@/lib/prisma', () => ({prisma:{
  $transaction:jest.fn(), $executeRaw:jest.fn(),
  companionDevice:{findUnique:jest.fn(), findFirst:jest.fn(), create:jest.fn(), update:jest.fn(), updateMany:jest.fn(), findMany:jest.fn()},
  companionWorkContext:{deleteMany:jest.fn()},
  projectAssistantSource:{updateMany:jest.fn()},
  projectDelegation:{updateMany:jest.fn()}, projectWork:{updateMany:jest.fn()},
  oAuthModel:{deleteMany:jest.fn()}, mcpAuditLog:{create:jest.fn()},
}}))

const db = prisma as jest.Mocked<typeof prisma>
const deviceId = 'cd78b30e-93ca-4bd0-893a-a3f709b2f105'
const input = {deviceId, name:'  Novo PC  ', platform:'windows' as const, reconnect:false}
const actor: CompanionOAuthPrincipal = {userId:'owner', clientId:'client', grantId:'grant', scopes:new Set(['device:connect', 'ai:chat']), expiresAt:Date.now()/1000 + 3600}
const originalTime = new Date('2026-10-09T18:00:00Z')
function row(change = {}) {return {id:'row-id', userId:'owner', deviceId, name:'Novo PC', platform:'windows', clientId:'client', grantId:'grant', scopes:['device:connect', 'ai:chat'], connectedAt:originalTime, lastVerifiedAt:originalTime, revokedAt:null, ...change}}
beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(originalTime)
  ;(db.$transaction as jest.Mock).mockImplementation(work => work(db))
  ;(db.companionDevice.findUnique as jest.Mock).mockResolvedValue(null)
  ;(db.companionDevice.findFirst as jest.Mock).mockResolvedValue(null)
  ;(db.companionDevice.create as jest.Mock).mockImplementation(({data}) => row(data))
  ;(db.companionDevice.update as jest.Mock).mockImplementation(({data}) => row(data))
  ;(db.companionDevice.updateMany as jest.Mock).mockResolvedValue({count:1})
  ;(db.companionDevice.findMany as jest.Mock).mockResolvedValue([row()])
  ;(db.companionWorkContext.deleteMany as jest.Mock).mockResolvedValue({count:1})
})
afterEach(() => jest.useRealTimers())
it('registers only owned minimal metadata and returns a token-free DTO', async () => {
  const first = await registerCompanionDevice(actor, input)
  expect(first).toMatchObject({id:deviceId, name:'Novo PC', platform:'windows', revokedAt:null})
  expect(JSON.stringify(first)).not.toMatch(/grantId|clientId|access_token|refresh_token/)
  expect(db.companionDevice.findUnique).toHaveBeenCalledWith({where:{userId_deviceId:{userId:'owner', deviceId}}})
  expect(db.$executeRaw).toHaveBeenCalled()
})
it('same grant retries do not duplicate registration or audit', async () => {
  ;(db.companionDevice.findUnique as jest.Mock).mockResolvedValue(row())
  expect(await registerCompanionDevice(actor, input)).toMatchObject({id:deviceId})
  expect(db.companionDevice.create).not.toHaveBeenCalled()
  expect(db.oAuthModel.deleteMany).not.toHaveBeenCalled()
  expect(db.mcpAuditLog.create).not.toHaveBeenCalled()
})
it('another grant requires an explicit reconnect decision', async () => {
  ;(db.companionDevice.findUnique as jest.Mock).mockResolvedValue(row({grantId:'old-grant'}))
  await expect(registerCompanionDevice(actor, input)).rejects.toMatchObject({status:409, code:'reconnect_required'})
  expect(db.oAuthModel.deleteMany).not.toHaveBeenCalled()
})
it('reconnect revokes both previous token rows and Grant inside the device transaction', async () => {
  ;(db.companionDevice.findUnique as jest.Mock).mockResolvedValue(row({grantId:'old-grant'}))
  await registerCompanionDevice(actor, {...input, reconnect:true})
  expect(db.oAuthModel.deleteMany).toHaveBeenCalledWith({where:{accountId:'owner', OR:[{grantId:'old-grant'}, {type:'Grant', modelId:'old-grant'}]}})
  expect(db.companionDevice.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({grantId:'grant', revokedAt:null})}))
  expect(db.companionWorkContext.deleteMany).toHaveBeenCalledWith({where:{userId:'owner',sourceDeviceId:deviceId}})
  expect(db.projectAssistantSource.updateMany).toHaveBeenCalledWith({where:{userId:'owner',deviceId},data:{facts:{},availability:'revoked'}})
  expect(db.projectDelegation.updateMany).toHaveBeenCalledWith({where:{userId:'owner',deviceId,enabled:true},data:{enabled:false,version:{increment:1}}})
})
it('refuses to reuse a revoked connection without a new grant', async () => {
  ;(db.companionDevice.findUnique as jest.Mock).mockResolvedValue(row({revokedAt:originalTime}))
  await expect(registerCompanionDevice(actor, {...input, reconnect:true})).rejects.toMatchObject({status:403, code:'device_revoked'})
})
it('a revoked PAT binding cannot silently authorize a different device id',async()=>{
  const patActor={...actor,clientId:'novo-device:pat-123',grantId:'pat:pat-123'}
  ;(db.companionDevice.findUnique as jest.Mock).mockResolvedValue(null)
  ;(db.companionDevice.findFirst as jest.Mock).mockResolvedValue(row({deviceId:'f9443d14-d8af-4f65-bf86-15fb99db7204',clientId:patActor.clientId,grantId:patActor.grantId,revokedAt:originalTime}))
  await expect(registerCompanionDevice(patActor,input)).rejects.toMatchObject({status:403,code:'device_revoked'})
  expect(db.companionDevice.create).not.toHaveBeenCalled()
})
it('an unknown device/other owner is not found, regardless of UUID knowledge', async () => {
  await expect(requireActiveCompanionDevice({...actor, userId:'other'}, deviceId)).rejects.toMatchObject({status:404})
  expect(db.companionDevice.findUnique).toHaveBeenCalledWith({where:{userId_deviceId:{userId:'other', deviceId}}})
})
it.each([{revokedAt:originalTime}, {grantId:'other-grant'}, {clientId:'other-client'}])('rejects revoked or differently bound devices', async change => {
  ;(db.companionDevice.findUnique as jest.Mock).mockResolvedValue(row(change))
  await expect(requireActiveCompanionDevice(actor, deviceId)).rejects.toMatchObject({status:403})
})
it('updates verification at most every five minutes with a conditional owned write', async () => {
  ;(db.companionDevice.findUnique as jest.Mock).mockResolvedValue(row())
  await requireActiveCompanionDevice(actor, deviceId)
  expect(db.companionDevice.updateMany).not.toHaveBeenCalled()
  jest.setSystemTime(originalTime.getTime() + 5 * 60_000)
  const view = await requireActiveCompanionDevice(actor, deviceId)
  expect(view.lastVerifiedAt).toBe(new Date(originalTime.getTime() + 5*60_000).toISOString())
  expect(db.companionDevice.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({userId:'owner', deviceId, grantId:'grant', clientId:'client', revokedAt:null})}))
})
it('lists only this account and hides stored grant/client identities', async () => {
  const list = await listCompanionDevices('owner')
  expect(db.companionDevice.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{userId:'owner'}}))
  expect(JSON.stringify(list)).not.toMatch(/grantId|clientId/)
})
it('revocation is idempotent and unknown/other-owner devices cannot be revoked', async () => {
  await expect(revokeCompanionDevice('other', deviceId)).rejects.toMatchObject({status:404})
  expect(db.oAuthModel.deleteMany).not.toHaveBeenCalled()
  ;(db.companionDevice.findUnique as jest.Mock).mockResolvedValue(row())
  await revokeCompanionDevice('owner', deviceId)
  expect(db.companionDevice.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({revokedAt:originalTime,workCapabilities:[],workLastSeenAt:null})}))
  expect(db.projectWork.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{userId:'owner',deviceId,phase:{in:['running','awaiting_confirmation']}},data:expect.objectContaining({phase:'uncertain',reasonCode:'device_revoked'})}))
  expect(db.companionWorkContext.deleteMany).toHaveBeenCalledWith({where:{userId:'owner',sourceDeviceId:deviceId}})
  ;(db.companionDevice.findUnique as jest.Mock).mockResolvedValue(row({revokedAt:originalTime}))
  jest.clearAllMocks()
  await revokeCompanionDevice('owner', deviceId)
  expect(db.oAuthModel.deleteMany).not.toHaveBeenCalled()
})
