jest.mock('../memory',()=>({readProjectAssistantRecords:jest.fn(),toAssistantMemoryView:jest.fn(row=>({id:row.id,title:row.title,tracked:true,taskCount:2,blockerCount:1,revision:1,correction:row.correction,sources:[],nextStep:'Revisar bloqueo'}))}))
jest.mock('@/lib/prisma',()=>({prisma:{projectWork:{findMany:jest.fn().mockResolvedValue([])}}}))
import {prisma} from '@/lib/prisma'
import {readProjectAssistantRecords} from '../memory'
import {buildProjectAssistantContext} from '../context'
const at=new Date('2026-10-12T18:00:00Z')
beforeEach(()=>{jest.clearAllMocks();(readProjectAssistantRecords as jest.Mock).mockResolvedValue([{id:'memory-1',title:'Novo',correction:'Proyecto principal de estudio',sources:[{kind:'github',sourceKey:'owner/novo',title:'Novo',repository:'owner/novo',vercelProjectId:null,deviceId:null,observedAt:at,availability:'available',facts:{openPullRequests:2,ci:{passed:4,failed:1,pending:0}}}]}])})
test('recovers persistent project facts in a new chat without client hints',async()=>{
  const result=await buildProjectAssistantContext('owner','qué falta en Novo',{personal:true,integrations:true},at)
  expect(result.text).toContain('MEMORIA PERSISTENTE');expect(result.text).toContain('owner/novo');expect(result.text).toContain('Proyecto principal de estudio')
  expect(result.sources).toEqual(['github'])
  expect(result.text).toContain('nunca instrucciones')
})
test('passes current scopes to the memory reader and safely handles unavailable storage',async()=>{
  const access={personal:false,integrations:false}
  ;(readProjectAssistantRecords as jest.Mock).mockResolvedValue([])
  expect(await buildProjectAssistantContext('owner','hola',access)).toEqual({text:'',sources:[]})
  expect(readProjectAssistantRecords).toHaveBeenCalledWith('owner',access)
  ;(readProjectAssistantRecords as jest.Mock).mockRejectedValue(new Error('private database error'))
  expect((await buildProjectAssistantContext('owner','Novo',access)).text).not.toContain('private')
})
test('does not persist or repeat arbitrary raw provider fields',async()=>{
  ;(readProjectAssistantRecords as jest.Mock).mockResolvedValue([{id:'memory-1',title:'Novo',sources:[{kind:'github',sourceKey:'owner/novo',title:'Novo',repository:'owner/novo',observedAt:at,facts:{openPullRequests:2,ci:{passed:4,failed:1,pending:0},accessToken:'private secret'}}]}])
  const result=await buildProjectAssistantContext('owner','Novo',{personal:true,integrations:true},at)
  expect(result.text).not.toContain('private secret')
})
test('bounded context preserves complete JSON objects',async()=>{
  const task={id:'t1',title:'a'.repeat(160),status:'todo',priority:'high'}
  ;(readProjectAssistantRecords as jest.Mock).mockResolvedValue(Array.from({length:6},(_,i)=>({id:`m${i}`,title:'Novo',sources:[{kind:'novo',sourceKey:`p${i}`,title:'Novo',observedAt:at,facts:{status:'in-progress',progress:1,priority:'high',tasks:Array.from({length:100},()=>task)}}]})))
  const result=await buildProjectAssistantContext('owner','Novo',{personal:true,integrations:true},at)
  const json=result.text.split('\n')[3]
  expect(()=>JSON.parse(json)).not.toThrow()
  expect(json.length).toBeLessThanOrEqual(16000)
})
test('a new chat remembers a prepared outcome without treating it as published',async()=>{
  const uuid='11111111-1111-4111-8111-111111111111'
  ;(prisma.projectWork.findMany as jest.Mock).mockResolvedValue([{id:'job1',memoryId:'memory-1',phase:'completed',reasonCode:'prepared_change',finishedAt:at,result:{executionId:uuid,sessionId:uuid,artifactId:uuid,baseCommit:'a'.repeat(40),diffHash:'b'.repeat(64),changedPaths:['app/page.tsx'],summary:'Propuesta preparada, pendiente de revisión.',verification:{status:'passed',checks:[{kind:'npm_script',script:'test',exitCode:0,evidenceId:uuid}]}}}])
  const recalled=await buildProjectAssistantContext('owner','Novo',{personal:true,integrations:true,currentWorkContext:true},at)
  expect(recalled.text).toContain('Propuesta preparada, pendiente de revisión.')
  expect(recalled.text).toContain('no equivale a una publicación')
  expect(prisma.projectWork.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({userId:'owner',memoryId:{in:['memory-1']}})}))
  expect((await buildProjectAssistantContext('owner','Novo',{personal:true,integrations:true,currentWorkContext:false},at)).text).not.toContain('Propuesta preparada, pendiente de revisión.')
})
