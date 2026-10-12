/** @jest-environment node */
jest.mock('@/lib/companion/auth',()=>({...jest.requireActual('@/lib/companion/auth'),requireCompanionOAuth:jest.fn()}))
jest.mock('@/lib/companion/devices',()=>({requireActiveCompanionDevice:jest.fn()}))
jest.mock('@/lib/companion/chat-turns',()=>({cancelCompanionTurn:jest.fn()}))
jest.mock('@/lib/prisma',()=>({prisma:{companionChatTurn:{findUnique:jest.fn()}}}))
import {POST} from './route'
import {prisma} from '@/lib/prisma'
import {requireCompanionOAuth} from '@/lib/companion/auth'
import {cancelCompanionTurn} from '@/lib/companion/chat-turns'
const requestId='d43b02f8-b59f-44ba-8a54-66366371293d',deviceId='42d1c6e8-c24a-42b4-80ab-20fb318496c9'
const request=()=>new Request('https://novo.test',{method:'POST',headers:{'X-Novo-Device-Id':deviceId}})
beforeEach(()=>{jest.clearAllMocks();(requireCompanionOAuth as jest.Mock).mockResolvedValue({userId:'owner',grantId:'grant'});(prisma.companionChatTurn.findUnique as jest.Mock).mockResolvedValue({grantId:'grant',device:{deviceId}})})
it('cancels only the owned, bound request and rejects invalid IDs before lookup',async()=>{
  expect((await POST(request(),{params:Promise.resolve({requestId})})).status).toBe(200)
  expect(cancelCompanionTurn).toHaveBeenCalledWith('owner',requestId)
  expect((await POST(request(),{params:Promise.resolve({requestId:'invalid'})})).status).toBe(400)
  expect(prisma.companionChatTurn.findUnique).toHaveBeenCalledTimes(1)
})
it('UUID knowledge cannot cancel a foreign user/device/grant',async()=>{
  ;(prisma.companionChatTurn.findUnique as jest.Mock).mockResolvedValue({grantId:'other',device:{deviceId}})
  expect((await POST(request(),{params:Promise.resolve({requestId})})).status).toBe(404)
  expect(cancelCompanionTurn).not.toHaveBeenCalled()
})
