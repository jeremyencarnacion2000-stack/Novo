import type {Prisma,ProjectWork} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import {withProviderSyncLock} from '@/lib/provider-sync-lock'
import {ProjectAssistantError} from './contracts'
import {workResultSchema,frozenWorkScopeSchema} from './work-contracts'
import {requireDelegationBinding} from './delegations'
import {workFingerprint} from './work-fingerprint'
import {executeApprovedServiceAction,internalWorkOperationSchema,type InternalWorkOperation} from './service-actions'

const prepareSchema=z.object({revision:z.number().int().positive(),requestId:z.string().uuid(),operation:internalWorkOperationSchema}).strict()
const decideSchema=z.object({revision:z.number().int().positive(),requestId:z.string().uuid(),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),decision:z.enum(['confirm','deny'])}).strict()
type Operation=InternalWorkOperation
type StoredDecision={version:1;state:'pending'|'applied'|'denied'|'expired';requestId:string;fingerprint:string;operation:Operation;proposedAt:string;expiresAt:string;decidedAt?:string;decision?:'confirm'|'deny';operationResult?:{kind:string;resourceId:string}}
const decisionMs=24*60*60*1000
const allowedFutureSkewMs=2*60*1000

function fail(status:400|403|404|409,code:string):never{throw new ProjectAssistantError(status,code)}
function parsedDecision(value:unknown){return z.object({version:z.literal(1),state:z.enum(['pending','applied','denied','expired']),requestId:z.string().uuid(),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),operation:internalWorkOperationSchema,proposedAt:z.string().datetime({offset:true}),expiresAt:z.string().datetime({offset:true}),decidedAt:z.string().datetime({offset:true}).optional(),decision:z.enum(['confirm','deny']).optional(),operationResult:z.object({kind:z.string(),resourceId:z.string()}).strict().optional()}).strict().safeParse(value)}
function sameIdempotentDecision(stored:StoredDecision,input:z.infer<typeof decideSchema>){return stored.requestId===input.requestId&&stored.fingerprint===input.fingerprint&&stored.decision===input.decision&&((input.decision==='confirm'&&stored.state==='applied')||(input.decision==='deny'&&stored.state==='denied'))}
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

export async function prepareProjectWorkAction(userId:string,id:string,input:unknown,now=new Date()){
  const parsed=prepareSchema.safeParse(input)
  if(!parsed.success)fail(400,'invalid_work_decision')
  return withProviderSyncLock(prisma,`project-memory:${userId}`,async tx=>{
    const job=await ownedWork(tx,userId,id),operation=parsed.data.operation,fingerprint=decisionFingerprint(id,parsed.data.requestId,operation)
    const existing=parsedDecision(job.decision)
    if(existing.success&&existing.data.requestId===parsed.data.requestId){if(existing.data.fingerprint!==fingerprint)fail(409,'decision_mismatch');return job}
    if(job.revision!==parsed.data.revision)fail(409,'revision_conflict')
    if(job.phase!=='completed'||!workResultSchema.safeParse(job.result).success)fail(409,'work_not_ready')
    if(!job.finishedAt||job.finishedAt.getTime()>now.getTime()+allowedFutureSkewMs||now.getTime()-job.finishedAt.getTime()>decisionMs)fail(409,'result_stale')
    if(job.decision!==null)fail(409,'decision_already_used')
    await requireCurrentBinding(tx,userId,job)
    const next:StoredDecision={version:1,state:'pending',requestId:parsed.data.requestId,fingerprint,operation,proposedAt:now.toISOString(),expiresAt:new Date(now.getTime()+decisionMs).toISOString()}
    const changed=await tx.projectWork.updateMany({where:{id,userId,revision:job.revision,phase:'completed'},data:{phase:'awaiting_confirmation',decision:next as Prisma.InputJsonValue,revision:{increment:1},sequence:{increment:1},leaseExpiresAt:null}})
    if(!changed.count)fail(409,'revision_conflict')
    await tx.projectWorkEvent.create({data:{userId,jobId:id,sequence:job.sequence+1,kind:'action_requested',summary:'Novo preparó una acción interna para que la revises.',fingerprint}})
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
    if(sameIdempotentDecision(decision,parsed.data))return {job,idempotent:true,expired:false,expiredCode:null}
    if(job.phase!=='awaiting_confirmation'||decision.state!=='pending')fail(409,'decision_not_pending')
    if(job.revision!==parsed.data.revision)fail(409,'revision_conflict')
    if(decision.requestId!==parsed.data.requestId||decision.fingerprint!==parsed.data.fingerprint)fail(409,'decision_mismatch')
    const decisionExpired=Date.parse(decision.expiresAt)<=now.getTime(),evidenceExpired=!job.finishedAt||job.finishedAt.getTime()>now.getTime()+allowedFutureSkewMs||now.getTime()-job.finishedAt.getTime()>decisionMs
    if(decisionExpired||evidenceExpired){
      const expired={...decision,state:'expired' as const,decidedAt:now.toISOString()}
      const changed=await tx.projectWork.updateMany({where:{id,userId,revision:job.revision,phase:'awaiting_confirmation'},data:{phase:'completed',decision:expired as Prisma.InputJsonValue,revision:{increment:1},sequence:{increment:1},finishedAt:now,leaseExpiresAt:null}})
      if(!changed.count)fail(409,'revision_conflict')
      await tx.projectWorkEvent.create({data:{userId,jobId:id,sequence:job.sequence+1,kind:'action_expired',summary:'La autorización de esta acción venció sin ejecutarse.',fingerprint:decision.fingerprint}})
      return {job:{...job,phase:'completed',decision:expired,revision:job.revision+1,sequence:job.sequence+1},idempotent:false,expired:true,expiredCode:decisionExpired?'decision_expired':'result_stale'}
    }
    await requireCurrentBinding(tx,userId,job)
    let operationResult:StoredDecision['operationResult']
    if(parsed.data.decision==='confirm')operationResult=await executeApprovedServiceAction(tx,userId,decision.operation)
    const next:StoredDecision={...decision,state:parsed.data.decision==='confirm'?'applied':'denied',decidedAt:now.toISOString(),decision:parsed.data.decision,...(operationResult?{operationResult}:{})}
    const changed=await tx.projectWork.updateMany({where:{id,userId,revision:job.revision,phase:'awaiting_confirmation'},data:{phase:'completed',decision:next as Prisma.InputJsonValue,revision:{increment:1},sequence:{increment:1},finishedAt:now,leaseExpiresAt:null}})
    if(!changed.count)fail(409,'revision_conflict')
    await tx.projectWorkEvent.create({data:{userId,jobId:id,sequence:job.sequence+1,kind:parsed.data.decision==='confirm'?'action_applied':'action_denied',summary:parsed.data.decision==='confirm'?'La acción aprobada se guardó en Novo.':'Se rechazó la acción sin modificar tus datos.',fingerprint:decision.fingerprint}})
    return {job:{...job,phase:'completed',decision:next,revision:job.revision+1,sequence:job.sequence+1,finishedAt:now},idempotent:false,expired:false,expiredCode:null}
  })
  if(outcome.expired)fail(409,outcome.expiredCode??'decision_expired')
  return outcome.job
}
