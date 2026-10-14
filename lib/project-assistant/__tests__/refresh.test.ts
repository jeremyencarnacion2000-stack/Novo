/** @jest-environment node */
jest.mock('@/lib/prisma',()=>({prisma:{novoSignalSourcePreference:{findMany:jest.fn()},ambientReconciliationClaim:{findUnique:jest.fn(),create:jest.fn(),updateMany:jest.fn(),findMany:jest.fn()},userSettings:{findUnique:jest.fn()},integrationAccount:{findMany:jest.fn()},projectAssistantSource:{updateMany:jest.fn()},user:{findMany:jest.fn()},$transaction:undefined}}))
jest.mock('../reconcile',()=>({reconcileNovoProjectMemories:jest.fn(async()=>({changed:0,tracked:1}))}))
jest.mock('../work-triggers',()=>({dispatchDelegationTriggers:jest.fn(),pruneOperationalWorkDetails:jest.fn()}))
jest.mock('../memory',()=>({readProjectAssistantRecords:jest.fn(),toAssistantMemoryView:jest.fn(()=>({tracked:true})),recordProjectObservations:jest.fn()}))
jest.mock('@/lib/companion/github',()=>({fetchGitHubDeveloperContext:jest.fn()}))
jest.mock('@/lib/companion/vercel',()=>({fetchVercelProjects:jest.fn(),fetchVercelDeployments:jest.fn(),readVercelProjectSelection:jest.fn(()=>({projects:[]}))}))
jest.mock('@/lib/companion/credential-vault',()=>({resolveIntegrationCredential:jest.fn(()=> 'fixture'),decryptIntegrationCredential:jest.fn(()=> 'fixture')}))
import {prisma} from '@/lib/prisma'
import {readProjectAssistantRecords,recordProjectObservations} from '../memory'
import {fetchGitHubDeveloperContext} from '@/lib/companion/github'
import {refreshProjectAssistantForUser} from '../refresh'
const db=prisma as any
beforeEach(()=>{
  jest.clearAllMocks()
  db.ambientReconciliationClaim.findUnique.mockResolvedValue(null)
  db.ambientReconciliationClaim.create.mockImplementation(async({data}:any)=>{const row={id:'claim',...data};db.ambientReconciliationClaim.findUnique.mockResolvedValue(row);return row})
  db.ambientReconciliationClaim.updateMany.mockResolvedValue({count:1})
  db.userSettings.findUnique.mockResolvedValue(null)
  db.novoSignalSourcePreference.findMany.mockResolvedValue([])
  db.integrationAccount.findMany.mockResolvedValue([{provider:'github',accessToken:'encrypted'}])
  ;(readProjectAssistantRecords as jest.Mock).mockResolvedValue([{id:'m1',sources:[{kind:'github',sourceKey:'owner/novo',repository:'owner/novo'}]}])
  ;(fetchGitHubDeveloperContext as jest.Mock).mockResolvedValue([{repository:'owner/novo',openPullRequests:1,ci:{passed:1,failed:1,pending:0}}])
})
test('a recent or live claim prevents duplicate upstream reads',async()=>{
  db.ambientReconciliationClaim.findUnique.mockResolvedValue({status:'processing',claimedAt:new Date(),claimExpiresAt:new Date(Date.now()+60000)})
  expect(await refreshProjectAssistantForUser('owner')).toMatchObject({status:'skipped'})
  expect(fetchGitHubDeveloperContext).not.toHaveBeenCalled()
})
test('only tracked authorized source targets are refreshed',async()=>{
  expect(await refreshProjectAssistantForUser('owner')).toMatchObject({status:'refreshed'})
  expect(fetchGitHubDeveloperContext).toHaveBeenCalledWith('fixture',fetch,{repositories:['owner/novo'],query:''})
  expect(recordProjectObservations).toHaveBeenCalledWith('owner',expect.arrayContaining([expect.objectContaining({kind:'github'})]),expect.anything())
})
test('paused tracking performs no upstream calls',async()=>{
  db.userSettings.findUnique.mockResolvedValue({settings:{ambientTwinPaused:true}})
  expect(await refreshProjectAssistantForUser('owner')).toMatchObject({status:'skipped',reason:'paused'})
  expect(fetchGitHubDeveloperContext).not.toHaveBeenCalled()
})
test('failure records unavailable separately and does not advance factual timestamps',async()=>{
  ;(fetchGitHubDeveloperContext as jest.Mock).mockRejectedValue(new Error('private provider body'))
  await refreshProjectAssistantForUser('owner')
  expect(recordProjectObservations).not.toHaveBeenCalled()
  const data=db.projectAssistantSource.updateMany.mock.calls[0][0].data
  expect(data).toMatchObject({availability:'unavailable'})
  expect(data).not.toHaveProperty('observedAt');expect(data).not.toHaveProperty('facts')
})
