import {prisma} from '@/lib/prisma'
import {encryptIntegrationCredential} from '@/lib/companion/credential-vault'
import {dispatchApprovedProviderAction,ProviderActionError} from '../provider-actions'

jest.mock('@/lib/prisma',()=>({prisma:{integrationAccount:{findUnique:jest.fn()}}}))
const account=(prisma as any).integrationAccount.findUnique as jest.Mock
const json=(value:unknown,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value,headers:new Headers()})
const owner='owner-1',requestId='4c5ef56b-c9b1-45c5-8ad2-d625930e5b43'
const vercelOperation={kind:'vercel.deployment.redeploy' as const,projectId:'prj_novo',projectName:'Novo',deploymentId:'dpl_existing',target:'production' as const}
const vercelMetadata={teamId:'team_novo',projects:[{id:'prj_novo',name:'Novo'}],selectedProjectIds:['prj_novo']}
const connectedVercel=()=>({accessToken:encryptIntegrationCredential('vercel-secret',{userId:owner,provider:'vercel'}),metadata:vercelMetadata})
beforeEach(()=>{jest.clearAllMocks();process.env.NEXTAUTH_SECRET='provider-actions-test-secret'})

test('creates only the explicitly reviewed GitHub issue and tags its retry identity',async()=>{
  account.mockResolvedValue({accessToken:encryptIntegrationCredential('github-secret',{userId:owner,provider:'github'}),scope:'read:user,repo'})
  const fetcher=jest.fn().mockResolvedValue(json({number:42},201))
  await expect(dispatchApprovedProviderAction(owner,{kind:'github.issue.create',repository:'acme/novo',title:'Revisar la publicación',body:'La vista previa queda pendiente.'},requestId,fetcher)).resolves.toEqual({kind:'github_issue',resourceId:'42'})
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher).toHaveBeenCalledWith('https://api.github.com/repos/acme/novo/issues',expect.objectContaining({method:'POST',headers:expect.objectContaining({Authorization:'Bearer github-secret'}),body:expect.stringContaining(`<!-- novo-request:${requestId} -->`)}))
})

test('does not write a GitHub issue when the saved OAuth grant has no repo scope',async()=>{
  account.mockResolvedValue({accessToken:'github-secret',scope:'read:user'})
  const fetcher=jest.fn()
  await expect(dispatchApprovedProviderAction(owner,{kind:'github.issue.create',repository:'acme/novo',title:'Revisar',body:''},requestId,fetcher)).rejects.toMatchObject({state:'failed',code:'github_repo_permission_required'})
  expect(fetcher).not.toHaveBeenCalled()
})

test('repeats only the recent deployment from an explicitly selected Vercel project',async()=>{
  account.mockResolvedValue(connectedVercel())
  const fetcher=jest.fn()
    .mockResolvedValueOnce(json({deployments:[{uid:'dpl_existing',readyState:'READY',createdAt:Date.now(),url:'novo-preview.vercel.app'}]}))
    .mockResolvedValueOnce(json({id:'dpl_redeploy'}))
  await expect(dispatchApprovedProviderAction(owner,vercelOperation,requestId,fetcher)).resolves.toEqual({kind:'vercel_deployment',resourceId:'dpl_redeploy'})
  expect(String(fetcher.mock.calls[0][0])).toContain('projectId=prj_novo')
  expect(fetcher.mock.calls[0][1]).toEqual(expect.objectContaining({
    method:'GET',
    headers:expect.objectContaining({Authorization:'Bearer vercel-secret'}),
  }))
  expect(String(fetcher.mock.calls[1][0])).toBe('https://api.vercel.com/v13/deployments?teamId=team_novo')
  expect(fetcher.mock.calls[1][1]).toEqual(expect.objectContaining({method:'POST',body:JSON.stringify({deploymentId:'dpl_existing',target:'production'})}))
})

test('refuses an unselected project or a deployment missing from that project before the Vercel write',async()=>{
  account.mockResolvedValue(connectedVercel())
  const fetcher=jest.fn().mockResolvedValue(json({deployments:[{uid:'dpl_other',readyState:'READY',createdAt:Date.now()}]}))
  await expect(dispatchApprovedProviderAction(owner,vercelOperation,requestId,fetcher)).rejects.toMatchObject({state:'failed',code:'vercel_deployment_not_selected'})
  expect(fetcher).toHaveBeenCalledTimes(1)
  await expect(dispatchApprovedProviderAction(owner,{...vercelOperation,projectName:'Other'},requestId,fetcher)).rejects.toMatchObject({state:'failed',code:'vercel_project_not_selected'})
  expect(fetcher).toHaveBeenCalledTimes(1)
})

test('a lost provider response is classified uncertain for the approval layer to suppress retry',async()=>{
  account.mockResolvedValue({accessToken:'github-secret',scope:'repo'})
  const fetcher=jest.fn().mockRejectedValue(new Error('network interrupted'))
  await expect(dispatchApprovedProviderAction(owner,{kind:'github.issue.create',repository:'acme/novo',title:'Revisar',body:''},requestId,fetcher)).rejects.toMatchObject({state:'uncertain'})
  expect(fetcher).toHaveBeenCalledTimes(1)
})
