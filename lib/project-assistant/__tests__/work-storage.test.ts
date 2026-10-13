/** @jest-environment node */
jest.mock('@/lib/prisma',()=>({prisma:{$transaction:jest.fn(),$executeRaw:jest.fn(),projectAssistantMemory:{findFirst:jest.fn()},projectAssistantSource:{findFirst:jest.fn()},companionDevice:{findFirst:jest.fn()},projectDelegation:{findFirst:jest.fn(),create:jest.fn(),updateMany:jest.fn()},projectWork:{findFirst:jest.fn(),create:jest.fn(),count:jest.fn(),updateMany:jest.fn()},userSettings:{findUnique:jest.fn()},projectWorkEvent:{create:jest.fn()}}}))
import {prisma} from '@/lib/prisma'
import {saveDelegation} from '../delegations'
import {enqueueProjectWork,cancelProjectWork} from '../jobs'
import {delegationInputSchema} from '../work-contracts'
const db=prisma as any,workspaceId='bcf7c70d-6d39-4bb9-86d2-9e75509c1b69',deviceId='cd78b30e-93ca-4bd0-893a-a3f709b2f105'
const input={memoryId:'m1',deviceId,workspaceId,capabilities:['project.diagnose'],enabled:true,triggers:['ci_failure'],dailyLimit:3,timezone:'America/La_Paz',verification:[]}
const rule=()=>({id:'r1',userId:'owner',version:1,...input})
const request={memoryId:'m1',capability:'project.diagnose',objective:'Revisar el fallo de integración',mode:'manual',requestId:workspaceId}
beforeEach(()=>{
  jest.clearAllMocks();db.$transaction.mockImplementation((work:any)=>work(db));db.userSettings.findUnique.mockResolvedValue(null)
  db.projectAssistantMemory.findFirst.mockResolvedValue({id:'m1',userId:'owner',projectId:'p1',clearedAt:null,trackingMode:'on'})
  db.projectAssistantSource.findFirst.mockResolvedValue({userId:'owner',memoryId:'m1',deviceId,kind:'folder',sourceKey:`${deviceId}:${workspaceId}`,availability:'available',facts:{workspaceId}})
  db.companionDevice.findFirst.mockResolvedValue({userId:'owner',deviceId,revokedAt:null,scopes:['device:work:execute','device:work:read']})
  db.projectDelegation.findFirst.mockResolvedValue(rule());db.projectDelegation.updateMany.mockResolvedValue({count:1})
  db.projectDelegation.create.mockImplementation(async({data}:any)=>({id:'r1',version:1,...data}))
  db.projectWork.findFirst.mockResolvedValue(null);db.projectWork.count.mockResolvedValue(0);db.projectWork.updateMany.mockResolvedValue({count:1})
  db.projectWork.create.mockImplementation(async({data}:any)=>({id:'j1',revision:1,...data}))
})
test('following a project alone never grants execution',async()=>{
  db.projectDelegation.findFirst.mockResolvedValue(null)
  await expect(enqueueProjectWork('owner',request)).rejects.toMatchObject({code:'delegation_required'})
  expect(db.projectWork.create).not.toHaveBeenCalled()
})
test('activation binds owned memory, device and selected workspace and increments the rule version',async()=>{
  await saveDelegation('owner',{...input,version:1})
  expect(db.projectDelegation.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({userId:'owner',version:1}),data:expect.objectContaining({version:{increment:1},enabled:true})}))
  db.projectAssistantSource.findFirst.mockResolvedValue(null)
  await expect(saveDelegation('owner',{...input,version:1})).rejects.toMatchObject({code:'workspace_not_authorized'})
})
test('foreign memory or missing device execution grant cannot activate a delegation',async()=>{
  db.projectAssistantMemory.findFirst.mockResolvedValue(null)
  await expect(saveDelegation('other',input)).rejects.toMatchObject({code:'memory_not_found'})
  db.projectAssistantMemory.findFirst.mockResolvedValue({id:'m1',clearedAt:null})
  db.companionDevice.findFirst.mockResolvedValue(null)
  await expect(saveDelegation('owner',input)).rejects.toMatchObject({code:'device_permission_required'})
})
test('quota defaults to three and a configured limit of one remains valid',()=>{
  const {dailyLimit,...rest}=input
  expect(delegationInputSchema.parse(rest).dailyLimit).toBe(3)
  expect(delegationInputSchema.parse({...rest,dailyLimit:1}).dailyLimit).toBe(1)
  expect(delegationInputSchema.safeParse({...rest,dailyLimit:0}).success).toBe(false)
})
test('idempotent manual delivery keeps one job and refuses changed arguments',async()=>{
  const job=await enqueueProjectWork('owner',request)
  db.projectWork.findFirst.mockResolvedValue(job)
  expect((await enqueueProjectWork('owner',request)).id).toBe(job.id)
  expect(db.projectWork.create).toHaveBeenCalledTimes(1)
  await expect(enqueueProjectWork('owner',{...request,objective:'Otro objetivo'})).rejects.toMatchObject({code:'request_conflict'})
})
test('manual requests are excluded from the automatic daily quota',async()=>{
  db.projectWork.count.mockResolvedValue(3)
  expect((await enqueueProjectWork('owner',request)).mode).toBe('manual')
  expect(db.projectWork.count).not.toHaveBeenCalled()
})
test('automatic work uses actual fresh failure identity, coalesces unchanged CI and obeys quota',async()=>{
  const at=new Date().toISOString(),commit='a'.repeat(40)
  const source={kind:'github',sourceKey:'owner/novo',title:'Novo',repository:'owner/novo',observedAt:new Date(at),availability:'available',facts:{openPullRequests:0,ci:{passed:0,failed:1,pending:0},commit,failedCheckIds:['42']}}
  const {workFingerprint}=await import('../jobs')
  const evidenceKey=workFingerprint({kind:'ci_failure',sourceKey:source.sourceKey,commit,failedCheckIds:['42']})
  const trigger={kind:'ci_failure',sourceKey:'owner/novo',evidenceKey,observedAt:at}
  db.projectAssistantSource.findFirst.mockImplementation(async({where}:any)=>where.kind==='folder'?{facts:{workspaceId}}:source)
  const automatic={memoryId:'m1',capability:'project.diagnose',objective:'Revisar el fallo de integración',mode:'automatic',trigger}
  await expect(enqueueProjectWork('owner',{...automatic,trigger:{...trigger,evidenceKey:'invented'}})).rejects.toMatchObject({code:'trigger_not_authorized'})
  const job=await enqueueProjectWork('owner',automatic)
  db.projectWork.findFirst.mockResolvedValueOnce(job)
  expect((await enqueueProjectWork('owner',{...automatic,trigger:{...trigger,observedAt:new Date(Date.now()+1000).toISOString()}})).id).toBe(job.id)
  db.projectWork.count.mockResolvedValue(3)
  await expect(enqueueProjectWork('owner',automatic)).rejects.toMatchObject({code:'daily_limit_reached'})
  expect(db.projectWork.count).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({mode:'automatic',projectKey:'p1'})}))
})
test('one active work per project and paused rule block new execution',async()=>{
  db.projectWork.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({id:'other-job'})
  await expect(enqueueProjectWork('owner',request)).rejects.toMatchObject({code:'project_work_active'})
  db.projectDelegation.findFirst.mockResolvedValue({...rule(),enabled:false})
  await expect(enqueueProjectWork('owner',request)).rejects.toMatchObject({code:'delegation_required'})
})
test('cancellation is owned, durable and does not pretend that a running effect was undone',async()=>{
  db.projectWork.findFirst.mockResolvedValue({id:'j1',userId:'owner',memoryId:'m1',phase:'running',projectKey:'p1',revision:2})
  await cancelProjectWork('owner','j1',2)
  expect(db.projectWork.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({userId:'owner',revision:2}),data:expect.objectContaining({phase:'cancelled',revision:{increment:1}})}))
  db.projectWork.findFirst.mockResolvedValue(null)
  await expect(cancelProjectWork('other','j1',2)).rejects.toMatchObject({code:'work_not_found'})
})
