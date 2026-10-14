import type {Prisma,ProjectWork} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import {withProviderSyncLock} from '@/lib/provider-sync-lock'
import {ProjectAssistantError} from './contracts'
import {workResultSchema,frozenWorkScopeSchema} from './work-contracts'
import {requireDelegationBinding} from './delegations'
import {workFingerprint} from './work-fingerprint'
import {approvedWorkOperationSchema,executeApprovedServiceAction,internalWorkOperationSchema,providerWorkOperationSchema,type ApprovedWorkOperation} from './service-actions'
import {dispatchApprovedProviderAction,ProviderActionError} from './provider-actions'

const prepareSchema=z.object({revision:z.number().int().positive(),requestId:z.string().uuid(),operation:approvedWorkOperationSchema}).strict()
const decideSchema=z.object({revision:z.number().int().positive(),requestId:z.string().uuid(),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),decision:z.enum(['confirm','deny'])}).strict()
type Operation=ApprovedWorkOperation
type StoredDecision={version:1;state:'pending'|'executing'|'applied'|'denied'|'expired'|'failed'|'uncertain';requestId:string;fingerprint:string;operation:Operation;proposedAt:string;expiresAt:string;startedAt?:string;decidedAt?:string;decision?:'confirm'|'deny';operationResult?:{kind:string;resourceId:string};failureCode?:string}
const decisionMs=24*60*60*1000
const allowedFutureSkewMs=2*60*1000
const abandonedDispatchMs=2*60*1000
const safeProviderFailureCodes=['github_not_connected','github_repo_permission_required','github_auth_required','github_permission_denied','github_rate_limited','github_issue_rejected','github_result_unknown','vercel_not_connected','vercel_auth_required','vercel_project_not_selected','vercel_deployment_unavailable','vercel_deployment_not_selected','vercel_permission_denied','vercel_rate_limited','vercel_redeploy_rejected','vercel_result_unknown','provider_result_unknown'] as const

function fail(status:400|403|404|409,code:string):never{throw new ProjectAssistantError(status,code)}
function parsedDecision(value:unknown){return z.object({version:z.literal(1),state:z.enum(['pending','executing','applied','denied','expired','failed','uncertain']),requestId:z.string().uuid(),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),operation:approvedWorkOperationSchema,proposedAt:z.string().datetime({offset:true}),expiresAt:z.string().datetime({offset:true}),startedAt:z.string().datetime({offset:true}).optional(),decidedAt:z.string().datetime({offset:true}).optional(),decision:z.enum(['confirm','deny']).optional(),operationResult:z.object({kind:z.string(),resourceId:z.string()}).strict().optional(),failureCode:z.enum(safeProviderFailureCodes).optional()}).strict().safeParse(value)}
function matchesDecision(stored:StoredDecision,input:z.infer<typeof decideSchema>){return stored.requestId===input.requestId&&stored.fingerprint===input.fingerprint&&stored.decision===input.decision&&((input.decision==='confirm'&&['executing','applied','failed','uncertain'].includes(stored.state))||(input.decision==='deny'&&stored.state==='denied'))}
async function ownedWork(tx:Prisma.TransactionClient,userId:string,id:string){
  const job=await tx.projectWork.findFirst({where:{id,userId}})
  if(!job||job.userId!==userId)fail(404,'work_not_found')
  return job as ProjectWork
}
async function requireCurrentBinding(tx:Prisma.TransactionClient,userId:string,job:ProjectWork){
  const scope=frozenWorkScopeSchema.safeParse(job.scope)
  const rule=await tx.projectDelegation.findFirst({where:{id:job.delegationId,userId}})
  if(!scope.success||!rule||!rule.enabled||rule.version!==job.ruleVersion||rule.memoryId!==job.memoryId||rule.deviceId!==job.deviceId||rule.workspaceId!==job.workspaceId)fail(403,'delegation_changed')
  await requireDelegationBinding(tx,userId,{memoryId:job.memoryId,deviceId:job.deviceId,workspaceId:job.workspaceId})
}
function decisionFingerprint(jobId:string,requestId:string,operation:Operation){return workFingerprint({kind:'project_assistant_operation',jobId,requestId,operation})}

