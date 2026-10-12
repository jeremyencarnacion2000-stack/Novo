/** @jest-environment node */
jest.mock('@/lib/companion/auth',()=>({...jest.requireActual('@/lib/companion/auth'),requireCompanionOAuth:jest.fn()}))
jest.mock('@/lib/companion/devices',()=>({requireActiveCompanionDevice:jest.fn()}))
jest.mock('@/lib/ai/chat-catalog',()=>({getNovoChatModels:jest.fn()}))
import {requireCompanionOAuth,CompanionError} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'
import {getNovoChatModels} from '@/lib/ai/chat-catalog'
import {GET} from './route'
beforeEach(()=>{jest.clearAllMocks();process.env.NOVO_COMPANION_CHAT_ENABLED='true';(requireCompanionOAuth as jest.Mock).mockResolvedValue({userId:'owner'});(requireActiveCompanionDevice as jest.Mock).mockResolvedValue({});(getNovoChatModels as jest.Mock).mockResolvedValue([{id:'auto',label:'Automático · Novo',allowsTwinMode:false}])})
afterEach(()=>delete process.env.NOVO_COMPANION_CHAT_ENABLED)
it('returns only the authenticated account catalog after OAuth and device verification',async()=>{
  const request=new Request('http://localhost/api/companion/models',{headers:{'X-Novo-Device-Id':'cd78b30e-93ca-4bd0-893a-a3f709b2f105'}})
  const result=await GET(request)
  expect(result.status).toBe(200)
  expect(requireCompanionOAuth).toHaveBeenCalledWith(request,['device:connect','ai:chat'])
  expect(getNovoChatModels).toHaveBeenCalledWith('owner')
  expect(result.headers.get('Cache-Control')).toBe('no-store')
})
it('never enumerates account models for a revoked device',async()=>{
  ;(requireActiveCompanionDevice as jest.Mock).mockRejectedValue(new CompanionError(403,'device_revoked'))
  expect((await GET(new Request('http://localhost'))).status).toBe(403)
  expect(getNovoChatModels).not.toHaveBeenCalled()
})
it('fails closed when the account chat feature is disabled',async()=>{
  delete process.env.NOVO_COMPANION_CHAT_ENABLED
  const request=new Request('http://localhost/api/companion/models',{headers:{'X-Novo-Device-Id':'cd78b30e-93ca-4bd0-893a-a3f709b2f105'}})
  const response=await GET(request)
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({error:'chat_disabled'})
  expect(requireActiveCompanionDevice).not.toHaveBeenCalled()
  expect(getNovoChatModels).not.toHaveBeenCalled()
})
