/** @jest-environment node */
import { validateMcpBearerToken } from '@/lib/mcp/auth'
import { requireCompanionOAuth } from '../auth'
import { companionChatRequestSchema } from '../contracts'

const tokenFind = jest.fn(), grantFind = jest.fn(), pat = jest.fn()
jest.mock('@/lib/mcp/oidc-provider', () => ({getOidcProvider:() => ({AccessToken:{find:(...args:unknown[]) => tokenFind(...args)}, Grant:{find:(...args:unknown[]) => grantFind(...args)}})}))
jest.mock('@/lib/mcp/personal-access-token', () => ({validateMcpPersonalAccessToken:(...args:unknown[]) => pat(...args)}))
jest.mock('@/lib/mcp/resource', () => ({getIssuer:() => 'https://novo.test', getMcpResourceUri:() => 'https://novo.test/api/mcp'}))

const request = () => new Request('https://novo.test/api/companion/chat', {headers:{authorization:'Bearer synthetic-token'}})
const expiresAt = Math.floor(Date.now() / 1000) + 3600
beforeEach(() => {
  jest.clearAllMocks()
  pat.mockResolvedValue({ok:false})
  tokenFind.mockResolvedValue({isValid:true, accountId:'owner', clientId:'client', grantId:'grant',
    aud:'https://novo.test/api/mcp', scopes:new Set(['device:connect', 'ai:chat']), exp:expiresAt})
  grantFind.mockResolvedValue({isValid:true, accountId:'owner', clientId:'client'})
})
it('derives principal/grant from validated server records and does not return tokens', async () => {
  const principal = await requireCompanionOAuth(request(), ['ai:chat'])
  expect(principal).toEqual({userId:'owner', clientId:'client', grantId:'grant', scopes:new Set(['device:connect', 'ai:chat']), expiresAt})
  expect(grantFind).toHaveBeenCalledWith('grant')
  expect(JSON.stringify(principal)).not.toContain('synthetic-token')
})
it('accepts an explicitly scoped PAT as a first-party companion credential', async () => {
  pat.mockResolvedValue({ok:true, userId:'owner', tokenId:'pat-123', authInfo:{token:'synthetic-token', clientId:'novo-device:pat-123', scopes:['ai:chat', 'device:connect'], expiresAt}})
  await expect(requireCompanionOAuth(request(), ['device:connect', 'ai:chat'])).resolves.toEqual({
    userId:'owner', clientId:'novo-device:pat-123', grantId:'pat:pat-123',
    scopes:new Set(['ai:chat', 'device:connect']), expiresAt,
  })
  expect(JSON.stringify(await requireCompanionOAuth(request(), ['ai:chat']))).not.toContain('synthetic-token')
  expect(tokenFind).not.toHaveBeenCalled()
})
it('rejects PATs missing a requested companion capability', async () => {
  pat.mockResolvedValue({ok:true, userId:'owner', tokenId:'pat-123', authInfo:{token:'synthetic-token', clientId:'novo-device:pat-123', scopes:['device:connect'], expiresAt}})
  await expect(requireCompanionOAuth(request(), ['device:connect', 'ai:chat'])).rejects.toMatchObject({status:403, code:'permission_required'})
})
it('does not upgrade old OAuth grants', async () => {
  tokenFind.mockResolvedValue({...await tokenFind(), scopes:new Set(['twin:read'])})
  await expect(requireCompanionOAuth(request(), ['ai:chat'])).rejects.toMatchObject({status:403, code:'permission_required'})
})
it('rejects an otherwise valid token bound to a different audience', async () => {
  tokenFind.mockResolvedValue({...await tokenFind(), aud:'https://other.test/api/mcp'})
  expect(await validateMcpBearerToken(request())).toMatchObject({ok:false, status:401})
})
it.each([null, {isValid:false, accountId:'owner', clientId:'client'}, {isValid:true, accountId:'other', clientId:'client'}])('rejects a missing, expired or mismatched grant', async grant => {
  grantFind.mockResolvedValue(grant)
  await expect(requireCompanionOAuth(request(), ['ai:chat'])).rejects.toMatchObject({status:401, code:'unauthorized'})
})
it('rejects expired tokens and missing grant identities', async () => {
  tokenFind.mockResolvedValue({...await tokenFind(), exp:1})
  await expect(requireCompanionOAuth(request(), ['ai:chat'])).rejects.toMatchObject({status:401})
  tokenFind.mockResolvedValue({...await tokenFind(), exp:expiresAt, grantId:null})
  await expect(requireCompanionOAuth(request(), ['ai:chat'])).rejects.toMatchObject({status:401})
})
it('fails closed with sanitized errors if validation storage is unavailable', async () => {
  tokenFind.mockRejectedValue(new Error('private provider detail'))
  await expect(requireCompanionOAuth(request(), ['ai:chat'])).rejects.toMatchObject({status:503, code:'authorization_unavailable', message:'authorization_unavailable'})
})
describe('narrow chat request', () => {
  const input = {requestId:'cd78b30e-93ca-4bd0-893a-a3f709b2f105', conversationId:null, conversationRevision:null, message:' Hello ', model:'auto', twinMode:false}
  it('trims text and permits only its declared fields', () => {
    expect(companionChatRequestSchema.parse(input).message).toBe('Hello')
    for (const field of ['userId', 'history', 'attachments', 'scopes', 'windowTitle']) {
      expect(companionChatRequestSchema.safeParse({...input, [field]:'not allowed'}).success).toBe(false)
    }
  })
  it.each([{message:' '}, {message:'x'.repeat(12001)}, {requestId:'not-uuid'}, {conversationId:'conversation', conversationRevision:null}, {conversationId:null, conversationRevision:0}, {conversationId:'conversation', conversationRevision:-1}])('rejects invalid text, identifiers or revision pairing', change => {
    expect(companionChatRequestSchema.safeParse({...input, ...change}).success).toBe(false)
  })
})