/** Closes abandoned provider dispatch claims after the adapter timeout without replaying them. */
export async function reconcileAbandonedProviderActions(userId:string,now=new Date()){
  return withProviderSyncLock(prisma,`project-memory:${userId}`,async tx=>{
    const candidates=await tx.projectWork.findMany({where:{userId,phase:'awaiting_confirmation'},orderBy:{updatedAt:'asc'},take:50})
    let reconciled=0
    for(const job of candidates){
      const parsed=parsedDecision(job.decision)
      if(!parsed.success||parsed.data.state!=='executing'||!parsed.data.startedAt||now.getTime()-Date.parse(parsed.data.startedAt)<abandonedDispatchMs)continue
      const decision=parsed.data as StoredDecision,next:StoredDecision={...decision,state:'uncertain',failureCode:'provider_result_unknown',decidedAt:now.toISOString()}
      const changed=await tx.projectWork.updateMany({where:{id:job.id,userId,revision:job.revision,phase:'awaiting_confirmation'},data:{phase:'uncertain',decision:next as Prisma.InputJsonValue,revision:{increment:1},sequence:{increment:1},leaseExpiresAt:null}})
      if(!changed.count)continue
      await tx.projectWorkEvent.create({data:{userId,jobId:job.id,sequence:job.sequence+1,kind:'action_uncertain',summary:'El proveedor pudo recibir la acción, pero Novo no obtuvo una confirmación. No se repetirá automáticamente.',fingerprint:decision.fingerprint}})
      reconciled++
    }
    return reconciled
  })
}

export async function prepareProjectWorkAction(userId:string,id:string,input:unknown,now=new Date()){
  const parsed=prepareSchema.safeParse(input)
  if(!parsed.success)fail(400,'invalid_work_decision')
  return withProviderSyncLock(prisma,`project-memory:${userId}`,async tx=>{
    const job=await ownedWork(tx,userId,id),operation=parsed.data.operation,fingerprint=decisionFingerprint(id,parsed.data.requestId,operation)
    const existing=parsedDecision(job.decision)
    if(existing.success&&existing.data.requestId===parsed.data.requestId){if(existing.data.fingerprint!==fingerprint)fail(409,'decision_mismatch');return job}
    if(job.revision!==parsed.data.revision)fail(409,'revision_conflict')
    const retryAfterKnownFailure=existing.success&&existing.data.state==='failed'&&job.phase==='failed'
    if(!(job.phase==='completed'||retryAfterKnownFailure)||!workResultSchema.safeParse(job.result).success)fail(409,'work_not_ready')
    if(!job.finishedAt||job.finishedAt.getTime()>now.getTime()+allowedFutureSkewMs||now.getTime()-job.finishedAt.getTime()>decisionMs)fail(409,'result_stale')
    if(job.decision!==null&&!retryAfterKnownFailure)fail(409,'decision_already_used')
    await requireCurrentBinding(tx,userId,job)
    const next:StoredDecision={version:1,state:'pending',requestId:parsed.data.requestId,fingerprint,operation,proposedAt:now.toISOString(),expiresAt:new Date(now.getTime()+decisionMs).toISOString()}
    const changed=await tx.projectWork.updateMany({where:{id,userId,revision:job.revision,phase:retryAfterKnownFailure?'failed':'completed'},data:{phase:'awaiting_confirmation',decision:next as Prisma.InputJsonValue,revision:{increment:1},sequence:{increment:1},leaseExpiresAt:null}})
    if(!changed.count)fail(409,'revision_conflict')
    await tx.projectWorkEvent.create({data:{userId,jobId:id,sequence:job.sequence+1,kind:'action_requested',summary:'Novo preparó una acción para que la revises.',fingerprint}})
    return {...job,phase:'awaiting_confirmation',decision:next,revision:job.revision+1,sequence:job.sequence+1}
  })
}

