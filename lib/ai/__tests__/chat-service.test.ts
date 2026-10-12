/** @jest-environment node */
jest.mock('@/lib/prisma',()=>({prisma:{user:{findUnique:jest.fn().mockResolvedValue({plan:'pro'})}}}))
jest.mock('@/lib/ai/context-builder',()=>({buildUserContext:jest.fn().mockResolvedValue({summary:'{}',structured:{activeSignal:null,twinContext:null,sources:[]}})}))
jest.mock('@/lib/ai/activity',()=>({createActivityRun:jest.fn().mockResolvedValue({id:'run-fixture'}),appendActivityEvent:jest.fn(),finishActivityRun:jest.fn(),isActivityCancelled:jest.fn().mockResolvedValue(false),recordFirstVisibleActivityContent:jest.fn()}))
jest.mock('@/lib/ai/chat-lease',()=>({acquireUserChatLease:jest.fn().mockImplementation(async(userId,requestId)=>({userId,requestId,expiresAt:new Date(Date.now()+180000)})),releaseUserChatLease:jest.fn()}))
jest.mock('@/lib/companion/chat-turns',()=>({isCompanionTurnCancelled:jest.fn().mockResolvedValue(false)}))
import {streamNovoChat, parseNovoChatInput, normalizeHistory, type NovoChatPrincipal} from '../chat-service'
import {buildUserContext} from '@/lib/ai/context-builder'
import {finishActivityRun,isActivityCancelled} from '@/lib/ai/activity'
import {acquireUserChatLease,releaseUserChatLease} from '@/lib/ai/chat-lease'
import {isCompanionTurnCancelled} from '@/lib/companion/chat-turns'
const web:NovoChatPrincipal = {userId:'owner',surface:'web',contextAccess:{personal:true,integrations:true}}
const native:NovoChatPrincipal = {...web,surface:'companion',contextAccess:{personal:false,integrations:false}}
const input = () => parseNovoChatInput({message:'Hola',model:'openai/gpt-oss-20b'})!
let saved:NodeJS.ProcessEnv
let fetchMock:jest.SpyInstance
beforeEach(()=>{
  saved={...process.env};process.env.GROQ_API_KEY='synthetic';delete process.env.GEMINI_API_KEY;delete process.env.OPENROUTER_API_KEY
  jest.clearAllMocks()
  fetchMock=jest.spyOn(global,'fetch').mockImplementation(async()=>new Response('data: {"choices":[{"delta":{"content":"Hola, Ángel"}}]}\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}}))
})
afterEach(()=>{fetchMock.mockRestore();process.env=saved})
it('preserves the web metadata/content/DONE contract and selected model routing',async()=>{
  const result=await streamNovoChat(input(),web,new AbortController().signal)
  const events=(await result.text()).split('\n\n').filter(Boolean).map(s=>s.slice(6))
  expect(events.map(s=>s==='[DONE]'?'done':Object.keys(JSON.parse(s))[0])).toEqual(['meta','content','done'])
  expect(JSON.parse(events[0]).meta).toMatchObject({runId:'run-fixture',model:'openai/gpt-oss-20b',fallback:false,sources:[]})
  expect(JSON.parse(events[1])).toEqual({content:'Hola, Ángel'})
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('openai/gpt-oss-20b')
})
it('passes native context capabilities to the existing builder and never starts the System Agent',async()=>{
  const result=await streamNovoChat(parseNovoChatInput({message:'crea una tarea para mañana'})!,native,new AbortController().signal)
  await result.text()
  expect(buildUserContext).toHaveBeenCalledWith('owner',expect.objectContaining({contextAccess:{personal:false,integrations:false}}))
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
it('rejects disallowed models/Twin before context retrieval or provider access',async()=>{
  const result=await streamNovoChat(parseNovoChatInput({message:'Hola',model:'not-configured'})!,native,new AbortController().signal)
  expect(result.status).toBe(403)
  expect(buildUserContext).not.toHaveBeenCalled()
  expect(fetchMock).not.toHaveBeenCalled()
})
it('never marks a native partial provider stream complete',async()=>{
  let reads=0
  fetchMock.mockImplementation(async()=>new Response(new ReadableStream({pull(controller){
    if(reads++===0)controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'))
    else controller.error(new Error('synthetic private upstream failure'))
  }})))
  const result=await streamNovoChat(input(),native,new AbortController().signal)
  const output=await result.text()
  expect(output).toContain('partial')
  expect(output).toContain('chat_stream_interrupted')
  expect(output).not.toContain('[DONE]')
  expect(output).not.toContain('synthetic private upstream')
  expect(finishActivityRun).not.toHaveBeenCalledWith('owner','run-fixture','completed',expect.anything())
})
it('native provider failures cannot masquerade as a completed assistant response',async()=>{
  fetchMock.mockImplementation(async()=>new Response(JSON.stringify({error:{message:'private provider diagnostic'}}),{status:503}))
  const result=await streamNovoChat(input(),native,new AbortController().signal)
  expect(result.status).toBe(503)
  expect(await result.text()).not.toContain('[DONE]')
})
it('propagates caller cancellation to fetch with credential redirects forbidden',async()=>{
  const controller=new AbortController()
  const result=await streamNovoChat(input(),native,controller.signal)
  await result.text()
  const options=fetchMock.mock.calls[0][1]
  expect(options.redirect).toBe('error')
  controller.abort()
  expect(options.signal.aborted).toBe(true)
})
it('normalizes server-retrieved history with the same web bounds',()=>{
  const messages=Array.from({length:50},(_,i)=>({role:i%2?'assistant':'user',content:'x'.repeat(7000)}))
  const normalized=normalizeHistory(messages)
  expect(normalized.length).toBeLessThanOrEqual(20)
  expect(normalized.every(m=>m.content.length<=6000)).toBe(true)
})
it('web and native share persistent exclusion and release after stream consumption',async()=>{
  ;(acquireUserChatLease as jest.Mock).mockResolvedValueOnce(null)
  const busy=await streamNovoChat(input(),web,new AbortController().signal)
  expect(busy.status).toBe(409)
  expect(fetchMock).not.toHaveBeenCalled()
  const response=await streamNovoChat(input(),web,new AbortController().signal)
  await response.text()
  expect(releaseUserChatLease).toHaveBeenCalledWith('owner',expect.any(String))
})
it('groups persisted cancellation checks rather than querying for every token',async()=>{
  const chunks=Array.from({length:40},()=> 'data: {"choices":[{"delta":{"content":"x"}}]}\n\n')
  fetchMock.mockImplementation(async()=>new Response(new ReadableStream({start(controller){for(const chunk of chunks)controller.enqueue(new TextEncoder().encode(chunk));controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));controller.close()}})))
  await (await streamNovoChat(input(),web,new AbortController().signal)).text()
  expect(isActivityCancelled).toHaveBeenCalledTimes(2) // pre-provider and final, no per-token DB polling
})
it('aborts a stalled companion provider when its persisted turn is cancelled',async()=>{
  ;(isCompanionTurnCancelled as jest.Mock).mockResolvedValueOnce(false).mockResolvedValue(true)
  let upstreamSignal:AbortSignal|undefined
  fetchMock.mockImplementation(async(_input,init)=>{
    const signal=init?.signal as AbortSignal
    upstreamSignal=signal
    return new Response(new ReadableStream({start(controller){
      signal.addEventListener('abort',()=>controller.error(new Error('aborted by cancellation')),{once:true})
    }}),{headers:{'Content-Type':'text/event-stream'}})
  })
  const lease={userId:'owner',requestId:'turn-1',expiresAt:new Date(Date.now()+180000)}
  const response=await streamNovoChat(input(),native,new AbortController().signal,lease)
  const body=response.text()
  await new Promise(resolve=>setTimeout(resolve,2_100))
  expect(isCompanionTurnCancelled).toHaveBeenCalledWith('owner','turn-1')
  expect(upstreamSignal?.aborted).toBe(true)
  await body
})
