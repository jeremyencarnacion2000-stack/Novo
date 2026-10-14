/** @jest-environment node */
jest.mock('@/lib/companion/auth',()=>({requireCompanionOAuth:jest.fn(),CompanionError:class extends Error{constructor(public status:number,public code:string){super(code)}}}))
jest.mock('@/lib/companion/devices',()=>({requireActiveCompanionDevice:jest.fn()}))
jest.mock('../memory',()=>({recordProjectObservations:jest.fn(async()=>({changed:1,conflicts:0}))}))
import {requireCompanionOAuth} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'
import {recordProjectObservations} from '../memory'
import {POST} from '@/app/api/companion/project-observations/route'
const device='bcf7c70d-6d39-4bb9-86d2-9e75509c1b69'
const local={kind:'folder',sourceKey:device,title:'Novo',observedAt:new Date().toISOString(),facts:{workspaceId:device,dirtyFiles:1}}
const request=(observation=local)=>new Request('https://novo.test/api/companion/project-observations',{method:'POST',headers:{'X-Novo-Device-Id':device},body:JSON.stringify({observations:[observation]})})
beforeEach(()=>{jest.clearAllMocks();(requireCompanionOAuth as jest.Mock).mockResolvedValue({userId:'owner',clientId:'client',grantId:'grant',scopes:new Set(['device:work-context:write'])});(requireActiveCompanionDevice as jest.Mock).mockResolvedValue({id:device})})
test('uses a bound device and required work-context scope; does not accept paths',async()=>{
  expect((await POST(request())).status).toBe(200)
  expect(requireCompanionOAuth).toHaveBeenCalledWith(expect.anything(),['device:connect','device:work-context:write'])
  expect(recordProjectObservations).toHaveBeenCalledWith('owner',[local],expect.objectContaining({deviceId:device,guard:expect.any(Function)}))
  expect((await POST(request({...local,facts:{...local.facts,path:'C:/private'}} as any))).status).toBe(400)
})
test('foreign or revoked device never ingests observations',async()=>{
  const {CompanionError}=await import('@/lib/companion/auth')
  ;(requireActiveCompanionDevice as jest.Mock).mockRejectedValue(new CompanionError(403,'device_revoked'))
  expect((await POST(request())).status).toBe(403)
  expect(recordProjectObservations).not.toHaveBeenCalled()
})
