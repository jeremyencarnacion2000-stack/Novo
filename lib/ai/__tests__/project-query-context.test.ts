jest.mock('@/lib/prisma',()=>({prisma:{project:{findMany:jest.fn()},integrationAccount:{findMany:jest.fn()},novoSignalSourcePreference:{findMany:jest.fn()}}}))
jest.mock('@/lib/companion/credential-vault',()=>({resolveIntegrationCredential:jest.fn(()=> 'fixture'),decryptIntegrationCredential:jest.fn(()=> 'fixture')}))
jest.mock('@/lib/companion/github',()=>({fetchGitHubDeveloperContext:jest.fn()}))
jest.mock('@/lib/companion/vercel',()=>({fetchVercelProjects:jest.fn(),fetchVercelDeployments:jest.fn(),readVercelProjectSelection:jest.fn(()=>({projects:[]}))}))
jest.mock('@/lib/project-assistant/memory',()=>({recordProjectObservations:jest.fn().mockResolvedValue({changed:0})}))
jest.mock('@/lib/project-assistant/context',()=>({buildProjectAssistantContext:jest.fn().mockResolvedValue({text:'',sources:[]})}))
import {prisma} from '@/lib/prisma'
import {buildProjectQueryContext} from '../project-query-context'
import {fetchGitHubDeveloperContext} from '@/lib/companion/github'
import {recordProjectObservations} from '@/lib/project-assistant/memory'
beforeEach(()=>{jest.clearAllMocks();(prisma.project.findMany as jest.Mock).mockResolvedValue([]);(prisma.integrationAccount.findMany as jest.Mock).mockResolvedValue([]);(prisma.novoSignalSourcePreference.findMany as jest.Mock).mockResolvedValue([])})
test('Twin permission alone never reads Novo projects or provider credentials',async()=>{
  const result=await buildProjectQueryContext('owner','mis proyectos',[{source:'github',name:'secret/repo',repository:'secret/repo'}],{personal:false,integrations:false},{github:'private native data'})
  expect(prisma.project.findMany).not.toHaveBeenCalled();expect(prisma.integrationAccount.findMany).not.toHaveBeenCalled()
  expect(result.text).not.toContain('private native data');expect(result.text).not.toContain('secret/repo')
})
test('project read permission is narrow and ownership filtered',async()=>{
  ;(prisma.project.findMany as jest.Mock).mockResolvedValue([{id:'p1',title:'Novo',status:'in-progress',progress:35,description:'https://github.com/owner/novo',notes:'private project note',tags:'[]'}])
  const result=await buildProjectQueryContext('owner','Novo',[],{personal:false,projects:true,integrations:false})
  expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{userId:'owner'}}))
  expect(result.text).toContain('owner/novo');expect(result.text).not.toContain('private project note')
})
test('excluded GitHub source is removed before any provider lookup, including local summaries',async()=>{
  ;(prisma.novoSignalSourcePreference.findMany as jest.Mock).mockResolvedValue([{source:'github'}])
  const result=await buildProjectQueryContext('owner','repositorios',[{source:'github',name:'hidden/repo',repository:'hidden/repo'}],{personal:false,integrations:true},{github:'hidden summary'})
  expect(fetchGitHubDeveloperContext).not.toHaveBeenCalled()
  expect(prisma.integrationAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{userId:'owner',provider:{in:['vercel']}}}))
  expect(result.text).not.toContain('hidden/repo');expect(result.text).not.toContain('hidden summary')
})
test('a single owned project exposes only confirmed open tasks with bounded coverage',async()=>{
  ;(prisma.project.findMany as jest.Mock).mockResolvedValue([{id:'p1',title:'ClickHome',status:'in-progress',progress:10,priority:'medium',tasks:[
    {id:'t1',title:'Verify checkout',status:'todo',priority:'high',dueDate:null},
    {id:'t2',title:'Completed work',status:'done',priority:'medium',dueDate:null},
  ]}])
  const result=await buildProjectQueryContext('owner','¿Qué tareas pendientes de ClickHome puedes confirmar?',[],{personal:false,projects:true,tasks:true,integrations:false})
  expect(result).toMatchObject({matchedProject:true,sources:['novo']})
  expect(result.text).toContain('Verify checkout')
  expect(result.text).toContain('confirmedOpenTasks')
  expect(result.text).not.toContain('Completed work')
  expect(JSON.parse(result.runtimeEvidence!)).toEqual({
    identities: [{source:'novo',name:'ClickHome'}],
    openTasks: {source:'novo',records:[{title:'Verify checkout',status:'todo'}],bounded:false},
    unavailable: [],
  })
  const noTasks=await buildProjectQueryContext('owner','¿Qué tareas pendientes de ClickHome puedes confirmar?',[],{personal:false,projects:true,tasks:false,integrations:false})
  expect(prisma.project.findMany).toHaveBeenLastCalledWith(expect.objectContaining({select:expect.objectContaining({tasks:false})}))
  expect(noTasks.text).not.toContain('confirmedOpenTasks')
  expect(JSON.parse(noTasks.runtimeEvidence!).openTasks).toBeNull()
})
test('project and task exclusions apply before retrieving live task evidence',async()=>{
  ;(prisma.novoSignalSourcePreference.findMany as jest.Mock).mockResolvedValue([{source:'projects'},{source:'tasks'}])
  const result=await buildProjectQueryContext('owner','tareas pendientes de ClickHome',[],{personal:false,projects:true,integrations:false})
  expect(prisma.project.findMany).not.toHaveBeenCalled()
  expect(result.text).not.toContain('confirmedOpenTasks')
})
test('a task-restricted read never replaces persisted task evidence with an empty list',async()=>{
  ;(prisma.project.findMany as jest.Mock).mockResolvedValue([{id:'p1',title:'ClickHome',status:'in-progress',progress:10,priority:'medium',version:1}])
  await buildProjectQueryContext('owner','tareas pendientes de ClickHome',[],{personal:false,projects:true,tasks:false,integrations:false})
  expect(recordProjectObservations).not.toHaveBeenCalled()
})
