import {createHash,randomUUID} from 'node:crypto'
import type {Prisma} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import {CompanionError,type CompanionOAuthPrincipal} from './auth'
import {companionChatRequestSchema,type CompanionChatRequest,type CompanionChatEvent} from './contracts'
import {lockUserChat,claimUserChatLease,type UserChatLease} from '@/lib/ai/chat-lease'
import {canonicalConversationMessages} from '@/lib/ai/conversation-revision'

export type TurnClaim =
 | {kind:'claimed';requestId:string;conversationId:string;revision:number;userMessageId:string;lease:UserChatLease}
 | {kind:'replay';events:CompanionChatEvent[]}
 | {kind:'pending';requestId:string}
 | {kind:'conflict';code:'revision_conflict'|'request_conflict'|'turn_active'}
const turnKey=(userId:string,requestId:string)=>({userId_requestId:{userId,requestId}})
const failure=(requestId:string,code:Extract<CompanionChatEvent,{type:'error'}>['code']):TurnClaim=>({kind:'replay',events:[{type:'error',requestId,code}]})

async function ownedBinding(tx:Prisma.TransactionClient,actor:CompanionOAuthPrincipal,deviceId:string){
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`novo:device:${actor.userId}:${deviceId}`}, 0))`
  const device=await tx.companionDevice.findUnique({where:{userId_deviceId:{userId:actor.userId,deviceId}}})
  if(!device)throw new CompanionError(404,'device_not_found')
  if(device.revokedAt || device.clientId!==actor.clientId || device.grantId!==actor.grantId)throw new CompanionError(403,'device_revoked')
  return device
}
export async function claimCompanionTurn(actor:CompanionOAuthPrincipal,deviceId:string,raw:CompanionChatRequest,database=prisma):Promise<TurnClaim> {
  const parsed=companionChatRequestSchema.safeParse(raw)
  if(!parsed.success)throw new CompanionError(400,'invalid_request')
  const input=parsed.data,now=new Date()
  const contextPayload=input.projectHints===undefined&&input.localConnections===undefined?input.localContext??'':JSON.stringify([input.localContext??'',input.projectHints??[],input.localConnections??{}])
  const localContextFingerprint=createHash('sha256').update(contextPayload).digest('hex')
  const fingerprint=createHash('sha256').update(JSON.stringify([input.conversationId,input.conversationRevision,input.message,input.model,input.twinMode,localContextFingerprint])).digest('hex')
  return database.$transaction(async tx=>{
    await lockUserChat(tx,actor.userId)
    const device=await ownedBinding(tx,actor,deviceId)
    const previous=await tx.companionChatTurn.findUnique({where:turnKey(actor.userId,input.requestId)})
    if(previous){
      if(previous.expiresAt<=now)return failure(input.requestId,'request_expired')
      if(previous.fingerprint!==fingerprint)return {kind:'conflict',code:'request_conflict'}
      if(previous.deviceId!==device.id || previous.grantId!==actor.grantId)throw new CompanionError(403,'device_revoked')
      if(previous.status==='running'){
        if(previous.leaseExpiresAt>now)return {kind:'pending',requestId:input.requestId}
        await tx.companionChatTurn.updateMany({where:{userId:actor.userId,requestId:input.requestId,status:'running'},data:{status:'interrupted',errorCode:'stream_interrupted',finishedAt:now}})
        await tx.userChatLease.deleteMany({where:{userId:actor.userId,requestId:input.requestId}})
        return failure(input.requestId,'stream_interrupted')
      }
      if(previous.status!=='completed')return failure(input.requestId,previous.status==='cancelled'?'cancelled':'stream_interrupted')
      if(!previous.conversationId)return failure(input.requestId,'request_expired')
      const conversation=await tx.aIConversation.findFirst({where:{id:previous.conversationId,userId:actor.userId}})
      if(!conversation)return failure(input.requestId,'request_expired')
      const assistant=canonicalConversationMessages(conversation.id,conversation.messages,conversation.createdAt.toISOString()).find(m=>m.id===previous.assistantMessageId)
      if(!assistant || !previous.assistantMessageId || previous.resultRevision===null || !previous.modelId)return failure(input.requestId,'request_expired')
      return {kind:'replay',events:[
        {type:'metadata',requestId:input.requestId,conversationId:conversation.id,revision:previous.initialRevision,userMessageId:previous.userMessageId},
        {type:'delta',requestId:input.requestId,text:assistant.content},
        {type:'complete',requestId:input.requestId,assistantMessageId:previous.assistantMessageId,revision:previous.resultRevision,modelId:previous.modelId},
      ]}
    }
    let conversation=input.conversationId ? await tx.aIConversation.findFirst({where:{id:input.conversationId,userId:actor.userId}}) : null
    if(input.conversationId && !conversation)throw new CompanionError(404,'conversation_not_found')
    if(conversation && conversation.revision!==input.conversationRevision)return {kind:'conflict',code:'revision_conflict'}
    const lease=await claimUserChatLease(tx,actor.userId,input.requestId,now)
    if(!lease)return {kind:'conflict',code:'turn_active'}
    // Expired turns remain tombstones; never resume their uncertain provider.
    await tx.companionChatTurn.updateMany({where:{userId:actor.userId,status:'running',leaseExpiresAt:{lte:now}},data:{status:'interrupted',errorCode:'stream_interrupted',finishedAt:now}})
    if(!conversation)conversation=await tx.aIConversation.create({data:{id:randomUUID(),userId:actor.userId,title:input.message.slice(0,80),messages:[]}})
    const userMessageId=randomUUID(),revision=conversation.revision+1
    const messages=canonicalConversationMessages(conversation.id,conversation.messages,conversation.createdAt.toISOString())
    const saved=await tx.aIConversation.updateMany({where:{id:conversation.id,userId:actor.userId,revision:conversation.revision},data:{messages:[...messages,{id:userMessageId,role:'user',content:input.message,timestamp:now.toISOString()}] as unknown as Prisma.InputJsonValue,revision:{increment:1}}})
    if(!saved.count)throw new CompanionError(409,'revision_conflict') // rollback lease/new conversation
    await tx.companionChatTurn.create({data:{userId:actor.userId,requestId:input.requestId,conversationId:conversation.id,deviceId:device.id,clientId:actor.clientId,grantId:actor.grantId,
      fingerprint,status:'running',leaseExpiresAt:lease.expiresAt,expiresAt:new Date(now.getTime()+30*86400_000),userMessageId,initialRevision:revision}})
    return {kind:'claimed',requestId:input.requestId,conversationId:conversation.id,revision,userMessageId,lease}
  })
}

export async function isCompanionTurnCancelled(userId:string,requestId:string):Promise<boolean> {
  const turn=await prisma.companionChatTurn.findUnique({where:turnKey(userId,requestId),select:{status:true,leaseExpiresAt:true}})
  return !turn || turn.status!=='running' || turn.leaseExpiresAt<=new Date()
}
export async function failCompanionTurn(userId:string,requestId:string,code='stream_interrupted'):Promise<void> {
  await prisma.$transaction(async tx=>{
    await lockUserChat(tx,userId)
    await tx.companionChatTurn.updateMany({where:{userId,requestId,status:'running'},data:{status:'interrupted',errorCode:code,finishedAt:new Date()}})
    await tx.userChatLease.deleteMany({where:{userId,requestId}})
  })
}
export async function cancelCompanionTurn(userId:string,requestId:string):Promise<void> {
  await prisma.$transaction(async tx=>{
    await lockUserChat(tx,userId)
    await tx.companionChatTurn.updateMany({where:{userId,requestId,status:'running'},data:{status:'cancelled',errorCode:'cancelled',finishedAt:new Date()}})
    // Keep exclusion until the stream observes cancellation and aborts its
    // provider (or the bounded lease expires). No second live provider starts.
  })
}

export async function finishCompanionTurn(userId:string,requestId:string,output:{text:string;modelId:string}):Promise<CompanionChatEvent> {
  if(!output.text || output.text.length>500_000 || !output.modelId || output.modelId.length>120)throw new CompanionError(503,'stream_interrupted')
  return prisma.$transaction(async tx=>{
    await lockUserChat(tx,userId)
    const turn=await tx.companionChatTurn.findUnique({where:turnKey(userId,requestId)})
    if(!turn)throw new CompanionError(404,'turn_not_found')
    if(turn.status!=='running')throw new CompanionError(409,turn.status==='cancelled'?'cancelled':'stream_interrupted')
    if(turn.leaseExpiresAt<=new Date())throw new CompanionError(409,'stream_interrupted')
    let device=await tx.companionDevice.findUnique({where:{id:turn.deviceId}})
    if(device){
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`novo:device:${userId}:${device.deviceId}`}, 0))`
      device=await tx.companionDevice.findUnique({where:{id:turn.deviceId}})
    }
    if(!device || device.revokedAt || device.userId!==userId || device.grantId!==turn.grantId || device.clientId!==turn.clientId)throw new CompanionError(403,'device_revoked')
    const now=new Date()
    if(turn.grantId.startsWith('pat:')){
      const tokenId=turn.grantId.slice('pat:'.length)
      const token=tokenId ? await tx.mcpPersonalAccessToken.findFirst({where:{id:tokenId,userId,revokedAt:null,expiresAt:{gt:now},scopes:{hasEvery:['device:connect','ai:chat']}},select:{id:true}}) : null
      if(!token)throw new CompanionError(401,'unauthorized')
    }else{
      const grant=await tx.oAuthModel.findFirst({where:{type:'Grant',modelId:turn.grantId,accountId:userId,OR:[{expiresAt:null},{expiresAt:{gt:now}}]}})
      // clientId lives inside the adapter payload, not a fabricated SQL column.
      if(!grant || (grant.payload as Record<string,unknown>)?.clientId!==turn.clientId)throw new CompanionError(401,'unauthorized')
    }
    const conversation=turn.conversationId ? await tx.aIConversation.findFirst({where:{id:turn.conversationId,userId}}) : null
    if(!conversation)throw new CompanionError(404,'conversation_not_found')
    const messages=canonicalConversationMessages(conversation.id,conversation.messages,conversation.createdAt.toISOString())
    const assistantMessageId=randomUUID(),revision=conversation.revision+1
    const result=await tx.aIConversation.updateMany({where:{id:conversation.id,userId,revision:conversation.revision},data:{messages:[...messages,{id:assistantMessageId,role:'assistant',content:output.text,model:output.modelId,timestamp:new Date().toISOString()}] as unknown as Prisma.InputJsonValue,revision:{increment:1}}})
    if(!result.count)throw new CompanionError(409,'revision_conflict')
    await tx.companionChatTurn.updateMany({where:{userId,requestId,status:'running'},data:{status:'completed',assistantMessageId,resultRevision:revision,modelId:output.modelId,finishedAt:new Date()}})
    await tx.userChatLease.deleteMany({where:{userId,requestId}})
    return {type:'complete',requestId,assistantMessageId,revision,modelId:output.modelId}
  })
}
