/** @jest-environment node */
jest.mock('@/lib/companion/auth',()=>({...jest.requireActual('@/lib/companion/auth'),requireCompanionOAuth:jest.fn()}))
jest.mock('@/lib/companion/devices',()=>({requireActiveCompanionDevice:jest.fn()}))
jest.mock('@/lib/prisma',()=>({prisma:{aIConversation:{findMany:jest.fn(),findFirst:jest.fn()}}}))
import {GET} from './route'
import {GET as getOne} from './[id]/route'
import {prisma} from '@/lib/prisma'
import {requireCompanionOAuth,CompanionError} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'
beforeEach(()=>{jest.clearAllMocks();process.env.NOVO_COMPANION_CHAT_ENABLED='true';(requireCompanionOAuth as jest.Mock).mockResolvedValue({userId:'owner'});(requireActiveCompanionDevice as jest.Mock).mockResolvedValue({});(prisma.aIConversation.findMany as jest.Mock).mockResolvedValue([])})
afterEach(()=>delete process.env.NOVO_COMPANION_CHAT_ENABLED)
it('list selects only owned summary fields and never reads foreign context',async()=>{
  const response=await GET(new Request('https://novo.test'))
  expect(response.status).toBe(200);expect(await response.json()).toEqual({conversations:[]})
  expect(prisma.aIConversation.findMany).toHaveBeenCalledWith({where:{userId:'owner'},select:{id:true,title:true,updatedAt:true,revision:true},orderBy:{updatedAt:'desc'},take:200})
})
it('unknown/other-owner conversation is 404, revoked device cannot list/get',async()=>{
  ;(prisma.aIConversation.findFirst as jest.Mock).mockResolvedValue(null)
  expect((await getOne(new Request('https://novo.test'),{params:Promise.resolve({id:'other'})})).status).toBe(404)
  expect(prisma.aIConversation.findFirst).toHaveBeenCalledWith({where:{id:'other',userId:'owner'}})
  ;(requireActiveCompanionDevice as jest.Mock).mockRejectedValue(new CompanionError(403,'device_revoked'))
  expect((await GET(new Request('https://novo.test'))).status).toBe(403)
  expect(prisma.aIConversation.findMany).not.toHaveBeenCalled()
})
it('get preserves canonical message IDs without server-only OAuth bindings',async()=>{
  ;(prisma.aIConversation.findFirst as jest.Mock).mockResolvedValue({id:'conv',userId:'owner',title:'Fixture',revision:3,createdAt:new Date('2026-10-09T18:00:00Z'),updatedAt:new Date('2026-10-09T18:00:00Z'),messages:[{id:'message',role:'assistant',content:'synthetic',timestamp:'2026-10-09T18:00:00Z',sources:[]}]})
  const response=await getOne(new Request('https://novo.test'),{params:Promise.resolve({id:'conv'})})
  expect(await response.json()).toMatchObject({revision:3,messages:[{id:'message',sources:[]}]})
})
