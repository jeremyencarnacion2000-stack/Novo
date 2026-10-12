/** @jest-environment node */
jest.mock('@/lib/prisma',()=>({prisma:{$transaction:jest.fn(),userChatLease:{deleteMany:jest.fn()}}}))
jest.mock('@/lib/ai/chat-lease',()=>({lockUserChat:jest.fn(),claimUserChatLease:jest.fn(),releaseUserChatLease:jest.fn()}))
import {claimCompanionTurn, finishCompanionTurn, cancelCompanionTurn} from '../chat-turns'
import {claimUserChatLease} from '@/lib/ai/chat-lease'
import {prisma} from '@/lib/prisma'
const now=new Date('2026-10-09T18:00:00Z')
const actor={userId:'owner',clientId:'client',grantId:'grant',scopes:new Set(['device:connect','ai:chat']),expiresAt:now.getTime()/1000+3600}
const deviceId='42d1c6e8-c24a-42b4-80ab-20fb318496c9',requestId='d43b02f8-b59f-44ba-8a54-66366371293d'
const input={requestId,conversationId:null,conversationRevision:null,message:'Hola',model:'auto',twinMode:false}
const tx:any={$executeRaw:jest.fn(),companionDevice:{findUnique:jest.fn()},companionChatTurn:{findUnique:jest.fn(),create:jest.fn(),updateMany:jest.fn()},
  aIConversation:{create:jest.fn(),findFirst:jest.fn(),updateMany:jest.fn()},userChatLease:{deleteMany:jest.fn()},oAuthModel:{findFirst:jest.fn()},
  mcpPersonalAccessToken:{findFirst:jest.fn()}}
beforeEach(()=>{
  jest.useFakeTimers().setSystemTime(now);jest.clearAllMocks();(prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(tx))
  tx.companionDevice.findUnique.mockResolvedValue({id:'device-row',userId:'owner',clientId:'client',grantId:'grant',revokedAt:null})
  tx.oAuthModel.findFirst.mockResolvedValue({id:'grant-row',payload:{clientId:'client'}})
  tx.companionChatTurn.findUnique.mockResolvedValue(null);tx.companionChatTurn.updateMany.mockResolvedValue({count:1})
  tx.aIConversation.create.mockImplementation(({data}:any)=>({...data,revision:0,createdAt:now,updatedAt:now}))
  tx.aIConversation.updateMany.mockResolvedValue({count:1})
  ;(claimUserChatLease as jest.Mock).mockResolvedValue({userId:'owner',requestId,expiresAt:new Date(now.getTime()+180_000)})
})
afterEach(()=>jest.useRealTimers())
it('claims once and a same-body concurrent retry is pending, not another generation',async()=>{
  const first=await claimCompanionTurn(actor,deviceId,input)
  expect(first.kind).toBe('claimed')
  const data=tx.companionChatTurn.create.mock.calls[0][0].data
  tx.companionChatTurn.findUnique.mockResolvedValue({...data,createdAt:now,expiresAt:new Date(now.getTime()+30*86400_000)})
  expect(await claimCompanionTurn(actor,deviceId,input)).toEqual({kind:'pending',requestId})
  expect(claimUserChatLease).toHaveBeenCalledTimes(1)
  expect(tx.aIConversation.create).toHaveBeenCalledTimes(1)
  expect(await claimCompanionTurn(actor,deviceId,{...input,message:'different'})).toEqual({kind:'conflict',code:'request_conflict'})
})
it('stale revision and another active web/native lease cannot start a provider',async()=>{
  tx.aIConversation.findFirst.mockResolvedValue({id:'conv',revision:4,messages:[],createdAt:now})
  expect(await claimCompanionTurn(actor,deviceId,{...input,conversationId:'conv',conversationRevision:3})).toEqual({kind:'conflict',code:'revision_conflict'})
  ;(claimUserChatLease as jest.Mock).mockResolvedValue(null)
  expect(await claimCompanionTurn(actor,deviceId,input)).toEqual({kind:'conflict',code:'turn_active'})
})
it('uncertain/expired requests are never silently regenerated',async()=>{
  await claimCompanionTurn(actor,deviceId,input)
  const data=tx.companionChatTurn.create.mock.calls[0][0].data
  tx.companionChatTurn.findUnique.mockResolvedValue({...data,status:'interrupted',createdAt:now})
  expect(await claimCompanionTurn(actor,deviceId,input)).toMatchObject({kind:'replay',events:[{type:'error',code:'stream_interrupted'}]})
  jest.setSystemTime(now.getTime()+31*86400_000)
  expect(await claimCompanionTurn(actor,deviceId,input)).toMatchObject({kind:'replay',events:[{type:'error',code:'request_expired'}]})
  expect(claimUserChatLease).toHaveBeenCalledTimes(1)
})
it('cancel or revocation cannot commit partial text as an assistant response',async()=>{
  await claimCompanionTurn(actor,deviceId,input)
  const data=tx.companionChatTurn.create.mock.calls[0][0].data
  tx.companionChatTurn.findUnique.mockResolvedValue({...data,status:'cancelled',createdAt:now})
  await expect(finishCompanionTurn('owner',requestId,{text:'partial',modelId:'auto'})).rejects.toMatchObject({code:'cancelled'})
  tx.companionChatTurn.findUnique.mockResolvedValue({...data,createdAt:now})
  tx.companionDevice.findUnique.mockResolvedValue({revokedAt:now})
  await expect(finishCompanionTurn('owner',requestId,{text:'partial',modelId:'auto'})).rejects.toMatchObject({code:'device_revoked'})
  expect(tx.aIConversation.updateMany).toHaveBeenCalledTimes(1) // user message only
})
it('finishes PAT-backed turns only while the account token remains active',async()=>{
  const patActor={...actor,clientId:'novo-device:pat-123',grantId:'pat:pat-123'}
  const turn={userId:'owner',requestId,status:'running',leaseExpiresAt:new Date(now.getTime()+60_000),deviceId:'device-row',clientId:patActor.clientId,grantId:patActor.grantId,conversationId:'conversation'}
  tx.companionChatTurn.findUnique.mockResolvedValue(turn)
  tx.companionDevice.findUnique.mockResolvedValue({id:'device-row',userId:'owner',deviceId,clientId:patActor.clientId,grantId:patActor.grantId,revokedAt:null})
  tx.aIConversation.findFirst.mockResolvedValue({id:'conversation',userId:'owner',revision:1,messages:[],createdAt:now})
  tx.mcpPersonalAccessToken.findFirst.mockResolvedValue({id:'pat-123',userId:'owner',scopes:['device:connect','ai:chat'],revokedAt:null,expiresAt:new Date(now.getTime()+60_000)})
  tx.oAuthModel.findFirst.mockResolvedValue(null)

  await expect(finishCompanionTurn('owner',requestId,{text:'PAT answer',modelId:'auto'})).resolves.toMatchObject({type:'complete',revision:2})
  expect(tx.mcpPersonalAccessToken.findFirst).toHaveBeenCalledWith({where:{id:'pat-123',userId:'owner',revokedAt:null,expiresAt:{gt:now},scopes:{hasEvery:['device:connect','ai:chat']}},select:{id:true}})
  expect(tx.oAuthModel.findFirst).not.toHaveBeenCalled()
})
it('cancel updates only the owned active request, retaining exclusion until provider stops',async()=>{
  await cancelCompanionTurn('owner',requestId)
  expect(tx.companionChatTurn.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{userId:'owner',requestId,status:'running'}}))
  expect(tx.userChatLease.deleteMany).not.toHaveBeenCalled()
})
