/** @jest-environment node */
jest.mock('@/lib/prisma',()=>({prisma:{$transaction:jest.fn(),userChatLease:{deleteMany:jest.fn()}}}))
import {claimUserChatLease, releaseUserChatLease} from '../chat-lease'
import {prisma} from '@/lib/prisma'
const now = new Date('2026-10-09T18:00:00Z')
const tx:any = {$executeRaw:jest.fn(),userChatLease:{findUnique:jest.fn(),upsert:jest.fn()}}
beforeEach(()=>{jest.clearAllMocks();tx.userChatLease.findUnique.mockResolvedValue(null);tx.userChatLease.upsert.mockImplementation(({create}:any)=>create)})
it('locks the user and returns a 180 second persistent lease',async()=>{
  expect(await claimUserChatLease(tx,'owner','request',now)).toEqual({userId:'owner',requestId:'request',expiresAt:new Date(now.getTime()+180_000)})
  expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
  expect(tx.userChatLease.findUnique).toHaveBeenCalledWith({where:{userId:'owner'}})
})
it('the same request ID is not permission to start another provider',async()=>{
  tx.userChatLease.findUnique.mockResolvedValue({userId:'owner',requestId:'request',expiresAt:new Date(now.getTime()+1)})
  expect(await claimUserChatLease(tx,'owner','request',now)).toBeNull()
  expect(tx.userChatLease.upsert).not.toHaveBeenCalled()
})
it('expired leases can be replaced but release cannot delete their successor',async()=>{
  tx.userChatLease.findUnique.mockResolvedValue({expiresAt:now})
  expect(await claimUserChatLease(tx,'owner','next',now)).not.toBeNull()
  await releaseUserChatLease('owner','previous')
  expect(prisma.userChatLease.deleteMany).toHaveBeenCalledWith({where:{userId:'owner',requestId:'previous'}})
})
