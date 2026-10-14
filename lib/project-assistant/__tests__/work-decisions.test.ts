import {prepareProjectWorkAction,decideProjectWorkAction,reconcileAbandonedProviderActions} from '../work-decisions'
import {prisma} from '@/lib/prisma'
import {requireDelegationBinding} from '../delegations'
import {dispatchApprovedProviderAction,ProviderActionError} from '../provider-actions'

jest.mock('@/lib/prisma',()=>({prisma:{}}))
jest.mock('@/lib/provider-sync-lock',()=>({withProviderSyncLock:jest.fn(async(_db,_key,run)=>run(tx))}))
jest.mock('../delegations',()=>({requireDelegationBinding:jest.fn(async()=>({memory:{id:'memory-1'},workspace:{}}))}))
jest.mock('../provider-actions',()=>({dispatchApprovedProviderAction:jest.fn(),ProviderActionError:class ProviderActionError extends Error{constructor(public state:'failed'|'uncertain',public code:string){super(code)}}}))

const owner='owner-1',jobId='8a52e7c9-6c5f-4747-80e9-1c83b2fb6d65',memoryId='9e6dcf91-5016-4d9a-b935-cff946365c6c',deviceId='38a62636-07f0-48d2-b8e8-ebd2ec0227b2',workspaceId='19f18caf-c7f1-47f9-bd9b-d5111b84f531'
const requestId='4c5ef56b-c9b1-45c5-8ad2-d625930e5b43'
const result={executionId:'25eb2d6f-412f-43e4-aa3c-0b00f6ef732a',sessionId:'session-1',baseCommit:'a'.repeat(40),artifactId:'9e6dcf91-5016-4d9a-b935-cff946365c6c',diffHash:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',changedPaths:[],summary:'Diagnóstico listo',verification:{status:'not_run',checks:[]}}
const operation={kind:'task.create',title:'Revisar el despliegue',category:'Work',priority:'high',dueDate:'2026-10-16'}
const job:any={id:jobId,userId:owner,memoryId,projectKey:memoryId,delegationId:'delegation-1',ruleVersion:3,deviceId,workspaceId,capability:'project.diagnose',objective:'Diagnosticar despliegue',mode:'manual',requestKey:'manual-1',requestFingerprint:'request',trigger:null,scope:{memoryId,deviceId,workspaceId,verification:[],timeoutSeconds:600},phase:'completed',revision:4,sequence:2,leaseExpiresAt:null,result,decision:null,finishedAt:new Date('2026-10-13T11:00:00Z')}
const tx:any={projectWork:{findFirst:jest.fn(),findMany:jest.fn(),updateMany:jest.fn()},projectDelegation:{findFirst:jest.fn()},projectWorkEvent:{create:jest.fn(async()=>({}))},task:{create:jest.fn(async()=>({id:'task-1'}))},quickNote:{create:jest.fn(async()=>({id:'note-1'}))},calendarEvent:{create:jest.fn(async()=>({id:'event-1'}))}}
beforeEach(()=>{jest.clearAllMocks();tx.projectWork.findFirst.mockResolvedValue({...job});tx.projectWork.findMany.mockResolvedValue([]);tx.projectWork.updateMany.mockResolvedValue({count:1});tx.projectDelegation.findFirst.mockResolvedValue({id:job.delegationId,userId:owner,memoryId,deviceId:job.deviceId,workspaceId:job.workspaceId,enabled:true,version:3});(prisma as any).$transaction=jest.fn();})

test('a typed operation remains pending until exact owner confirmation and replays without duplicate task creation',async()=>{
  const pending=await prepareProjectWorkAction(owner,jobId,{revision:4,requestId,operation},new Date('2026-10-13T12:00:00Z'))
  expect(pending.phase).toBe('awaiting_confirmation')
  expect((pending.decision as any).state).toBe('pending')
  expect((pending.decision as any).fingerprint).toEqual(expect.any(String))
  expect(tx.task.create).not.toHaveBeenCalled()
  tx.projectWork.findFirst.mockResolvedValue({...job,...pending})
  const input={revision:pending.revision,requestId,fingerprint:(pending.decision as any).fingerprint,decision:'confirm'}
  const applied=await decideProjectWorkAction(owner,jobId,input,new Date('2026-10-13T12:01:00Z'))
  expect(applied.phase).toBe('completed')
  expect((applied.decision as any).state).toBe('applied')
  expect(tx.task.create).toHaveBeenCalledTimes(1)
  expect(tx.task.create).toHaveBeenCalledWith({data:{title:operation.title,status:'todo',priority:'high',dueDate:operation.dueDate,tags:JSON.stringify(['Work']),userId:owner},select:{id:true}})
  tx.projectWork.findFirst.mockResolvedValue({...job,...applied})
  await decideProjectWorkAction(owner,jobId,input,new Date('2026-10-13T12:02:00Z'))
  expect(tx.task.create).toHaveBeenCalledTimes(1)
})

test('another owner, stale fingerprint, expired evidence and a cancelled race cannot execute an action',async()=>{
  await expect(prepareProjectWorkAction('other',jobId,{revision:4,requestId,operation})).rejects.toMatchObject({code:'work_not_found'})
  tx.projectWork.findFirst.mockResolvedValue({...job,...await prepareProjectWorkAction(owner,jobId,{revision:4,requestId,operation},new Date('2026-10-13T12:00:00Z'))})
  await expect(decideProjectWorkAction(owner,jobId,{revision:5,requestId,fingerprint:'f'.repeat(64),decision:'confirm'})).rejects.toMatchObject({code:'decision_mismatch'})
  tx.projectWork.findFirst.mockResolvedValue({...job,phase:'cancelled',revision:5})
  await expect(decideProjectWorkAction(owner,jobId,{revision:5,requestId,fingerprint:'f'.repeat(64),decision:'confirm'})).rejects.toMatchObject({code:'decision_not_pending'})
  expect(tx.task.create).not.toHaveBeenCalled()
})

test('a denied request is audited without writing its internal operation',async()=>{
  const pending=await prepareProjectWorkAction(owner,jobId,{revision:4,requestId,operation},new Date('2026-10-13T12:00:00Z'))
  tx.projectWork.findFirst.mockResolvedValue({...job,...pending})
  const denied=await decideProjectWorkAction(owner,jobId,{revision:pending.revision,requestId,fingerprint:(pending.decision as any).fingerprint,decision:'deny'},new Date('2026-10-13T12:01:00Z'))
  expect((denied.decision as any).state).toBe('denied')
  expect(tx.task.create).not.toHaveBeenCalled()
  expect(tx.projectWorkEvent.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({kind:'action_denied',userId:owner,jobId})}))
})

