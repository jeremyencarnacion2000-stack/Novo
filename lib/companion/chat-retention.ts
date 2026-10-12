import {prisma} from '@/lib/prisma'

export async function retainCompanionChatTurns(){
  const now=new Date()
  // Keep just the owned request tombstone after 30 days, not OAuth bindings,
  // result references or fingerprints. Existing account history is independent.
  const turns=await prisma.companionChatTurn.updateMany({where:{expiresAt:{lt:now},status:{not:'expired'}},data:{
    status:'expired',conversationId:null,grantId:'',clientId:'',fingerprint:'',assistantMessageId:null,modelId:null,resultRevision:null,errorCode:'request_expired',
  }})
  const leases=await prisma.userChatLease.deleteMany({where:{expiresAt:{lt:now}}})
  return {turnsExpired:turns.count,leasesExpired:leases.count}
}
