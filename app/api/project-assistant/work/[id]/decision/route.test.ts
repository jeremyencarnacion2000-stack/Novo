/** @jest-environment node */
jest.mock('@/lib/project-assistant/http',()=>({requireProjectAssistantSession:jest.fn(),projectAssistantJson:(body:unknown,status=200)=>Response.json(body,{status}),projectAssistantErrorResponse:(error:any)=>Response.json({error:error.code??'unavailable'},{status:error.status??503}),readProjectAssistantJson:(request:Request)=>request.json()}))
jest.mock('@/lib/project-assistant/work-decisions',()=>({prepareProjectWorkAction:jest.fn(async()=>({id:'work-1'})),decideProjectWorkAction:jest.fn(async()=>({id:'work-1'}))}))
jest.mock('@/lib/project-assistant/device-work',()=>({projectWorkView:(work:unknown)=>work}))
jest.mock('next/server',()=>({after:jest.fn()}))
jest.mock('@/lib/project-assistant/refresh',()=>({refreshProjectAssistantForUser:jest.fn(async()=>({status:'refreshed'}))}))
import {after} from 'next/server'
import {refreshProjectAssistantForUser} from '@/lib/project-assistant/refresh'
import {requireProjectAssistantSession} from '@/lib/project-assistant/http'
import {prepareProjectWorkAction,decideProjectWorkAction} from '@/lib/project-assistant/work-decisions'
import {POST,PATCH} from './route'

const id='8a52e7c9-6c5f-4747-80e9-1c83b2fb6d65'
const request=(method:string,body:unknown)=>new Request(`https://novo.test/api/project-assistant/work/${id}/decision`,{method,body:JSON.stringify(body)})
beforeEach(()=>{jest.clearAllMocks();(requireProjectAssistantSession as jest.Mock).mockResolvedValue('owner')})

test('the authenticated owner prepares a strict pending operation',async()=>{
  const body={revision:4,requestId:'4c5ef56b-c9b1-45c5-8ad2-d625930e5b43',operation:{kind:'task.create',title:'Revisar despliegue',category:'Work',priority:'high'}}
  const response=await POST(request('POST',body),{params:Promise.resolve({id})})
  expect(response.status).toBe(200)
  expect(prepareProjectWorkAction).toHaveBeenCalledWith('owner',id,body)
})

test('the exact approval request goes through the owner decision service',async()=>{
  const body={revision:5,requestId:'4c5ef56b-c9b1-45c5-8ad2-d625930e5b43',fingerprint:'f'.repeat(64),decision:'confirm'}
  const response=await PATCH(request('PATCH',body),{params:Promise.resolve({id})})
  expect(response.status).toBe(200)
  expect(decideProjectWorkAction).toHaveBeenCalledWith('owner',id,body)
})

test('a successful approved provider write schedules a non-blocking Twin refresh',async()=>{
  ;(decideProjectWorkAction as jest.Mock).mockResolvedValueOnce({id,decision:{state:'applied',operation:{kind:'github.issue.create'}}})
  const body={revision:5,requestId:'4c5ef56b-c9b1-45c5-8ad2-d625930e5b43',fingerprint:'f'.repeat(64),decision:'confirm'}
  const response=await PATCH(request('PATCH',body),{params:Promise.resolve({id})})
  expect(response.status).toBe(200)
  expect(after).toHaveBeenCalledWith(expect.any(Function))
  await (after as jest.Mock).mock.calls[0][0]()
  expect(refreshProjectAssistantForUser).toHaveBeenCalledWith('owner',{minIntervalMs:0})
})

test('missing session and malformed work ID never reach mutation services',async()=>{
  ;(requireProjectAssistantSession as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('unauthorized'),{status:401,code:'unauthorized'}))
  expect((await PATCH(request('PATCH',{}),{params:Promise.resolve({id})})).status).toBe(401)
  expect(decideProjectWorkAction).not.toHaveBeenCalled()
  expect((await POST(request('POST',{}),{params:Promise.resolve({id:'bad id'})})).status).toBe(400)
  expect(prepareProjectWorkAction).not.toHaveBeenCalled()
})
