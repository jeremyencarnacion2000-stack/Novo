import type {Prisma} from '@prisma/client'
import {prisma} from '@/lib/prisma'

export type UserChatLease = {userId:string;requestId:string;expiresAt:Date}

/** Short transaction lock shared by every surface; never held over network I/O. */
export async function lockUserChat(tx:Prisma.TransactionClient,userId:string):Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`novo-chat:${userId}`}, 0))`
}
export async function claimUserChatLease(tx:Prisma.TransactionClient,userId:string,requestId:string,now:Date):Promise<UserChatLease|null> {
  await lockUserChat(tx,userId)
  const existing=await tx.userChatLease.findUnique({where:{userId}})
  if(existing && existing.expiresAt>now)return null
  const lease={userId,requestId,expiresAt:new Date(now.getTime()+180_000)}
  await tx.userChatLease.upsert({where:{userId},create:lease,update:{requestId,expiresAt:lease.expiresAt}})
  return lease
}
export async function acquireUserChatLease(userId:string,requestId:string):Promise<UserChatLease|null> {
  return prisma.$transaction(tx=>claimUserChatLease(tx,userId,requestId,new Date()))
}
export async function releaseUserChatLease(userId:string,requestId:string):Promise<void> {
  await prisma.userChatLease.deleteMany({where:{userId,requestId}})
}
