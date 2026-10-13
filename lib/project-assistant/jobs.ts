import type {Prisma} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import {withProviderSyncLock} from '@/lib/provider-sync-lock'
import {ProjectAssistantError,PROJECT_ASSISTANT_FRESH_MS} from './contracts'
import {requireDelegationBinding} from './delegations'
import {enqueueWorkSchema,frozenWorkScopeSchema,ownerDayStart,ACTIVE_WORK_PHASES,TERMINAL_WORK_PHASES} from './work-contracts'
import {workFingerprint} from './work-fingerprint'
import {projectTriggerEvidence} from './trigger-evidence'

export {workFingerprint} from './work-fingerprint'
export async function enqueueProjectWork(userId:string,input:unknown,now=new Date()){
  const parsed=enqueueWorkSchema.safeParse(input)
  if(!parsed.success)throw new ProjectAssistantError(400,'invalid_work_request')
  const data=parsed.data
  // One owner lock covers identity merging, quotas and all project queue mutations.
  return withProviderSyncLock(prisma,`project-memory:${userId}`,async tx=>{
    const requestKey=data.mode==='manual'?`manual:${data.requestId}`:`automatic:${workFingerprint({memoryId:data.memoryId,capability:data.capability,trigger:{kind:data.trigger!.kind,sourceKey:data.trigger!.sourceKey,evidenceKey:data.trigger!.evidenceKey}})}`
    const requestFingerprint=workFingerprint({...data,trigger:data.trigger?{kind:data.trigger.kind,sourceKey:data.trigger.sourceKey,evidenceKey:data.trigger.evidenceKey}:undefined})
    const existing=await tx.projectWork.findFirst({where:{userId,requestKey}})
    if(existing){if(existing.requestFingerprint!==requestFingerprint)throw new ProjectAssistantError(409,'request_conflict');return existing}
    const delegation=await tx.projectDelegation.findFirst({where:{userId,memoryId:data.memoryId}})
    if(!delegation||!delegation.enabled||!delegation.capabilities.includes(data.capability))throw new ProjectAssistantError(403,'delegation_required')
    const {memory,workspace}=await requireDelegationBinding(tx,userId,delegation)
    const projectKey=memory.projectId??memory.id
    if(await tx.projectWork.findFirst({where:{userId,projectKey,phase:{in:ACTIVE_WORK_PHASES}},select:{id:true}}))throw new ProjectAssistantError(409,'project_work_active')
    if(data.mode==='automatic'){
      const trigger=data.trigger!
      const age=now.getTime()-new Date(trigger.observedAt).getTime()
      if(age< -120000||age>PROJECT_ASSISTANT_FRESH_MS||!delegation.triggers.includes(trigger.kind))throw new ProjectAssistantError(403,'trigger_not_authorized')
      const source=await tx.projectAssistantSource.findFirst({where:{userId,memoryId:data.memoryId,sourceKey:trigger.sourceKey,availability:'available',observedAt:{gte:new Date(now.getTime()-PROJECT_ASSISTANT_FRESH_MS)}}})
      if(!source||!projectTriggerEvidence(source,now).some(evidence=>evidence.kind===trigger.kind&&evidence.evidenceKey===trigger.evidenceKey))throw new ProjectAssistantError(403,'trigger_not_authorized')
      const starts=await tx.projectWork.count({where:{userId,projectKey,mode:'automatic',startedAt:{gte:ownerDayStart(now,delegation.timezone)}}})
      if(starts>=delegation.dailyLimit)throw new ProjectAssistantError(409,'daily_limit_reached')
    }
    const scope=frozenWorkScopeSchema.parse({memoryId:memory.id,deviceId:delegation.deviceId,workspaceId:delegation.workspaceId,repository:workspace.repository??undefined,verification:delegation.verification,timeoutSeconds:delegation.timeoutSeconds??600})
    return tx.projectWork.create({data:{userId,memoryId:memory.id,projectKey,delegationId:delegation.id,ruleVersion:delegation.version,deviceId:delegation.deviceId,workspaceId:delegation.workspaceId,capability:data.capability,objective:data.objective,mode:data.mode,requestKey,requestFingerprint,trigger:data.trigger as Prisma.InputJsonValue|undefined,scope:scope as Prisma.InputJsonValue,phase:'waiting_device'}})
  })
}
export async function cancelProjectWork(userId:string,id:string,revision:number){
  if(!Number.isSafeInteger(revision)||revision<1)throw new ProjectAssistantError(400,'invalid_revision')
  await withProviderSyncLock(prisma,`project-memory:${userId}`,async tx=>{
    const job=await tx.projectWork.findFirst({where:{id,userId}})
    if(!job)throw new ProjectAssistantError(404,'work_not_found')
    if(TERMINAL_WORK_PHASES.includes(job.phase))return
    const changed=await tx.projectWork.updateMany({where:{id,userId,revision},data:{phase:'cancelled',revision:{increment:1},leaseExpiresAt:null,finishedAt:new Date(),reasonCode:job.phase==='running'?'execution_stop_requested':null}})
    if(!changed.count)throw new ProjectAssistantError(409,'revision_conflict')
  })
}
