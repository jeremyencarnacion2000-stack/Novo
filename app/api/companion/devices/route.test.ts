/** @jest-environment node */
import {getServerSession} from 'next-auth'
import {requireCompanionOAuth} from '@/lib/companion/auth'
import {registerCompanionDevice, listCompanionDevices} from '@/lib/companion/devices'
import {GET, POST} from './route'
jest.mock('next-auth', () => ({getServerSession:jest.fn()}))
jest.mock('@/lib/auth', () => ({authOptions:{}}))
jest.mock('@/lib/companion/auth', () => ({...jest.requireActual('@/lib/companion/auth'), requireCompanionOAuth:jest.fn()}))
jest.mock('@/lib/companion/devices', () => ({...jest.requireActual('@/lib/companion/devices'), registerCompanionDevice:jest.fn(), listCompanionDevices:jest.fn()}))
const actor = {userId:'owner', clientId:'client', grantId:'grant', scopes:new Set(['device:connect']), expiresAt:Date.now()/1000 +3600}
const input = {deviceId:'cd78b30e-93ca-4bd0-893a-a3f709b2f105', name:'Novo PC', platform:'windows', reconnect:false}
beforeEach(() => {jest.clearAllMocks(); (requireCompanionOAuth as jest.Mock).mockResolvedValue(actor); (registerCompanionDevice as jest.Mock).mockResolvedValue({id:input.deviceId}); (getServerSession as jest.Mock).mockResolvedValue(null)})
function request(body:unknown) {return new Request('https://novo.test/api/companion/devices', {method:'POST', body:JSON.stringify(body)})}
it('requires explicit OAuth device:connect and passes only validated metadata', async () => {
  expect((await POST(request(input))).status).toBe(200)
  expect(requireCompanionOAuth).toHaveBeenCalledWith(expect.any(Request), ['device:connect'])
  expect(registerCompanionDevice).toHaveBeenCalledWith(actor, input)
})
it.each([{...input, grantId:'spoof'}, {...input, userId:'other'}, {...input, deviceId:'bad'}, {...input, name:' '}])('does not trust client identities or invalid metadata', async body => {
  expect((await POST(request(body))).status).toBe(400)
  expect(registerCompanionDevice).not.toHaveBeenCalled()
})
it('list needs a web session, not just a bearer token', async () => {
  expect((await GET()).status).toBe(401)
  expect(listCompanionDevices).not.toHaveBeenCalled()
  ;(getServerSession as jest.Mock).mockResolvedValue({user:{id:'owner'}})
  expect((await GET()).status).toBe(200)
  expect(listCompanionDevices).toHaveBeenCalledWith('owner')
})
