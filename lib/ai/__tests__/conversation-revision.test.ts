/** @jest-environment node */
jest.mock('@/lib/prisma',()=>({prisma:{aIConversation:{updateMany:jest.fn(),findFirst:jest.fn()}}}))
import {mergeConversationMessages, canonicalConversationMessages, saveConversationRevision} from '../conversation-revision'
import {prisma} from '@/lib/prisma'
const message=(id:string,content=id)=>({id,role:'user' as const,content,timestamp:'2026-10-09T18:00:00Z'})
beforeEach(()=>jest.clearAllMocks())
it('merges by stable IDs retaining server-owned content on stale collisions',()=>{
  expect(mergeConversationMessages([message('web','current'),message('native')],[message('web','stale'),message('local')]))
    .toEqual([message('web','current'),message('native'),message('local')])
})
it('legacy IDs are deterministic per conversation, never freshly random on each read',()=>{
  const old=[{role:'assistant',content:'synthetic'}]
  const first=canonicalConversationMessages('conv',old,'2026-10-09T18:00:00Z')
  expect(first).toEqual(canonicalConversationMessages('conv',old,'2026-10-09T18:00:00Z'))
  expect(first[0].id).not.toBe(canonicalConversationMessages('other',old,'2026-10-09T18:00:00Z')[0].id)
})
it('stale/missing revision cannot mutate another account or erase new messages',async()=>{
  ;(prisma.aIConversation.updateMany as jest.Mock).mockResolvedValue({count:0})
  ;(prisma.aIConversation.findFirst as jest.Mock).mockResolvedValue({revision:2})
  await expect(saveConversationRevision('owner','conv',0,[message('old')])).rejects.toMatchObject({status:409,code:'revision_conflict'})
  expect(prisma.aIConversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{id:'conv',userId:'owner',revision:0}}))
  await expect(saveConversationRevision('owner','conv',undefined as any,[])).rejects.toMatchObject({status:409})
  expect(prisma.aIConversation.updateMany).toHaveBeenCalledTimes(1)
})
it('successful compare-and-swap increments once',async()=>{
  ;(prisma.aIConversation.updateMany as jest.Mock).mockResolvedValue({count:1})
  expect(await saveConversationRevision('owner','conv',3,[message('web')],'Title')).toEqual({revision:4})
})
