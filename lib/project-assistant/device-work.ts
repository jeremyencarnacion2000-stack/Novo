import {randomUUID,timingSafeEqual} from 'node:crypto'
import type {Prisma,ProjectWork} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import {withProviderSyncLock} from '@/lib/provider-sync-lock'
import type {CompanionOAuthPrincipal} from '@/lib/companion/auth'
import {ProjectAssistantError} from './contracts'
import {frozenWorkScopeSchema,workReportSchema,workReceiptSchema,deviceWorkCapabilitiesSchema,automaticTriggerEvidenceSchema,ownerDayStart,TERMINAL_WORK_PHASES,type WorkReport} from './work-contracts'
import {workFingerprint} from './work-fingerprint'
import {acceptVerifiedWorkResult} from './work-results'
import {requireAutomaticTracking} from './work-permissions'
import {projectTriggerEvidence} from './trigger-evidence'

const leaseMs=90_000
type Actor=CompanionOAuthPrincipal&{deviceId?:string}
export function projectWorkView(row:ProjectWork){
  const expired=['running','awaiting_confirmation'].includes(row.phase)&&Boolean(row.leaseExpiresAt&&row.leaseExpiresAt<=new Date())
  const now=Date.now(),finishedAt=row.finishedAt?.getTime()
  const resultStale=row.phase==='completed'&&row.decision===null&&Boolean(row.result)&&(!finishedAt||finishedAt>now+2*60*1000||now-finishedAt>24*60*60*1000)
  return {id:row.id,memoryId:row.memoryId,deviceId:row.deviceId,workspaceId:row.workspaceId,capability:row.capability,objective:row.objective,phase:expired?'uncertain':row.phase,revision:row.revision,sequence:row.sequence,mode:row.mode,reasonCode:expired?'lease_expired':row.reasonCode,result:row.result,decision:row.decision,resultStale,createdAt:row.createdAt?.toISOString(),updatedAt:row.updatedAt?.toISOString(),startedAt:row.startedAt?.toISOString()??null,finishedAt:row.finishedAt?.toISOString()??null}
}
async function requireBoundActor(tx:Prisma.TransactionClient,actor:Actor,deviceId:string){
  if(actor.deviceId&&actor.deviceId!==deviceId)throw new ProjectAssistantError(403,'device_authorization_mismatch')
  if(!actor.scopes.has('device:connect')||!actor.scopes.has('device:work:read')||!actor.scopes.has('device:work:execute'))throw new ProjectAssistantError(403,'device_permission_required')
  const device=await tx.companionDevice.findFirst({where:{userId:actor.userId,deviceId,clientId:actor.clientId,grantId:actor.grantId,revokedAt:null,scopes:{hasEvery:['device:work:read','device:work:execute']}},select:{id:true}})
  if(!device)throw new ProjectAssistantError(403,'device_permission_required')
}
async function requireCurrentRule(tx:Prisma.TransactionClient,userId:string,job:ProjectWork){
  if(job.mode==='automatic')await requireAutomaticTracking(tx,userId,job.memoryId,job.trigger)
  const rule=await tx.projectDelegation.findFirst({where:{id:job.delegationId,userId}})
  if(!rule||!rule.enabled||rule.version!==job.ruleVersion||rule.deviceId!==job.deviceId||rule.workspaceId!==job.workspaceId||!rule.capabilities.includes(job.capability))throw new ProjectAssistantError(403,'delegation_changed')
  const scope=frozenWorkScopeSchema.safeParse(job.scope)
  if(!scope.success||scope.data.memoryId!==job.memoryId||scope.data.deviceId!==job.deviceId||scope.data.workspaceId!==job.workspaceId)throw new ProjectAssistantError(403,'invalid_work_scope')
  const memory=await tx.projectAssistantMemory.findFirst({where:{userId,id:job.memoryId,clearedAt:null},select:{id:true}})
  const workspace=await tx.projectAssistantSource.findFirst({where:{userId,memoryId:job.memoryId,deviceId:job.deviceId,kind:'folder',sourceKey:`${job.deviceId}:${job.workspaceId}`,availability:'available'},select:{id:true,repository:true}})
  const excluded=await tx.novoSignalSourcePreference.findFirst({where:{userId,source:{in:['work_context','project_assistant']},excludedAt:{not:null}},select:{id:true}})
  if(!memory||!workspace||excluded)throw new ProjectAssistantError(403,'workspace_not_authorized')
  if(scope.data.repository&&scope.data.repository!==workspace.repository)throw new ProjectAssistantError(403,'workspace_not_authorized')
  return {rule,scope:scope.data}
}
function requireToken(job:ProjectWork,token:string){
  const hash=workFingerprint(token)
  if(!job.leaseTokenHash||job.leaseTokenHash.length!==hash.length||!timingSafeEqual(Buffer.from(job.leaseTokenHash),Buffer.from(hash)))throw new ProjectAssistantError(403,'lease_mismatch')
}
async function markUncertain(tx:Prisma.TransactionClient,job:ProjectWork){
  await tx.projectWork.updateMany({where:{id:job.id,userId:job.userId,leaseVersion:job.leaseVersion,phase:{in:['running','awaiting_confirmation']}},data:{phase:'uncertain',reasonCode:'lease_expired',revision:{increment:1}}})
}
export async function claimDeviceWork(actor:Actor,deviceId:string,capabilities:unknown=[]){
  const parsed=deviceWorkCapabilitiesSchema.safeParse(capabilities)
  if(!parsed.success)throw new ProjectAssistantError(400,'invalid_capabilities')
  return withProviderSyncLock(prisma,`project-memory:${actor.userId}`,async tx=>{
    await requireBoundActor(tx,actor,deviceId)
    const now=new Date()
    await tx.projectWork.updateMany({where:{userId:actor.userId,deviceId,phase:{in:['running','awaiting_confirmation']},leaseExpiresAt:{lte:now}},data:{phase:'uncertain',reasonCode:'lease_expired',revision:{increment:1}}})
    await tx.companionDevice.updateMany({where:{userId:actor.userId,deviceId,clientId:actor.clientId,grantId:actor.grantId,revokedAt:null},data:{workCapabilities:parsed.data,workLastSeenAt:now}})
    if(!parsed.data.length)return null
    if(await tx.projectWork.findFirst({where:{userId:actor.userId,deviceId,phase:{in:['running','awaiting_confirmation']},leaseExpiresAt:{gt:now}},select:{id:true}}))return null
    const job=await tx.projectWork.findFirst({where:{userId:actor.userId,deviceId,phase:{in:['pending','waiting_device']},capability:{in:parsed.data}},orderBy:{createdAt:'asc'}})
    if(!job)return null
    const {rule,scope}=await requireCurrentRule(tx,actor.userId,job)
    if(job.mode==='automatic'){
      const trigger=automaticTriggerEvidenceSchema.safeParse(job.trigger)
      const source=trigger.success?await tx.projectAssistantSource.findFirst({where:{userId:actor.userId,memoryId:job.memoryId,sourceKey:trigger.data.sourceKey,availability:'available'}}):null
      if(!trigger.success||!source||!projectTriggerEvidence(source,now).some(evidence=>evidence.kind===trigger.data.kind&&evidence.evidenceKey===trigger.data.evidenceKey)){
        await tx.projectWork.updateMany({where:{id:job.id,userId:actor.userId,revision:job.revision,phase:{in:['pending','waiting_device']}},data:{phase:'cancelled',reasonCode:'trigger_no_longer_current',finishedAt:now,revision:{increment:1}}});return null
      }
    }
    if(job.mode==='automatic'&&(await tx.projectWork.count({where:{userId:actor.userId,projectKey:job.projectKey,mode:'automatic',startedAt:{gte:ownerDayStart(now,rule.timezone)}}}))>=rule.dailyLimit)throw new ProjectAssistantError(409,'daily_limit_reached')
    const leaseToken=randomUUID(),leaseExpiresAt=new Date(now.getTime()+leaseMs)
    const won=await tx.projectWork.updateMany({where:{id:job.id,userId:actor.userId,revision:job.revision,phase:{in:['pending','waiting_device']}},data:{phase:'running',startedAt:now,leaseTokenHash:workFingerprint(leaseToken),leaseVersion:{increment:1},leaseExpiresAt,revision:{increment:1}}})
    if(!won.count)return null
    return {id:job.id,capability:job.capability,objective:job.objective,scope,ruleVersion:job.ruleVersion,leaseToken,leaseVersion:job.leaseVersion+1,leaseExpiresAt:leaseExpiresAt.toISOString(),sequence:job.sequence}
  })
}
export async function requireWorkStep(actor:Actor,id:string,leaseToken:string){
  const outcome=await withProviderSyncLock(prisma,`project-memory:${actor.userId}`,async tx=>{
    const job=await tx.projectWork.findFirst({where:{userId:actor.userId,id}})
    if(!job)throw new ProjectAssistantError(404,'work_not_found')
    await requireBoundActor(tx,actor,job.deviceId);requireToken(job,leaseToken)
    if(job.phase!=='running')throw new ProjectAssistantError(409,'work_not_running')
    if(!job.leaseExpiresAt||job.leaseExpiresAt<=new Date()){await markUncertain(tx,job);return {expired:true as const}}
    const {scope}=await requireCurrentRule(tx,actor.userId,job)
    await tx.projectWork.updateMany({where:{id,userId:actor.userId,leaseVersion:job.leaseVersion,phase:'running'},data:{leaseExpiresAt:new Date(Date.now()+leaseMs)}})
    return {scope,sequence:job.sequence,leaseVersion:job.leaseVersion}
  })
  if('expired'in outcome)throw new ProjectAssistantError(409,'lease_expired')
  return outcome
}
export async function reportDeviceWork(actor:Actor,id:string,input:unknown){
  const parsed=workReportSchema.safeParse(input)
  if(!parsed.success)throw new ProjectAssistantError(400,'invalid_work_report')
  const report:WorkReport=parsed.data
  const outcome=await withProviderSyncLock(prisma,`project-memory:${actor.userId}`,async tx=>{
    const job=await tx.projectWork.findFirst({where:{id,userId:actor.userId}})
    if(!job)throw new ProjectAssistantError(404,'work_not_found')
    await requireBoundActor(tx,actor,job.deviceId);requireToken(job,report.leaseToken)
    const fingerprint=workFingerprint(report.event)
    const prior=await tx.projectWorkEvent.findFirst({where:{jobId:id,userId:actor.userId,sequence:report.sequence},select:{fingerprint:true}})
    if(prior){if(prior.fingerprint!==fingerprint)throw new ProjectAssistantError(409,'event_conflict');return {work:projectWorkView(job)}}
    if(TERMINAL_WORK_PHASES.includes(job.phase)||job.phase==='uncertain')throw new ProjectAssistantError(409,'work_not_running')
    if(!job.leaseExpiresAt||job.leaseExpiresAt<=new Date()){await markUncertain(tx,job);return {expired:true as const}}
    await requireCurrentRule(tx,actor.userId,job)
    if(report.sequence!==job.sequence+1)throw new ProjectAssistantError(409,'sequence_conflict')
    const event=report.event,data:Prisma.ProjectWorkUpdateManyMutationInput={sequence:report.sequence,leaseExpiresAt:new Date(Date.now()+leaseMs),revision:{increment:1}}
    if(event.type==='started'){
      if(job.executionId&&job.executionId!==event.executionId||report.sequence!==1)throw new ProjectAssistantError(409,'execution_conflict')
      data.executionId=event.executionId;data.baseCommit=event.baseCommit
    }else if(event.type==='result'){
      if(job.executionId!==event.result.executionId||job.baseCommit!==event.result.baseCommit)throw new ProjectAssistantError(409,'execution_conflict')
      Object.assign(data,await acceptVerifiedWorkResult(tx,actor.userId,job,event.result))
    }else if(event.type==='failed'){data.phase='failed';data.reasonCode=event.reason;data.finishedAt=new Date();data.leaseExpiresAt=null}
    await tx.projectWorkEvent.create({data:{userId:actor.userId,jobId:id,sequence:report.sequence,kind:event.type,fingerprint,summary:event.type==='progress'?event.summary:event.type==='failed'?event.reason:event.type}})
    const changed=await tx.projectWork.updateMany({where:{id,userId:actor.userId,leaseVersion:job.leaseVersion,sequence:job.sequence,revision:job.revision,phase:job.phase},data})
    if(!changed.count)throw new ProjectAssistantError(409,'lease_mismatch')
    return {work:projectWorkView({...job,...data,revision:job.revision+1} as ProjectWork)}
  })
  if('expired'in outcome)throw new ProjectAssistantError(409,'lease_expired')
  return outcome.work
}

