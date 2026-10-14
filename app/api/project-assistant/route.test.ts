/** @jest-environment node */
jest.mock('next-auth',()=>({getServerSession:jest.fn()}))
jest.mock('@/lib/auth',()=>({authOptions:{}}))
jest.mock('@/lib/project-assistant/memory',()=>({readProjectAssistantMemories:jest.fn(),updateProjectAssistantMemory:jest.fn(),clearProjectAssistantMemory:jest.fn()}))
import {getServerSession} from 'next-auth'
import {readProjectAssistantMemories,updateProjectAssistantMemory,clearProjectAssistantMemory} from '@/lib/project-assistant/memory'
import {GET} from './route'
import {PUT,DELETE} from './[id]/route'

beforeEach(()=>{jest.clearAllMocks();(getServerSession as jest.Mock).mockResolvedValue({user:{id:'owner'}});(readProjectAssistantMemories as jest.Mock).mockResolvedValue([])})
test('requires a session before reading owned memory',async()=>{
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const denied=await GET(new Request('https://novo.test/api/project-assistant'))
  expect(denied.status).toBe(401);expect(readProjectAssistantMemories).not.toHaveBeenCalled()
  ;(getServerSession as jest.Mock).mockResolvedValue({user:{id:'owner'}})
  const allowed=await GET(new Request('https://novo.test/api/project-assistant'))
  expect(allowed.status).toBe(200);expect(allowed.headers.get('Cache-Control')).toBe('no-store')
  expect(readProjectAssistantMemories).toHaveBeenCalledWith('owner',expect.objectContaining({access:expect.objectContaining({personal:true})}))
})
test('strict mutations reject system fields and preserve the authenticated owner',async()=>{
  const context={params:Promise.resolve({id:'memory-1'})}
  const request=(body:unknown)=>new Request('https://novo.test/api/project-assistant/memory-1',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  const invalid=await PUT(request({revision:1,userId:'other',correction:'Something'}),context)
  expect(invalid.status).toBe(400);expect(updateProjectAssistantMemory).not.toHaveBeenCalled()
  const valid=await PUT(request({revision:1,trackingMode:'on'}),context)
  expect(valid.status).toBe(200);expect(updateProjectAssistantMemory).toHaveBeenCalledWith('owner','memory-1',{revision:1,trackingMode:'on'})
  expect((await DELETE(request({revision:1}),context)).status).toBe(200)
  expect(clearProjectAssistantMemory).toHaveBeenCalledWith('owner','memory-1',1)
})
test('does not expose database or provider error bodies',async()=>{
  ;(readProjectAssistantMemories as jest.Mock).mockRejectedValue(new Error('postgresql://secret:private@example/db'))
  const response=await GET(new Request('https://novo.test/api/project-assistant'))
  expect(response.status).toBe(503);expect(await response.text()).not.toContain('private')
})
