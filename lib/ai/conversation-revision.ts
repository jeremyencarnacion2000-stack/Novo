import {createHash} from 'node:crypto'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import {CompanionError} from '@/lib/companion/auth'
import type {Message} from '@/components/ai/modern-chatbot/types'
export {mergeConversationMessages} from './conversation-messages'

// Existing message extensions (blocks, attachments, provenance and feedback)
// remain compatible. Every writable message has a stable ID and bounded core.
export const conversationMessagesSchema=z.array(z.object({
  id:z.string().min(1).max(200),role:z.enum(['user','assistant']),
  content:z.string().max(500_000),timestamp:z.string().datetime(),
}).passthrough()).max(2000).refine(messages=>new Set(messages.map(m=>m.id)).size===messages.length,'duplicate_message_ids')

export function canonicalConversationMessages(id:string,value:unknown,createdAt:string):Message[] {
  if(!Array.isArray(value))return []
  return value.filter(m=>m && (m.role==='user'||m.role==='assistant') && typeof m.content==='string').map((m,index)=>({
    ...m,id:typeof m.id==='string' && m.id ? m.id : `legacy-${createHash('sha256').update(`${id}:${index}:${m.role}:${m.content}`).digest('hex').slice(0,32)}`,
    timestamp:typeof m.timestamp==='string' && Number.isFinite(Date.parse(m.timestamp)) ? new Date(m.timestamp).toISOString() : createdAt,
  }))
}

export async function saveConversationRevision(userId:string,id:string,expectedRevision:number,messages:Message[],title?:string):Promise<{revision:number}> {
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new CompanionError(409,'revision_conflict')
  const parsed=conversationMessagesSchema.safeParse(messages)
  if(!parsed.success)throw new CompanionError(400,'invalid_messages')
  const result=await prisma.aIConversation.updateMany({where:{id,userId,revision:expectedRevision},data:{
    messages:JSON.parse(JSON.stringify(parsed.data)),revision:{increment:1},...(title!==undefined?{title}:{}),
  }})
  if(!result.count){
    const owned=await prisma.aIConversation.findFirst({where:{id,userId},select:{id:true}})
    throw new CompanionError(owned?409:404,owned?'revision_conflict':'conversation_not_found')
  }
  return {revision:expectedRevision+1}
}
