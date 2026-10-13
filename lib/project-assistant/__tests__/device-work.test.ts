/** @jest-environment node */
jest.mock('@/lib/prisma',()=>({prisma:{$transaction:jest.fn(),$executeRaw:jest.fn(),companionDevice:{findFirst:jest.fn(),updateMany:jest.fn()},projectAssistantMemory:{findFirst:jest.fn()},projectAssistantSource:{findFirst:jest.fn()},novoSignalSourcePreference:{findFirst:jest.fn()},projectDelegation:{findFirst:jest.fn()},projectWork:{findFirst:jest.fn(),updateMany:jest.fn(),count:jest.fn()},projectWorkEvent:{findFirst:jest.fn(),create:jest.fn()}}}))
import {prisma} from '@/lib/prisma'
import {claimDeviceWork,requireWorkStep,reportDeviceWork,reconcileDeviceWork} from '../device-work'
import {workFingerprint} from '../work-fingerprint'
const db=prisma as any,deviceId='cd78b30e-93ca-4bd0-893a-a3f709b2f105',workspaceId='bcf7c70d-6d39-4bb9-86d2-9e75509c1b69'
const actor={userId:'owner',clientId:'client',grantId:'grant',scopes:new Set(['device:connect','device:work:read','device:work:execute']),expiresAt:Date.now()/1000+3600}
let job:any,events:any[],serial:Promise<unknown>
beforeEach(()=>{
  jest.clearAllMocks();events=[];serial=Promise.resolve()
  db.$transaction.mockImplementation((work:any)=>{const next=serial.then(()=>work(db));serial=next.catch(()=>{});return next})
  job={id:'j1',userId:'owner',memoryId:'m1',projectKey:'p1',delegationId:'r1',ruleVersion:1,deviceId,workspaceId,capability:'project.diagnose',objective:'Diagnosticar proyecto',phase:'waiting_device',revision:1,mode:'manual',sequence:0,leaseVersion:0,scope:{memoryId:'m1',deviceId,workspaceId,verification:[],timeoutSeconds:600}}
  db.companionDevice.findFirst.mockResolvedValue({id:'device',deviceId,clientId:'client',grantId:'grant',revokedAt:null})
  db.projectAssistantMemory.findFirst.mockResolvedValue({id:'m1',clearedAt:null})
  db.projectAssistantSource.findFirst.mockResolvedValue({id:'source',availability:'available',facts:{workspaceId}})
  db.novoSignalSourcePreference.findFirst.mockResolvedValue(null)
  db.projectDelegation.findFirst.mockResolvedValue({id:'r1',version:1,enabled:true,deviceId,workspaceId,capabilities:['project.diagnose'],dailyLimit:3,timezone:'America/La_Paz'})
  db.projectWork.findFirst.mockImplementation(async({where}:any)=>where.userId===job.userId&&(!where.id||where.id===job.id)&&(!where.deviceId||where.deviceId===job.deviceId)&&(!where.phase?.in||where.phase.in.includes(job.phase))?{...job}:null)
  db.projectWork.updateMany.mockImplementation(async({where,data}:any)=>{if(where.id&&where.id!==job.id||where.leaseVersion!==undefined&&where.leaseVersion!==job.leaseVersion||where.phase?.in&&!where.phase.in.includes(job.phase)||where.leaseExpiresAt?.lte&&(!job.leaseExpiresAt||job.leaseExpiresAt>where.leaseExpiresAt.lte))return {count:0};for(const [key,value] of Object.entries(data) as any)job[key]=value?.increment?job[key]+value.increment:value;return {count:1}})
  db.projectWork.count.mockResolvedValue(0)
  db.projectWorkEvent.findFirst.mockImplementation(async({where}:any)=>events.find(event=>event.userId===where.userId&&event.jobId===where.jobId&&event.sequence===where.sequence)??null)
  db.projectWorkEvent.create.mockImplementation(async({data}:any)=>{events.push(data);return data})
})
test('racing claims start a job once and never assign it to another device',async()=>{
  const [first,second]=await Promise.all([claimDeviceWork(actor,deviceId,['project.diagnose']),claimDeviceWork(actor,deviceId,['project.diagnose'])])
  expect([first,second].filter(Boolean)).toHaveLength(1)
  expect(job.phase).toBe('running');expect(job.leaseVersion).toBe(1)
  expect(await claimDeviceWork(actor,workspaceId,['project.diagnose'])).toBeNull()
})
test('missing runtime stays waiting and stale leases become uncertain without a second launch',async()=>{
  expect(await claimDeviceWork(actor,deviceId,[])).toBeNull();expect(job.phase).toBe('waiting_device')
  const claim=await claimDeviceWork(actor,deviceId,['project.diagnose'])
  job.leaseExpiresAt=new Date(Date.now()-1)
  expect(await claimDeviceWork(actor,deviceId,['project.diagnose'])).toBeNull()
  expect(job.phase).toBe('uncertain')
  await expect(requireWorkStep(actor,'j1',claim!.leaseToken)).rejects.toMatchObject({code:'work_not_running'})
})
test('revocation, foreign job, paused/revised rule and cancellation fence the next step',async()=>{
  const claim=await claimDeviceWork(actor,deviceId,['project.diagnose'])
  await expect(requireWorkStep({...actor,userId:'other'},'j1',claim!.leaseToken)).rejects.toMatchObject({code:'work_not_found'})
  db.projectDelegation.findFirst.mockResolvedValue({id:'r1',version:2,enabled:true})
  await expect(requireWorkStep(actor,'j1',claim!.leaseToken)).rejects.toMatchObject({code:'delegation_changed'})
  db.projectDelegation.findFirst.mockResolvedValue({id:'r1',version:1,enabled:false})
  await expect(requireWorkStep(actor,'j1',claim!.leaseToken)).rejects.toMatchObject({code:'delegation_changed'})
  db.companionDevice.findFirst.mockResolvedValue(null)
  await expect(requireWorkStep(actor,'j1',claim!.leaseToken)).rejects.toMatchObject({code:'device_permission_required'})
  db.companionDevice.findFirst.mockResolvedValue({id:'device'})
  job.phase='cancelled'
  await expect(requireWorkStep(actor,'j1',claim!.leaseToken)).rejects.toMatchObject({code:'work_not_running'})
})
test('reports are ordered, replayed exactly and cannot extend an expired execution',async()=>{
  const claim=await claimDeviceWork(actor,deviceId,['project.diagnose'])
  const report={leaseToken:claim!.leaseToken,sequence:1,event:{type:'started',executionId:workspaceId,baseCommit:'a'.repeat(40)}}
  await reportDeviceWork(actor,'j1',report);await reportDeviceWork(actor,'j1',report)
  expect(events).toHaveLength(1);expect(events[0].fingerprint).toBe(workFingerprint(report.event))
  await expect(reportDeviceWork(actor,'j1',{...report,event:{...report.event,baseCommit:'b'.repeat(40)}})).rejects.toMatchObject({code:'event_conflict'})
  await expect(reportDeviceWork(actor,'j1',{...report,sequence:3,event:{type:'heartbeat'}})).rejects.toMatchObject({code:'sequence_conflict'})
  job.leaseExpiresAt=new Date(Date.now()-1)
  await expect(reportDeviceWork(actor,'j1',{...report,sequence:2,event:{type:'heartbeat'}})).rejects.toMatchObject({code:'lease_expired'})
  expect(job.phase).toBe('uncertain')
})
test('the transport device must match the frozen executor device',async()=>{
  const claim=await claimDeviceWork(actor,deviceId,['project.diagnose'])
  await expect(requireWorkStep({...actor,deviceId:workspaceId},'j1',claim!.leaseToken)).rejects.toMatchObject({code:'device_authorization_mismatch'})
})
test('an expired execution is reconciled from its saved terminal receipt without granting a new launch',async()=>{
  const claim=await claimDeviceWork(actor,deviceId,['project.diagnose'])
  await reportDeviceWork(actor,'j1',{leaseToken:claim!.leaseToken,sequence:1,event:{type:'started',executionId:workspaceId,baseCommit:'a'.repeat(40)}})
  job.leaseExpiresAt=new Date(Date.now()-1)
  await claimDeviceWork(actor,deviceId,['project.diagnose'])
  const receipt={leaseToken:claim!.leaseToken,executionId:workspaceId,finishedAt:new Date(Date.now()-1000).toISOString(),outcome:{type:'failed',reason:'timeout'}}
  expect((await reconcileDeviceWork(actor,'j1',receipt)).phase).toBe('failed')
  expect(job.leaseVersion).toBe(1)
  await expect(reconcileDeviceWork(actor,'j1',{...receipt,executionId:deviceId})).rejects.toMatchObject({code:'execution_conflict'})
})
