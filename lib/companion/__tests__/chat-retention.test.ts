/** @jest-environment node */
jest.mock('@/lib/prisma',()=>({prisma:{companionChatTurn:{updateMany:jest.fn().mockResolvedValue({count:1})},userChatLease:{deleteMany:jest.fn().mockResolvedValue({count:1})}}}))
import {retainCompanionChatTurns} from '../chat-retention'
import {prisma} from '@/lib/prisma'
it('expires operational metadata at 30 days without deleting retry tombstones or chat messages',async()=>{
  await retainCompanionChatTurns()
  expect(prisma.companionChatTurn.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({expiresAt:{lt:expect.any(Date)}}),data:expect.objectContaining({status:'expired',conversationId:null,grantId:'',clientId:'',assistantMessageId:null,modelId:null})}))
  expect(prisma.userChatLease.deleteMany).toHaveBeenCalledWith({where:{expiresAt:{lt:expect.any(Date)}}})
})
