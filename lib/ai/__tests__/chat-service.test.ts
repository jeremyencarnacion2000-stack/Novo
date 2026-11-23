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
import {buildProjectQueryContext} from '../project-query-context'
jest.mock('../project-query-context',()=>({buildProjectQueryContext:jest.fn().mockResolvedValue({text:'',sources:[]})}))
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

const localRuntime = 'http://127.0.0.1:8764'
const enableOpenJarvis = () => {
  process.env.NOVO_OPENJARVIS_URL = localRuntime
  process.env.NOVO_OPENJARVIS_TOKEN = 'fixture-inference-credential-32-characters'
  process.env.NOVO_OPENJARVIS_MODEL = 'openai/gpt-oss-20b'
}
const continuation = () => parseNovoChatInput({
  message: 'Continuemos con ClickHome. Usa sólo el contexto autorizado disponible; si falta la tarea o el siguiente paso, pregúntame.',
  model: 'auto',
  localContext: 'PRIVATE unrelated raw folder text',
})!

it('routes the authorized continuation through OpenJarvis without sending unrelated personal context or exposing tools', async () => {
  enableOpenJarvis()
  ;(buildUserContext as jest.Mock).mockResolvedValueOnce({
    summary: 'PRIVATE mailbox and personal schedule',
    structured: { sources: [], activeSignal: null, twinContext: null },
  })
  ;(buildProjectQueryContext as jest.Mock).mockResolvedValueOnce({
    text: 'PRIVATE unrelated project', sources: ['novo'], matchedProject: true,
    runtimeEvidence: '{"identities":[{"source":"folder","name":"ClickHome"}],"openTasks":{"source":"novo","records":[{"title":"Revisar checkout","status":"todo"}]},"unavailable":[]}',
  })
  fetchMock.mockResolvedValueOnce(Response.json({
    content: 'En Novo consta «Revisar checkout». ¿Quieres retomarla?',
    inputTokens: 154, outputTokens: 22, elapsedMs: 510, cpuMs: 22, rssBytes: 52_000_000,
  }))
  const response = await streamNovoChat(continuation(), native, new AbortController().signal)
  const responseText = await response.text()
  expect(responseText).toContain('Revisar checkout')
  expect(responseText).toContain('source:novo')
  expect(responseText).toContain('[DONE]')
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, request] = fetchMock.mock.calls[0]
  expect(url.href).toBe(localRuntime + '/v1/novo/answer')
  expect(request.redirect).toBe('error')
  expect(request.body).toContain('ClickHome')
  expect(request.body).not.toMatch(/PRIVATE|tools|Authorization/)
})

it('falls back to the existing provider for unavailable or untrusted inference', async () => {
  enableOpenJarvis()
  ;(buildProjectQueryContext as jest.Mock).mockResolvedValue({
    text: 'Authorized project', sources: [], matchedProject: true, runtimeEvidence: '{"identities":[]}',
  })
  try {
    fetchMock.mockResolvedValueOnce(Response.json({ content: 'fake', tool_calls: [{ name: 'open' }] }))
    const failed = await streamNovoChat(continuation(), native, new AbortController().signal)
    expect(await failed.text()).toContain('Hola, Ángel')
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.groq.com/openai/v1/chat/completions')

    process.env.NOVO_OPENJARVIS_URL = 'https://example.test'
    const rejected = await streamNovoChat(continuation(), native, new AbortController().signal)
    expect(await rejected.text()).toContain('Hola, Ángel')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[2][0]).toBe('https://api.groq.com/openai/v1/chat/completions')
  } finally {
    ;(buildProjectQueryContext as jest.Mock).mockResolvedValue({ text: '', sources: [] })
  }
})

it('discards a cancelled OpenJarvis turn without calling a fallback provider', async () => {
  enableOpenJarvis()
  const cancel = new AbortController()
  ;(buildProjectQueryContext as jest.Mock).mockResolvedValueOnce({
    text: 'Authorized project', sources: [], matchedProject: true, runtimeEvidence: '{"identities":[]}',
  })
  fetchMock.mockImplementationOnce(async (_url, request) => {
    cancel.abort()
    expect(request.signal.aborted).toBe(true)
    throw new DOMException('Aborted', 'AbortError')
  })
  const result = await streamNovoChat(continuation(), native, cancel.signal)
  expect(result.status).toBe(409)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

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
it('runs the contextual budget in shadow on an authorized read without changing the provider prompt or sources',async()=>{
  process.env.NOVO_PROJECT_CONTEXT_SHADOW='1'
  const sources=[{id:'source:novo',kind:'novo',provider:'novo',label:'Novo',detail:'Owned project data'}]
  const structured={activeSignal:null,twinContext:null,sources,metrics:{focusTimeToday:null},todaySchedule:[{title:'unrelated calendar item'}],
    state:{tasksList:[{title:'generic task'}]},retrieval:{status:'partial',unavailable:['calendar']}}
  ;(buildUserContext as jest.Mock).mockResolvedValueOnce({summary:'Partial evidence\n'+JSON.stringify(structured),structured})
  ;(buildProjectQueryContext as jest.Mock).mockResolvedValueOnce({text:'AUTHORIZED PROJECT: fixture project. Task record: verify checkout.',sources:[],matchedProject:true})
  const log=jest.spyOn(console,'info').mockImplementation(()=>{})
  try{
    const result=await streamNovoChat(parseNovoChatInput({message:'¿Qué tareas pendientes de Fixture Project puedes confirmar?',model:'openai/gpt-oss-20b'})!,native,new AbortController().signal)
    expect(await result.text()).toContain('source:novo')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const prompt=JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content
    expect(prompt).toContain('unrelated calendar item')
    expect(prompt).toContain('AUTHORIZED PROJECT')
    expect(log).toHaveBeenCalledWith('[Novo Context Shadow]',expect.objectContaining({removedSections:expect.arrayContaining(['todaySchedule']),unavailableCount:1}))
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/fixture project|calendar item|verify checkout/i)
  }finally{log.mockRestore()}
})
it.each([web,native])('prepares a reviewed mail action for an address-only send on $surface',async(principal)=>{
  const proposal={type:'SEND_EMAIL',payload:{to:'team@example.test',subject:'Review',body:'Please review the project.'}}
  fetchMock.mockResolvedValueOnce(new Response('data: {"choices":[{"delta":{"content":"Preparé el correo para revisar."}}]}\n\ndata: [DONE]\n\n'))
    .mockResolvedValueOnce(Response.json({choices:[{message:{content:JSON.stringify({action:proposal})}}]}))
  const result=await streamNovoChat(parseNovoChatInput({message:'Send to team@example.test: please review the project',model:'openai/gpt-oss-20b'})!,principal,new AbortController().signal)
  const output=await result.text()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages[0].content).toContain('SKILL: CORRESPONDENCE')
  expect(output).toContain(principal.surface==='companion'?'"proposal"':'SEND_EMAIL')
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