/** Reconcile a saved outcome; this never issues a new execution lease. */
export async function reconcileDeviceWork(actor:Actor,id:string,input:unknown){
  const parsed=workReceiptSchema.safeParse(input)
  if(!parsed.success)throw new ProjectAssistantError(400,'invalid_work_receipt')
  const receipt=parsed.data
  return withProviderSyncLock(prisma,`project-memory:${actor.userId}`,async tx=>{
    const job=await tx.projectWork.findFirst({where:{id,userId:actor.userId}})
    if(!job)throw new ProjectAssistantError(404,'work_not_found')
    await requireBoundActor(tx,actor,job.deviceId);requireToken(job,receipt.leaseToken)
    if(job.executionId!==receipt.executionId||receipt.outcome.type==='result'&&(receipt.outcome.result.executionId!==job.executionId||receipt.outcome.result.baseCommit!==job.baseCommit))throw new ProjectAssistantError(409,'execution_conflict')
    const fingerprint=workFingerprint(receipt)
    if(await tx.projectWorkEvent.findFirst({where:{jobId:id,userId:actor.userId,fingerprint},select:{id:true}}))return projectWorkView(job)
    if(job.phase!=='uncertain')throw new ProjectAssistantError(409,'work_not_uncertain')
    await requireCurrentRule(tx,actor.userId,job)
    const finishedAt=new Date(receipt.finishedAt)
    if(!job.leaseExpiresAt||finishedAt>job.leaseExpiresAt||finishedAt.getTime()>Date.now()+120000||job.startedAt&&finishedAt.getTime()<job.startedAt.getTime()-120000)throw new ProjectAssistantError(409,'receipt_outside_lease')
    const data:Prisma.ProjectWorkUpdateManyMutationInput={revision:{increment:1},sequence:{increment:1},finishedAt}
    if(receipt.outcome.type==='failed'){data.phase='failed';data.reasonCode=receipt.outcome.reason}else{Object.assign(data,await acceptVerifiedWorkResult(tx,actor.userId,job,receipt.outcome.result,finishedAt))}
    await tx.projectWorkEvent.create({data:{userId:actor.userId,jobId:id,sequence:job.sequence+1,kind:'execution_reconciled',summary:receipt.outcome.type,fingerprint}})
    const updated=await tx.projectWork.updateMany({where:{id,userId:actor.userId,phase:'uncertain',revision:job.revision,leaseVersion:job.leaseVersion},data})
    if(!updated.count)throw new ProjectAssistantError(409,'revision_conflict')
    return projectWorkView({...job,...data,revision:job.revision+1,sequence:job.sequence+1} as ProjectWork)
  })
}
