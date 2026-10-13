/** @jest-environment node */
jest.mock('../refresh',()=>({refreshProjectAssistantBatch:jest.fn(async()=>({processed:1,succeeded:1,failed:0,skipped:0}))}))
import {GET} from '@/app/api/cron/project-assistant/route'
import {refreshProjectAssistantBatch} from '../refresh'
const request=(secret?:string)=>new Request('https://novo.test/api/cron/project-assistant',{headers:secret?{authorization:`Bearer ${secret}`}:{}}) as any
beforeEach(()=>{jest.clearAllMocks();process.env.CRON_SECRET='fixture-only'})
afterEach(()=>delete process.env.CRON_SECRET)
test('rejects untrusted scheduler calls without polling any private source',async()=>{
  expect((await GET(request())).status).toBe(401);expect(refreshProjectAssistantBatch).not.toHaveBeenCalled()
  expect((await GET(request('fixture-only'))).status).toBe(200)
})
test('does not disclose provider errors or account facts in scheduler output',async()=>{
  ;(refreshProjectAssistantBatch as jest.Mock).mockRejectedValueOnce(new Error('private token body'))
  const response=await GET(request('fixture-only'))
  expect(response.status).toBe(503);expect(await response.text()).not.toContain('private')
})
