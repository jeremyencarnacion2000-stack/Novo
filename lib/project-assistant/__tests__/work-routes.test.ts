/** @jest-environment node */
jest.mock('@/lib/project-assistant/http',()=>({requireProjectAssistantSession:jest.fn(),projectAssistantJson:(body:unknown,status=200)=>Response.json(body,{status}),projectAssistantErrorResponse:(error:any)=>Response.json({error:error.code??'unavailable'},{status:error.status??503}),readProjectAssistantJson:(request:Request)=>request.json()}))
jest.mock('@/lib/companion/auth',()=>({requireCompanionOAuth:jest.fn()}))
jest.mock('@/lib/companion/devices',()=>({requireActiveCompanionDevice:jest.fn()}))
jest.mock('@/lib/project-assistant/device-work',()=>({claimDeviceWork:jest.fn(async()=>null),requireWorkStep:jest.fn(),reportDeviceWork:jest.fn(),projectWorkView:(job:unknown)=>job}))
jest.mock('@/lib/project-assistant/jobs',()=>({enqueueProjectWork:jest.fn(async()=>({id:'j1'})),cancelProjectWork:jest.fn()}))
jest.mock('../work-decisions',()=>({reconcileAbandonedProviderActions:jest.fn(async()=>0)}))
jest.mock('@/lib/prisma',()=>({prisma:{projectWork:{findMany:jest.fn()},projectDelegation:{findMany:jest.fn()},companionDevice:{findMany:jest.fn()},projectAssistantSource:{findMany:jest.fn()}}}))
import {requireProjectAssistantSession} from '../http'
import {requireCompanionOAuth} from '@/lib/companion/auth'
import {enqueueProjectWork} from '../jobs'
import {reconcileAbandonedProviderActions} from '../work-decisions'
import {POST as claim} from '@/app/api/companion/work/route'
import {POST as enqueue,GET as list} from '@/app/api/project-assistant/work/route'
import {prisma} from '@/lib/prisma'
const request=(body:unknown)=>new Request('https://novo.test/api/project-assistant/work',{method:'POST',body:JSON.stringify(body),headers:{'X-Novo-Device-Id':'cd78b30e-93ca-4bd0-893a-a3f709b2f105'}})
beforeEach(()=>{jest.clearAllMocks();(requireProjectAssistantSession as jest.Mock).mockResolvedValue('owner');(requireCompanionOAuth as jest.Mock).mockResolvedValue({userId:'owner'});for(const table of ['projectWork','projectDelegation','companionDevice','projectAssistantSource'])(prisma as any)[table].findMany.mockResolvedValue([])})
test('only owned canonical jobs are listed without leases or execution credentials',async()=>{
  const response=await list(new Request('https://novo.test/api/project-assistant/work'))
  expect(response.status).toBe(200)
  expect(reconcileAbandonedProviderActions).toHaveBeenCalledWith('owner')
  expect(prisma.projectWork.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({userId:'owner'})}))
  expect(await response.text()).not.toContain('leaseToken')
})
test('web requests are manual; a client cannot impersonate automatic triggers',async()=>{
  const body={memoryId:'m1',capability:'project.diagnose',objective:'Revisar el proyecto',requestId:'bcf7c70d-6d39-4bb9-86d2-9e75509c1b69'}
  expect((await enqueue(request({...body,mode:'automatic',trigger:{}}))).status).toBe(400)
  expect(enqueueProjectWork).not.toHaveBeenCalled()
  expect((await enqueue(request(body))).status).toBe(200)
  expect(enqueueProjectWork).toHaveBeenCalledWith('owner',{...body,mode:'manual'})
})
test('device claiming requires the new explicit execution permission',async()=>{
  expect((await claim(request({capabilities:['project.diagnose']}))).status).toBe(200)
  expect(requireCompanionOAuth).toHaveBeenCalledWith(expect.anything(),['device:connect','device:work:read','device:work:execute'])
})
