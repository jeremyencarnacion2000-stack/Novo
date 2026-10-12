import {prisma} from '@/lib/prisma'
import {canonicalConversationMessages} from '@/lib/ai/conversation-revision'
import {CompanionError} from './auth'
export async function listCompanionConversations(userId:string){
  return prisma.aIConversation.findMany({where:{userId},select:{id:true,title:true,updatedAt:true,revision:true},orderBy:{updatedAt:'desc'},take:200})
}
export async function getCompanionConversation(userId:string,id:string){
  if(!id||id.length>200)throw new CompanionError(400,'invalid_request')
  const row=await prisma.aIConversation.findFirst({where:{id,userId}})
  if(!row)throw new CompanionError(404,'conversation_not_found')
  return {id:row.id,title:row.title,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),revision:row.revision,
    messages:canonicalConversationMessages(row.id,row.messages,row.createdAt.toISOString())}
}
