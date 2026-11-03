jest.mock('@/lib/prisma',()=>({prisma:{assistantActionRequest:{findUnique:jest.fn(),findFirst:jest.fn(),findMany:jest.fn(),create:jest.fn(),updateMany:jest.fn()},companionDevice:{findFirst:jest.fn()},mcpAuditLog:{create:jest.fn()},mutationRequest:{create:jest.fn(),update:jest.fn()},task:{create:jest.fn()},$transaction:jest.fn()}}))
jest.mock('@/lib/twin-signal',()=>({emitTwinSignal:jest.fn()}))
jest.mock('../devices',()=>({requireActiveCompanionDevice:jest.fn()}))

import {prisma} from '@/lib/prisma'
import {emitTwinSignal} from '@/lib/twin-signal'
import {requireActiveCompanionDevice} from '../devices'
import {prepareAssistantAction,decideAssistantAction,listPendingAssistantActions} from '../assistant-actions'
import {createHash} from 'node:crypto'

const actor={userId:'owner',clientId:'novo-client',grantId:'grant',scopes:new Set(['tasks:write','tasks:read'])}
const deviceId='cd78b30e-93ca-4bd0-893a-a3f709b2f105'
const requestId='c8edb8e3-96ec-43df-8ae6-ec2993edc3f8'
const operation={type:'task.create' as const,title:'Enviar propuesta',priority:'medium' as const}
const fingerprint=createHash('sha256').update(JSON.stringify(operation)).digest('hex')
const proposed={id:'cmabc123',requestId,userId:'owner',deviceId,clientId:'novo-client',grantId:'grant',operation,fingerprint,status:'proposed',revision:1,expiresAt:new Date('2026-11-02T12:05:00Z'),approvedAt:null,completedAt:null,result:null}
const tx={
  $executeRaw:jest.fn(),assistantActionRequest:{findUnique:jest.fn(),findFirst:jest.fn(),create:jest.fn(),updateMany:jest.fn()},
  companionDevice:{findFirst:jest.fn()},mcpAuditLog:{create:jest.fn()},mutationRequest:{create:jest.fn(),update:jest.fn()},task:{create:jest.fn()},
}

beforeEach(()=>{
  jest.clearAllMocks()
  ;(requireActiveCompanionDevice as jest.Mock).mockResolvedValue({id:'device-record'})
  ;(prisma.$transaction as jest.Mock).mockImplementation(async callback=>callback(tx))
  ;(prisma.assistantActionRequest.findUnique as jest.Mock).mockResolvedValue(null)
  ;(prisma.assistantActionRequest.findFirst as jest.Mock).mockResolvedValue(proposed)
  ;(prisma.companionDevice.findFirst as jest.Mock).mockResolvedValue({id:'device-record'})
  tx.assistantActionRequest.findUnique.mockResolvedValue(null)
  tx.assistantActionRequest.create.mockResolvedValue(proposed)
  tx.companionDevice.findFirst.mockResolvedValue({id:'device-record'})
  tx.assistantActionRequest.findFirst.mockResolvedValue(proposed)
  tx.assistantActionRequest.updateMany.mockResolvedValue({count:1})
  tx.mcpAuditLog.create.mockResolvedValue({})
  tx.mutationRequest.create.mockResolvedValue({})
  tx.mutationRequest.update.mockResolvedValue({})
  tx.task.create.mockResolvedValue({id:'task-1',title:operation.title,priority:operation.priority})
})

it('stores a short-lived proposal and never creates the task during preparation',async()=>{
  const action=await prepareAssistantAction(actor,deviceId,requestId,operation,new Date('2026-11-02T12:00:00Z'))
  expect(action).toMatchObject({id:'cmabc123',status:'proposed',revision:1,title:operation.title})
  expect(tx.assistantActionRequest.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({expiresAt:new Date('2026-11-02T12:05:00Z'),status:'proposed'})}))
  expect(tx.task.create).not.toHaveBeenCalled()
})

it('creates one owned task only after the matching visual decision',async()=>{
  const succeeded={...proposed,status:'succeeded',revision:3,approvedAt:new Date('2026-11-02T12:01:00Z'),completedAt:new Date('2026-11-02T12:01:00Z'),result:{kind:'task.created',resourceId:'task-1',title:operation.title,priority:'medium'}}
  tx.assistantActionRequest.findFirst.mockResolvedValue(proposed)
  tx.task.create.mockResolvedValue({id:'task-1',title:operation.title,priority:'medium'})
  ;(prisma.assistantActionRequest.findFirst as jest.Mock).mockResolvedValue(succeeded)
  const action=await decideAssistantAction(actor,deviceId,'cmabc123',{revision:1,decision:'confirm'},new Date('2026-11-02T12:01:00Z'))
  expect(tx.task.create).toHaveBeenCalledTimes(1)
  expect(tx.mutationRequest.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({userId:'owner',resourceType:'task'})}))
  expect(action.status).toBe('succeeded')
  expect(emitTwinSignal).toHaveBeenCalledWith({userId:'owner',signal:'task_created'})
})

it('does not create or update anything when Companion lacks task write scope',async()=>{
  await expect(prepareAssistantAction({...actor,scopes:new Set(['tasks:read'])},deviceId,requestId,operation)).rejects.toMatchObject({status:403})
  expect(prisma.$transaction).not.toHaveBeenCalled()
})

it('recovers only the active device’s pending proposals',async()=>{
  ;(prisma.assistantActionRequest.findMany as jest.Mock).mockResolvedValue([proposed])
  await expect(listPendingAssistantActions(actor,deviceId)).resolves.toHaveLength(1)
  expect(prisma.assistantActionRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({userId:'owner',deviceId,status:'proposed'})}))
})