export async function decideProjectWorkAction(userId:string,id:string,input:unknown,now=new Date()){
  const parsed=decideSchema.safeParse(input)
  if(!parsed.success)fail(400,'invalid_work_decision')
  const outcome=await withProviderSyncLock(prisma,`project-memory:${userId}`,async tx=>{
    const job=await ownedWork(tx,userId,id),stored=parsedDecision(job.decision)
    if(!stored.success)fail(409,'decision_not_pending')
    const decision=stored.data as StoredDecision
    if(matchesDecision(decision,parsed.data)){
      if(decision.state!=='executing'||!decision.startedAt||now.getTime()-Date.parse(decision.startedAt)<abandonedDispatchMs)return {kind:'done' as const,job}
      // A server may have stopped after dispatch. Close the receipt as uncertain;
      // never send the provider write a second time.
      const uncertain:StoredDecision={...decision,state:'uncertain',failureCode:'provider_result_unknown',decidedAt:now.toISOString()}
      const changed=await tx.projectWork.updateMany({where:{id,userId,revision:job.revision,phase:'awaiting_confirmation'},data:{phase:'uncertain',decision:uncertain as Prisma.InputJsonValue,revision:{increment:1},sequence:{increment:1},leaseExpiresAt:null}})
      if(!changed.count)fail(409,'revision_conflict')
      await tx.projectWorkEvent.create({data:{userId,jobId:id,sequence:job.sequence+1,kind:'action_uncertain',summary:'El proveedor pudo recibir la acción, pero Novo no obtuvo una confirmación. No se repetirá automáticamente.',fingerprint:decision.fingerprint}})
      return {kind:'done' as const,job:{...job,phase:'uncertain',decision:uncertain,revision:job.revision+1,sequence:job.sequence+1}}
    }
    if(job.phase!=='awaiting_confirmation'||decision.state!=='pending')fail(409,'decision_not_pending')
    if(job.revision!==parsed.data.revision)fail(409,'revision_conflict')
    if(decision.requestId!==parsed.data.requestId||decision.fingerprint!==parsed.data.fingerprint)fail(409,'decision_mismatch')
    const decisionExpired=Date.parse(decision.expiresAt)<=now.getTime(),evidenceExpired=!job.finishedAt||job.finishedAt.getTime()>now.getTime()+allowedFutureSkewMs||now.getTime()-job.finishedAt.getTime()>decisionMs
    if(decisionExpired||evidenceExpired){
      const expired={...decision,state:'expired' as const,decidedAt:now.toISOString()}
      const changed=await tx.projectWork.updateMany({where:{id,userId,revision:job.revision,phase:'awaiting_confirmation'},data:{phase:'completed',decision:expired as Prisma.InputJsonValue,revision:{increment:1},sequence:{increment:1},finishedAt:now,leaseExpiresAt:null}})
      if(!changed.count)fail(409,'revision_conflict')
      await tx.projectWorkEvent.create({data:{userId,jobId:id,sequence:job.sequence+1,kind:'action_expired',summary:'La autorización de esta acción venció sin ejecutarse.',fingerprint:decision.fingerprint}})
      return {kind:'expired' as const,job:{...job,phase:'completed',decision:expired,revision:job.revision+1,sequence:job.sequence+1},expiredCode:decisionExpired?'decision_expired':'result_stale'}
    }
    await requireCurrentBinding(tx,userId,job)
    const providerOperation=providerWorkOperationSchema.safeParse(decision.operation)
    if(parsed.data.decision==='confirm'&&providerOperation.success){
      const executing:StoredDecision={...decision,state:'executing',startedAt:now.toISOString(),decision:'confirm'}
      const changed=await tx.projectWork.updateMany({where:{id,userId,revision:job.revision,phase:'awaiting_confirmation'},data:{decision:executing as Prisma.InputJsonValue,revision:{increment:1},sequence:{increment:1}}})
      if(!changed.count)fail(409,'revision_conflict')
      await tx.projectWorkEvent.create({data:{userId,jobId:id,sequence:job.sequence+1,kind:'action_started',summary:'Novo inició la acción externa que aprobaste.',fingerprint:decision.fingerprint}})
      return {kind:'dispatch' as const,job:{...job,decision:executing,revision:job.revision+1,sequence:job.sequence+1},operation:providerOperation.data,requestId:decision.requestId,fingerprint:decision.fingerprint}
    }
    let operationResult:StoredDecision['operationResult']
    if(parsed.data.decision==='confirm')operationResult=await executeApprovedServiceAction(tx,userId,internalWorkOperationSchema.parse(decision.operation))
    const next:StoredDecision={...decision,state:parsed.data.decision==='confirm'?'applied':'denied',decidedAt:now.toISOString(),decision:parsed.data.decision,...(operationResult?{operationResult}:{})}
    const changed=await tx.projectWork.updateMany({where:{id,userId,revision:job.revision,phase:'awaiting_confirmation'},data:{phase:'completed',decision:next as Prisma.InputJsonValue,revision:{increment:1},sequence:{increment:1},finishedAt:now,leaseExpiresAt:null}})
    if(!changed.count)fail(409,'revision_conflict')
    await tx.projectWorkEvent.create({data:{userId,jobId:id,sequence:job.sequence+1,kind:parsed.data.decision==='confirm'?'action_applied':'action_denied',summary:parsed.data.decision==='confirm'?'La acción aprobada se guardó en Novo.':'Se rechazó la acción sin modificar tus datos.',fingerprint:decision.fingerprint}})
    return {kind:'done' as const,job:{...job,phase:'completed',decision:next,revision:job.revision+1,sequence:job.sequence+1,finishedAt:now}}
  })
  if(outcome.kind==='expired')fail(409,outcome.expiredCode)
  if(outcome.kind==='done')return outcome.job

  let state:'applied'|'failed'|'uncertain'='applied'
  let result:{kind:string;resourceId:string}|undefined
  let failureCode:string|undefined
  try{result=await dispatchApprovedProviderAction(userId,outcome.operation,outcome.requestId)}
  catch(error){
    if(error instanceof ProviderActionError){state=error.state;failureCode=safeProviderFailureCodes.includes(error.code as typeof safeProviderFailureCodes[number])?error.code:'provider_result_unknown'}
    else{state='uncertain';failureCode='provider_result_unknown'}
  }
  const finalJob=await withProviderSyncLock(prisma,`project-memory:${userId}`,async tx=>{
    const current=await ownedWork(tx,userId,id),stored=parsedDecision(current.decision)
    if(!stored.success||stored.data.state!=='executing'||stored.data.requestId!==outcome.requestId||stored.data.fingerprint!==outcome.fingerprint)return current
    const decision=stored.data as StoredDecision
    const next:StoredDecision={...decision,state,decidedAt:new Date().toISOString(),...(result?{operationResult:result}:{}),...(failureCode?{failureCode}:{})}
    const phase=state==='applied'?'completed':state
    const changed=await tx.projectWork.updateMany({where:{id,userId,revision:current.revision,phase:'awaiting_confirmation'},data:{phase,decision:next as Prisma.InputJsonValue,revision:{increment:1},sequence:{increment:1},reasonCode:failureCode??current.reasonCode,leaseExpiresAt:null}})
    if(!changed.count)fail(409,'revision_conflict')
    const kind=state==='applied'?'action_applied':state==='uncertain'?'action_uncertain':'action_failed'
    const summary=state==='applied'?'La acción externa aprobada se completó.':state==='uncertain'?'El proveedor pudo recibir la acción, pero Novo no obtuvo una confirmación. No se repetirá automáticamente.':'El proveedor rechazó la acción; no se volverá a enviar automáticamente.'
    await tx.projectWorkEvent.create({data:{userId,jobId:id,sequence:current.sequence+1,kind,summary,fingerprint:decision.fingerprint}})
    return {...current,phase,decision:next,revision:current.revision+1,sequence:current.sequence+1,reasonCode:failureCode??current.reasonCode,leaseExpiresAt:null}
  })
  return finalJob
}