test('expired approval is closed durably and cannot create the prepared task',async()=>{
  const proposedAt=new Date('2026-10-13T12:00:00Z')
  const pending=await prepareProjectWorkAction(owner,jobId,{revision:4,requestId,operation},proposedAt)
  tx.projectWork.findFirst.mockResolvedValue({...job,...pending})
  await expect(decideProjectWorkAction(owner,jobId,{revision:pending.revision,requestId,fingerprint:(pending.decision as any).fingerprint,decision:'confirm'},new Date('2026-10-14T13:00:00Z'))).rejects.toMatchObject({code:'decision_expired'})
  expect(tx.task.create).not.toHaveBeenCalled()
  expect(tx.projectWork.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({data:expect.objectContaining({phase:'completed',decision:expect.objectContaining({state:'expired'})})}))
})

test('old work evidence cannot be used to stage a new internal action',async()=>{
  tx.projectWork.findFirst.mockResolvedValue({...job,finishedAt:new Date('2026-10-12T11:00:00Z')})
  await expect(prepareProjectWorkAction(owner,jobId,{revision:4,requestId,operation},new Date('2026-10-13T12:00:00Z'))).rejects.toMatchObject({code:'result_stale'})
  expect(tx.task.create).not.toHaveBeenCalled()
  expect(tx.projectWork.updateMany).not.toHaveBeenCalled()
})

test('arbitrary or invalid operation bodies are rejected before persistence',async()=>{
  await expect(prepareProjectWorkAction(owner,jobId,{revision:4,requestId,operation:{kind:'task.delete',id:'task-1'}})).rejects.toMatchObject({code:'invalid_work_decision'})
  expect(tx.projectWork.updateMany).not.toHaveBeenCalled()
})

test('a GitHub issue is not sent before confirmation and a confirmed dispatch is idempotent',async()=>{
  const providerOperation={kind:'github.issue.create',repository:'acme/novo',title:'Revisar el despliegue',body:'La vista previa no termina.'}
  const current:any={...job}
  tx.projectWork.findFirst.mockImplementation(async()=>({...current}))
  tx.projectWork.updateMany.mockImplementation(async({data}:any)=>{
    for(const key of ['phase','decision','finishedAt','leaseExpiresAt'])if(key in data)current[key]=data[key]
    if(data.revision?.increment)current.revision+=data.revision.increment
    if(data.sequence?.increment)current.sequence+=data.sequence.increment
    return {count:1}
  })
  ;(dispatchApprovedProviderAction as jest.Mock).mockResolvedValue({kind:'github_issue',resourceId:'42'})
  const pending=await prepareProjectWorkAction(owner,jobId,{revision:4,requestId,operation:providerOperation},new Date('2026-10-13T12:00:00Z'))
  expect((pending.decision as any).state).toBe('pending')
  expect(dispatchApprovedProviderAction).not.toHaveBeenCalled()
  const input={revision:pending.revision,requestId,fingerprint:(pending.decision as any).fingerprint,decision:'confirm'}
  const applied=await decideProjectWorkAction(owner,jobId,input,new Date('2026-10-13T12:01:00Z'))
  expect((applied.decision as any).state).toBe('applied')
  expect((applied.decision as any).operationResult).toEqual({kind:'github_issue',resourceId:'42'})
  expect(dispatchApprovedProviderAction).toHaveBeenCalledTimes(1)
  expect(dispatchApprovedProviderAction).toHaveBeenCalledWith(owner,providerOperation,requestId)
  await decideProjectWorkAction(owner,jobId,input,new Date('2026-10-13T12:02:00Z'))
  expect(dispatchApprovedProviderAction).toHaveBeenCalledTimes(1)
})

