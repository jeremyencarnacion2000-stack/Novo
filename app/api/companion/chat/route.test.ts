/** @jest-environment node */
jest.mock('@/lib/companion/auth',()=>({
  requireCompanionOAuth:jest.fn(),
  CompanionError:class CompanionError extends Error {
    constructor(public status:number, public code:string){super(code);this.name='CompanionError'}
  },
}))
jest.mock('@/lib/companion/devices',()=>({requireActiveCompanionDevice:jest.fn()}))
jest.mock('@/lib/companion/chat-turns',()=>({claimCompanionTurn:jest.fn(),finishCompanionTurn:jest.fn(),failCompanionTurn:jest.fn().mockResolvedValue(undefined),cancelCompanionTurn:jest.fn().mockResolvedValue(undefined)}))
jest.mock('@/lib/companion/conversations',()=>({getCompanionConversation:jest.fn().mockResolvedValue({messages:[]})}))
jest.mock('@/lib/ai/chat-service',()=>({
  streamNovoChat:jest.fn(),
  parseNovoChatInput:jest.fn((input)=>input),
  normalizeHistory:jest.fn((history)=>history),
}))
jest.mock('@/lib/ai/chat-catalog',()=>({assertNovoChatModelAllowed:jest.fn()}))
jest.mock('@/lib/ai/chat-lease',()=>({releaseUserChatLease:jest.fn().mockResolvedValue(undefined)}))
import {POST} from './route'
import {requireCompanionOAuth,CompanionError} from '@/lib/companion/auth'
import {claimCompanionTurn,finishCompanionTurn,failCompanionTurn} from '@/lib/companion/chat-turns'
import {streamNovoChat} from '@/lib/ai/chat-service'
const requestId='fa142c66-5f26-45de-b3b3-aef5363b705b',userMessageId='ba5342e0-4baf-48a3-951e-65cce251a397',assistantMessageId='96597522-16ae-45a9-bf9c-957c8f7a736d'
const body={requestId,conversationId:null,conversationRevision:null,message:'Hola',model:'auto',twinMode:false}
const actor={userId:'owner',clientId:'client',grantId:'grant',scopes:new Set(['device:connect','ai:chat']),expiresAt:Date.now()/1000+3600}
const request=(change={})=>new Request('https://novo.test/api/companion/chat',{method:'POST',headers:{'X-Novo-Device-Id':'42d1c6e8-c24a-42b4-80ab-20fb318496c9'},body:JSON.stringify({...body,...change})})
beforeEach(()=>{
  jest.clearAllMocks();process.env.NOVO_COMPANION_CHAT_ENABLED='true'
  ;(requireCompanionOAuth as jest.Mock).mockResolvedValue(actor)
  ;(claimCompanionTurn as jest.Mock).mockResolvedValue({kind:'claimed',requestId,conversationId:'conv',revision:1,userMessageId,lease:{userId:'owner',requestId,expiresAt:new Date(Date.now()+180000)}})
  ;(streamNovoChat as jest.Mock).mockImplementation(async()=>new Response('data: {"meta":{"model":"auto"}}\n\ndata: {"content":"Hola, Ángel"}\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}}))
  ;(finishCompanionTurn as jest.Mock).mockResolvedValue({type:'complete',requestId,assistantMessageId,revision:2,modelId:'auto'})
})
afterEach(()=>delete process.env.NOVO_COMPANION_CHAT_ENABLED)
it('hands an email proposal to the shared web conversation without executing it', async () => {
  const proposal = { type: 'SEND_EMAIL', payload: { to: 'becas@example.test', subject: 'Consulta', body: 'Hola, quisiera consultar mi solicitud.' } }
  ;(streamNovoChat as jest.Mock).mockResolvedValueOnce(new Response(`data: ${JSON.stringify({ content: 'He preparado el correo.' })}\n\ndata: ${JSON.stringify({ proposal })}\n\ndata: [DONE]\n\n`, { headers: { 'Content-Type': 'text/event-stream' } }))
  const output = await (await POST(request())).text()
  expect(output).toContain('/chat?conversation=conv')
  expect(finishCompanionTurn).toHaveBeenCalledWith('owner', requestId, expect.objectContaining({ proposedEmail: proposal }))
})
it('adapts only account service output and rechecks OAuth before committing',async()=>{
  const response=await POST(request());const output=await response.text()
  expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('no-store')
  const events=output.trim().split('\n\n').map(e=>JSON.parse(e.slice(6)))
  expect(events.map(e=>e.type)).toEqual(['metadata','phase','delta','complete'])
  expect(events[2].text).toBe('Hola, Ángel');expect(requireCompanionOAuth).toHaveBeenCalledTimes(2)
  expect(streamNovoChat).toHaveBeenCalledWith(expect.objectContaining({message:'Hola',history:[]}),expect.objectContaining({userId:'owner',surface:'companion',contextAccess:{personal:false,projects:false,integrations:false,twin:false,development:false,currentWorkContext:false,deviceActivityRead:false}}),expect.anything(),expect.objectContaining({requestId}))
})
it('twin:read grants the aggregate Twin mode, not broad personal account context',async()=>{
  ;(requireCompanionOAuth as jest.Mock).mockResolvedValue({...actor,scopes:new Set(['device:connect','ai:chat','twin:read'])})
  const response=await POST(request({twinMode:true}))
  await response.text()
  expect(response.status).toBe(200)
  expect(streamNovoChat).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({contextAccess:{personal:false,projects:false,integrations:false,twin:true,development:false,currentWorkContext:false,deviceActivityRead:false}}),expect.anything(),expect.anything())
})
it('shares only the user-entered current-work summary when its dedicated read scope is granted',async()=>{
  ;(requireCompanionOAuth as jest.Mock).mockResolvedValue({...actor,scopes:new Set(['device:connect','ai:chat','device:work-context:read'])})
  const response=await POST(request())
  await response.text()
  expect(response.status).toBe(200)
  expect(streamNovoChat).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({contextAccess:{personal:false,projects:false,integrations:false,twin:false,development:false,currentWorkContext:true,deviceActivityRead:false}}),expect.anything(),expect.anything())
})
it('activity capture permission alone never grants current-work context to the Twin',async()=>{
  ;(requireCompanionOAuth as jest.Mock).mockResolvedValue({...actor,scopes:new Set(['device:connect','ai:chat','device:activity:write'])})
  const response=await POST(request())
  await response.text()
  expect(response.status).toBe(200)
  expect(streamNovoChat).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({contextAccess:{personal:false,projects:false,integrations:false,twin:false,development:false,currentWorkContext:false,deviceActivityRead:false}}),expect.anything(),expect.anything())
})
it('activity read permission gives the Twin only observed device summaries, not broad personal context',async()=>{
  ;(requireCompanionOAuth as jest.Mock).mockResolvedValue({...actor,scopes:new Set(['device:connect','ai:chat','twin:read','device:activity:read'])})
  const response=await POST(request({twinMode:true}))
  await response.text()
  expect(response.status).toBe(200)
  expect(streamNovoChat).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({contextAccess:{personal:false,projects:false,integrations:false,twin:true,development:false,currentWorkContext:false,deviceActivityRead:true}}),expect.anything(),expect.anything())
})
it('same request pending/replay never invokes another provider',async()=>{
  ;(claimCompanionTurn as jest.Mock).mockResolvedValueOnce({kind:'pending',requestId})
  expect((await POST(request())).status).toBe(202)
  ;(claimCompanionTurn as jest.Mock).mockResolvedValueOnce({kind:'replay',events:[{type:'error',requestId,code:'stream_interrupted'}]})
  expect(await (await POST(request())).text()).toContain('stream_interrupted')
  expect(streamNovoChat).not.toHaveBeenCalled()
})
it('truncated output/expired token cannot mark a partial assistant complete',async()=>{
  ;(streamNovoChat as jest.Mock).mockResolvedValueOnce(new Response('data: {"content":"partial"}\n\n',{headers:{'Content-Type':'text/event-stream'}}))
  expect(await (await POST(request())).text()).toContain('stream_interrupted');expect(finishCompanionTurn).not.toHaveBeenCalled()
  ;(requireCompanionOAuth as jest.Mock).mockResolvedValueOnce(actor).mockRejectedValueOnce(new CompanionError(401,'unauthorized'))
  expect(await (await POST(request())).text()).toContain('unauthorized');expect(finishCompanionTurn).not.toHaveBeenCalled()
  expect(failCompanionTurn).toHaveBeenCalled()
})
it('rejects client history, disabled feature and oversized actual payload before claim',async()=>{
  expect((await POST(request({history:[{role:'user',content:'private'}]}))).status).toBe(400)
  expect((await POST(request({message:'x'.repeat(200000)}))).status).toBe(413)
  delete process.env.NOVO_COMPANION_CHAT_ENABLED
  expect((await POST(request())).status).toBe(503);expect(claimCompanionTurn).not.toHaveBeenCalled()
})
