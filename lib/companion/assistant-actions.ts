import {createHash} from 'node:crypto'
import type {Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import {emitTwinSignal} from '@/lib/twin-signal'
import {CompanionError,type CompanionOAuthPrincipal} from './auth'
import {requireActiveCompanionDevice} from './devices'

const taskCreateSchema=z.object({type:z.literal('task.create'),title:z.string().trim().min(1).max(180),priority:z.enum(['low','medium','high']).default('medium')}).strict()
const decisionSchema=z.object({revision:z.number().int().positive(),decision:z.enum(['confirm','deny'])}).strict()
const actionResultSchema=z.object({kind:z.literal('task.created'),resourceId:z.string().min(1).max(64),title:z.string().min(1).max(180),priority:z.enum(['low','medium','high'])}).strict().nullable()
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
type AssistantTaskOperation=z.infer<typeof taskCreateSchema>

function requireTaskWrite(actor:CompanionOAuthPrincipal){
  if(!actor.scopes.has('tasks:write'))throw new CompanionError(403,'permission_required')
}
function actionView(row:{id:string;requestId:string;operation:Prisma.JsonValue;status:string;revision:number;expiresAt:Date;approvedAt:Date|null;completedAt:Date|null;result:Prisma.JsonValue|null}){
  const operation=taskCreateSchema.safeParse(row.operation)
  const result=actionResultSchema.safeParse(row.result)
  if(!operation.success||!result.success||!['proposed','succeeded','rejected','expired'].includes(row.status)||!Number.isSafeInteger(row.revision)||row.revision<1)
    throw new CompanionError(503,'authorization_unavailable')
  return {id:row.id,requestId:row.requestId,type:operation.data.type,title:operation.data.title,priority:operation.data.priority,
    status:row.status as 'proposed'|'succeeded'|'rejected'|'expired',revision:row.revision,expiresAt:row.expiresAt.toISOString(),approvedAt:row.approvedAt?.toISOString()??null,
    completedAt:row.completedAt?.toISOString()??null,result:result.data}
}

async function lockDevice(tx:Prisma.TransactionClient,userId:string,deviceId:string){
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`novo:device:${userId}:${deviceId}`}, 0))`
}
async function audit(tx:Prisma.TransactionClient,actor:CompanionOAuthPrincipal,actionId:string,requestId:string,action:string,status:'succeeded'|'rejected'){
  await tx.mcpAuditLog.create({data:{userId:actor.userId,clientId:actor.clientId,tool:'assistant_action',action,
    resourceType:'assistant_action',resourceId:actionId,resultStatus:status,resultSummary:'Assistant action decision recorded',
    idempotencyKey:`assistant-action:${requestId}:${action}`,requestId,completedAt:new Date()}})
}

export async function prepareAssistantAction(actor:CompanionOAuthPrincipal,deviceId:string,requestId:string,raw:unknown,now=new Date()){
  requireTaskWrite(actor)
  await requireActiveCompanionDevice(actor,deviceId)
  const parsed=taskCreateSchema.safeParse(raw)
  if(!parsed.success||!z.string().uuid().safeParse(requestId).success)throw new CompanionError(400,'invalid_request')
  const operation:AssistantTaskOperation=parsed.data
  const fingerprint=digest(operation)
  const existing=await prisma.assistantActionRequest.findUnique({where:{requestId}})
  if(existing){
    if(existing.userId!==actor.userId||existing.deviceId!==deviceId||existing.clientId!==actor.clientId||existing.grantId!==actor.grantId||existing.fingerprint!==fingerprint)throw new CompanionError(409,'request_conflict')
    return actionView(existing)
  }
  const device=await prisma.companionDevice.findFirst({where:{userId:actor.userId,deviceId,clientId:actor.clientId,grantId:actor.grantId,revokedAt:null},select:{id:true}})
  if(!device)throw new CompanionError(403,'device_revoked')
  const id=await prisma.$transaction(async tx=>{
    await lockDevice(tx,actor.userId,deviceId)
    const current=await tx.companionDevice.findFirst({where:{id:device.id,userId:actor.userId,deviceId,clientId:actor.clientId,grantId:actor.grantId,revokedAt:null},select:{id:true}})
    if(!current)throw new CompanionError(403,'device_revoked')
    const prior=await tx.assistantActionRequest.findUnique({where:{requestId}})
    if(prior){
      if(prior.userId!==actor.userId||prior.deviceId!==deviceId||prior.clientId!==actor.clientId||prior.grantId!==actor.grantId||prior.fingerprint!==fingerprint)throw new CompanionError(409,'request_conflict')
      return prior.id
    }
    const row=await tx.assistantActionRequest.create({data:{requestId,userId:actor.userId,deviceId,clientId:actor.clientId,grantId:actor.grantId,
      operation:operation as Prisma.InputJsonValue,fingerprint,status:'proposed',revision:1,expiresAt:new Date(now.getTime()+5*60_000)}})
    await audit(tx,actor,row.id,requestId,'proposed','succeeded')
    return row.id
  })
  const row=await prisma.assistantActionRequest.findFirst({where:{id,userId:actor.userId,deviceId,clientId:actor.clientId,grantId:actor.grantId}})
  if(!row)throw new CompanionError(503,'authorization_unavailable')
  return actionView(row)
}

export async function listPendingAssistantActions(actor:CompanionOAuthPrincipal,deviceId:string){
  requireTaskWrite(actor)
  await requireActiveCompanionDevice(actor,deviceId)
  const rows=await prisma.assistantActionRequest.findMany({where:{userId:actor.userId,deviceId,clientId:actor.clientId,grantId:actor.grantId,status:'proposed',expiresAt:{gt:new Date()}},orderBy:{createdAt:'asc'},take:20})
  return rows.map(actionView)
}

export async function getAssistantAction(actor:CompanionOAuthPrincipal,deviceId:string,id:string){
  requireTaskWrite(actor)
  await requireActiveCompanionDevice(actor,deviceId)
  const row=await prisma.assistantActionRequest.findFirst({where:{id,userId:actor.userId,deviceId,clientId:actor.clientId,grantId:actor.grantId}})
  if(!row)throw new CompanionError(404,'action_not_found')
  return actionView(row)
}

export async function decideAssistantAction(actor:CompanionOAuthPrincipal,deviceId:string,id:string,raw:unknown,now=new Date()){
  requireTaskWrite(actor)
  await requireActiveCompanionDevice(actor,deviceId)
  const parsed=decisionSchema.safeParse(raw)
  if(!parsed.success||id.length>32||!id.length||!/^c[a-z0-9]+$/i.test(id))throw new CompanionError(400,'invalid_request')
  const operationResult=await prisma.$transaction(async tx=>{
    await lockDevice(tx,actor.userId,deviceId)
    const device=await tx.companionDevice.findFirst({where:{userId:actor.userId,deviceId,clientId:actor.clientId,grantId:actor.grantId,revokedAt:null},select:{id:true}})
    if(!device)throw new CompanionError(403,'device_revoked')
    const row=await tx.assistantActionRequest.findFirst({where:{id,userId:actor.userId,deviceId,clientId:actor.clientId,grantId:actor.grantId}})
    if(!row)throw new CompanionError(404,'action_not_found')
    if(row.status==='succeeded'||row.status==='rejected'||row.status==='expired')return {row,created:false}
    if(row.status!=='proposed'||row.revision!==parsed.data.revision)throw new CompanionError(409,'revision_conflict')
    if(row.expiresAt<=now){
      const updated=await tx.assistantActionRequest.updateMany({where:{id,userId:actor.userId,status:'proposed',revision:row.revision},data:{status:'expired',revision:{increment:1},completedAt:now}})
      if(!updated.count)throw new CompanionError(409,'revision_conflict')
      await audit(tx,actor,row.id,row.requestId,'expired','rejected')
      return {row:{...row,status:'expired',revision:row.revision+1,completedAt:now},created:false}
    }
    if(parsed.data.decision==='deny'){
      const updated=await tx.assistantActionRequest.updateMany({where:{id,userId:actor.userId,status:'proposed',revision:row.revision,expiresAt:{gt:now}},data:{status:'rejected',revision:{increment:1},completedAt:now}})
      if(!updated.count)throw new CompanionError(409,'revision_conflict')
      await audit(tx,actor,row.id,row.requestId,'denied','rejected')
      return {row:{...row,status:'rejected',revision:row.revision+1,completedAt:now},created:false}
    }
    const operation=taskCreateSchema.safeParse(row.operation)
    if(!operation.success||digest(operation.data)!==row.fingerprint)throw new CompanionError(409,'request_conflict')
    const claimed=await tx.assistantActionRequest.updateMany({where:{id,userId:actor.userId,deviceId,status:'proposed',revision:row.revision,expiresAt:{gt:now}},data:{approvedAt:now,revision:{increment:1}}})
    if(!claimed.count)throw new CompanionError(409,'revision_conflict')
    const idempotencyKey=`assistant:${row.requestId}`
    await tx.mutationRequest.create({data:{userId:actor.userId,scope:'task_create',idempotencyKey,fingerprint:row.fingerprint,resourceType:'task',resourceId:'pending'}})
    const task=await tx.task.create({data:{userId:actor.userId,title:operation.data.title,status:'todo',priority:operation.data.priority,tags:'[]'}})
    await tx.mutationRequest.update({where:{userId_scope_idempotencyKey:{userId:actor.userId,scope:'task_create',idempotencyKey}},data:{resourceId:task.id}})
    const result={kind:'task.created',resourceId:task.id,title:task.title,priority:task.priority}
    const updated=await tx.assistantActionRequest.updateMany({where:{id,userId:actor.userId,deviceId,status:'proposed',revision:row.revision+1},data:{status:'succeeded',completedAt:now,result:result as Prisma.InputJsonValue,revision:{increment:1}}})
    if(!updated.count)throw new CompanionError(409,'revision_conflict')
    await audit(tx,actor,row.id,row.requestId,'confirmed','succeeded')
    return {row:{...row,status:'succeeded',revision:row.revision+2,approvedAt:now,completedAt:now,result},created:true}
  })
  if(operationResult.created)emitTwinSignal({userId:actor.userId,signal:'task_created'})
  const current=await prisma.assistantActionRequest.findFirst({where:{id,userId:actor.userId,deviceId,clientId:actor.clientId,grantId:actor.grantId}})
  return actionView(current??operationResult.row)
}

export const assistantTaskOperationSchema=taskCreateSchema
