/** @jest-environment node */
import {getNovoChatModels, assertNovoChatModelAllowed} from '../chat-catalog'
import {prisma} from '@/lib/prisma'
jest.mock('@/lib/prisma',()=>({prisma:{user:{findUnique:jest.fn()}}}))
let saved:NodeJS.ProcessEnv
beforeEach(()=>{saved={...process.env};delete process.env.GROQ_API_KEY;delete process.env.GEMINI_API_KEY;delete process.env.OPENROUTER_API_KEY;jest.clearAllMocks();(prisma.user.findUnique as jest.Mock).mockResolvedValue({plan:'free'})})
afterEach(()=>{process.env=saved})
it('lists only configured models actually supported by the existing stream router',async()=>{
  process.env.GROQ_API_KEY='synthetic'
  expect((await getNovoChatModels('owner')).map(m=>m.id)).toEqual(['auto','openai/gpt-oss-120b','openai/gpt-oss-20b'])
  await expect(assertNovoChatModelAllowed('owner','gemini-flash-latest',false)).rejects.toMatchObject({status:403})
  await expect(assertNovoChatModelAllowed('owner','openai/gpt-oss-20b',false)).resolves.toBeUndefined()
})
it('uses the same current plan check for Twin in catalog and each request',async()=>{
  process.env.GEMINI_API_KEY='synthetic'
  expect((await getNovoChatModels('owner')).every(m=>!m.allowsTwinMode)).toBe(true)
  await expect(assertNovoChatModelAllowed('owner','auto',true)).rejects.toMatchObject({status:403,code:'twin_mode_unavailable'})
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({plan:'pro'})
  expect((await getNovoChatModels('owner')).every(m=>m.allowsTwinMode)).toBe(true)
  await expect(assertNovoChatModelAllowed('owner','auto',true)).resolves.toBeUndefined()
})
it('does not invent a directly selectable model for the OpenRouter rescue-only path',async()=>{
  process.env.OPENROUTER_API_KEY='synthetic'
  expect((await getNovoChatModels('owner')).map(m=>m.id)).toEqual(['auto'])
})
it('does not advertise a usable catalog when no providers are configured',async()=>{
  expect(await getNovoChatModels('owner')).toEqual([])
  await expect(assertNovoChatModelAllowed('owner','auto',false)).rejects.toMatchObject({status:503})
})
