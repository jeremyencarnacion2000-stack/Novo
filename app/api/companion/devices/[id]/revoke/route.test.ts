/** @jest-environment node */
import {getServerSession} from 'next-auth'
import {revokeCompanionDevice} from '@/lib/companion/devices'
import {POST} from './route'
jest.mock('next-auth', () => ({getServerSession:jest.fn()}))
jest.mock('@/lib/auth', () => ({authOptions:{}}))
jest.mock('@/lib/mcp/resource', () => ({getIssuer:() => 'https://novo.test'}))
jest.mock('@/lib/companion/devices', () => ({revokeCompanionDevice:jest.fn()}))
const id = 'cd78b30e-93ca-4bd0-893a-a3f709b2f105'
beforeEach(() => {jest.clearAllMocks(); (getServerSession as jest.Mock).mockResolvedValue({user:{id:'owner'}})})
it.each([undefined, 'https://evil.test', 'null'])('rejects missing/cross-origin CSRF origins', async origin => {
  const response = await POST(new Request('https://novo.test/api/companion/devices/revoke', {method:'POST', headers:origin ? {origin} : {}}), {params:Promise.resolve({id})})
  expect(response.status).toBe(403)
  expect(revokeCompanionDevice).not.toHaveBeenCalled()
})
it('bearer without web session cannot revoke devices', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  expect((await POST(new Request('https://novo.test/revoke', {method:'POST', headers:{origin:'https://novo.test', authorization:'Bearer synthetic'}}), {params:Promise.resolve({id})})).status).toBe(401)
})
it('revokes only the signed-in account device on canonical origin', async () => {
  const response = await POST(new Request('https://novo.test/revoke', {method:'POST', headers:{origin:'https://novo.test'}}), {params:Promise.resolve({id})})
  expect(response.status).toBe(200)
  expect(revokeCompanionDevice).toHaveBeenCalledWith('owner', id)
})