test('a lost Vercel response is recorded as uncertain and is never dispatched again',async()=>{
  const providerOperation={kind:'vercel.deployment.redeploy',projectId:'prj_novo',projectName:'Novo',deploymentId:'dpl_preview',target:'preview'}
  const current:any={...job}
  tx.projectWork.findFirst.mockImplementation(async()=>({...current}))
  tx.projectWork.updateMany.mockImplementation(async({data}:any)=>{
    for(const key of ['phase','decision','finishedAt','leaseExpiresAt'])if(key in data)current[key]=data[key]
    if(data.revision?.increment)current.revision+=data.revision.increment
    if(data.sequence?.increment)current.sequence+=data.sequence.increment
    return {count:1}
  })
  ;(dispatchApprovedProviderAction as jest.Mock).mockRejectedValue(new ProviderActionError('uncertain','vercel_result_unknown'))
  const pending=await prepareProjectWorkAction(owner,jobId,{revision:4,requestId,operation:providerOperation},new Date('2026-10-13T12:00:00Z'))
  const input={revision:pending.revision,requestId,fingerprint:(pending.decision as any).fingerprint,decision:'confirm'}
  const uncertain=await decideProjectWorkAction(owner,jobId,input,new Date('2026-10-13T12:01:00Z'))
  expect((uncertain.decision as any).state).toBe('uncertain')
  expect((uncertain.decision as any).failureCode).toBe('vercel_result_unknown')
  await decideProjectWorkAction(owner,jobId,input,new Date('2026-10-13T12:02:00Z'))
  expect(dispatchApprovedProviderAction).toHaveBeenCalledTimes(1)
})

test('a provider rejection permits a fresh reviewed attempt without replaying the rejected request',async()=>{
  const providerOperation={kind:'github.issue.create',repository:'acme/novo',title:'Revisar la publicación',body:''}
  const current:any={...job}
  tx.projectWork.findFirst.mockImplementation(async()=>({...current}))
  tx.projectWork.updateMany.mockImplementation(async({data}:any)=>{
    for(const key of ['phase','decision','finishedAt','leaseExpiresAt','reasonCode'])if(key in data)current[key]=data[key]
    if(data.revision?.increment)current.revision+=data.revision.increment
    if(data.sequence?.increment)current.sequence+=data.sequence.increment
    return {count:1}
  })
  ;(dispatchApprovedProviderAction as jest.Mock).mockRejectedValue(new ProviderActionError('failed','github_permission_denied'))
  const pending=await prepareProjectWorkAction(owner,jobId,{revision:4,requestId,operation:providerOperation},new Date('2026-10-13T12:00:00Z'))
  const input={revision:pending.revision,requestId,fingerprint:(pending.decision as any).fingerprint,decision:'confirm'}
  const failed=await decideProjectWorkAction(owner,jobId,input,new Date('2026-10-13T12:01:00Z'))
  expect(failed.phase).toBe('failed')
  expect(failed.finishedAt).toEqual(job.finishedAt)
  expect((failed.decision as any).failureCode).toBe('github_permission_denied')
  const retryRequestId='cc56b96e-8688-4e11-a079-e4f0b68d0d11'
  const retry=await prepareProjectWorkAction(owner,jobId,{revision:failed.revision,requestId:retryRequestId,operation:providerOperation},new Date('2026-10-13T12:02:00Z'))
  expect((retry.decision as any).state).toBe('pending')
  expect((retry.decision as any).requestId).toBe(retryRequestId)
  expect(dispatchApprovedProviderAction).toHaveBeenCalledTimes(1)
})

test('read recovery closes an abandoned provider dispatch as uncertain and does not send it again',async()=>{
  const now=new Date('2026-10-13T12:10:00Z')
  const executing={version:1,state:'executing',requestId,fingerprint:'b'.repeat(64),operation:{kind:'github.issue.create',repository:'acme/novo',title:'Issue aprobado',body:''},proposedAt:'2026-10-13T12:00:00.000Z',expiresAt:'2026-10-14T12:00:00.000Z',startedAt:'2026-10-13T12:05:00.000Z',decision:'confirm'}
  tx.projectWork.findMany.mockResolvedValue([{...job,phase:'awaiting_confirmation',revision:5,sequence:4,decision:executing}])
  await expect(reconcileAbandonedProviderActions(owner,now)).resolves.toBe(1)
  expect(tx.projectWork.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{id:jobId,userId:owner,revision:5,phase:'awaiting_confirmation'},data:expect.objectContaining({phase:'uncertain',decision:expect.objectContaining({state:'uncertain',failureCode:'provider_result_unknown'})})}))
  expect(tx.projectWorkEvent.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({sequence:5,kind:'action_uncertain'})}))
  expect(dispatchApprovedProviderAction).not.toHaveBeenCalled()
})
