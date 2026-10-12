jest.mock('@/lib/prisma',()=>({prisma:{project:{findMany:jest.fn()},integrationAccount:{findMany:jest.fn()},novoSignalSourcePreference:{findMany:jest.fn()}}}))
jest.mock('@/lib/companion/credential-vault',()=>({resolveIntegrationCredential:jest.fn(()=> 'fixture'),decryptIntegrationCredential:jest.fn(()=> 'fixture')}))
jest.mock('@/lib/companion/github',()=>({fetchGitHubDeveloperContext:jest.fn()}))
jest.mock('@/lib/companion/vercel',()=>({fetchVercelProjects:jest.fn(),fetchVercelDeployments:jest.fn(),readVercelProjectSelection:jest.fn(()=>({projects:[]}))}))
import {prisma} from '@/lib/prisma'
import {buildProjectQueryContext} from '../project-query-context'
import {fetchGitHubDeveloperContext} from '@/lib/companion/github'
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
