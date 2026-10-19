/** @jest-environment node */
jest.mock('@/lib/companion/auth',()=>({...jest.requireActual('@/lib/companion/auth'),requireCompanionOAuth:jest.fn()}))
jest.mock('@/lib/companion/devices',()=>({requireActiveCompanionDevice:jest.fn()}))
jest.mock('@/lib/google',()=>({gmailService:{checkAccessForUser:jest.fn()}}))
jest.mock('@/lib/google-account',()=>({findGoogleAccountForScopes:jest.fn()}))
import {requireCompanionOAuth,CompanionError} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'
import {gmailService} from '@/lib/google'
import {findGoogleAccountForScopes} from '@/lib/google-account'
import {GET} from './route'
const request=()=>new Request('https://novo.test/api/companion/gmail/status',{headers:{'X-Novo-Device-Id':'device'}})
beforeEach(()=>{jest.clearAllMocks();(requireCompanionOAuth as jest.Mock).mockResolvedValue({userId:'owner'});(requireActiveCompanionDevice as jest.Mock).mockResolvedValue({});(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({id:'grant'});(gmailService.checkAccessForUser as jest.Mock).mockResolvedValue(undefined)})
it('checks the connected owner grant with no mailbox contents in the response',async()=>{
  const response=await GET(request())
  expect(await response.json()).toEqual({status:'available'})
  expect(requireCompanionOAuth).toHaveBeenCalledWith(expect.any(Request),['device:connect','integrations:read'])
  expect(gmailService.checkAccessForUser).toHaveBeenCalledWith('owner')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
})
it('rejects revoked devices before looking at Gmail',async()=>{
  ;(requireActiveCompanionDevice as jest.Mock).mockRejectedValue(new CompanionError(403,'device_revoked'))
  expect((await GET(request())).status).toBe(403)
  expect(findGoogleAccountForScopes).not.toHaveBeenCalled()
  expect(gmailService.checkAccessForUser).not.toHaveBeenCalled()
})
it.each([[{response:{status:400,data:{error:'invalid_grant'}}},'reauthorization_required'],[{code:403,errors:[{reason:'insufficientPermissions'}]},'reauthorization_required'],[new Error('private diagnostic'),'unavailable']])('reports actual read health without raw provider errors',async(error,status)=>{
  ;(gmailService.checkAccessForUser as jest.Mock).mockRejectedValue(error)
  expect(await (await GET(request())).json()).toEqual({status})
})
it('reports an absent read grant without consulting the provider',async()=>{
  ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue(null)
  expect(await (await GET(request())).json()).toEqual({status:'not_connected'})
  expect(gmailService.checkAccessForUser).not.toHaveBeenCalled()
})
