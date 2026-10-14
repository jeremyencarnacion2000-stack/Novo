import {prisma} from '@/lib/prisma'
import {resolveIntegrationCredential} from '@/lib/companion/credential-vault'
import {readVercelProjectSelection} from '@/lib/companion/vercel'
import type {ProviderWorkOperation} from './service-actions'

export type ProviderActionResult={kind:'github_issue'|'vercel_deployment';resourceId:string}
export class ProviderActionError extends Error {
  constructor(public readonly state:'failed'|'uncertain',public readonly code:string){super(code);this.name='ProviderActionError'}
}

type Fetcher=typeof fetch
function fail(code:string):never{throw new ProviderActionError('failed',code)}
function safeId(value:unknown):string|null{return typeof value==='string'&&/^[a-z0-9_.:-]{1,128}$/i.test(value)?value:null}
async function boundedFetch(fetcher:Fetcher,url:string|URL,init:RequestInit,timeoutMs:number){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs)
  try{return await fetcher(url,{...init,signal:controller.signal})}finally{clearTimeout(timer)}
}

async function createGitHubIssue(userId:string,operation:Extract<ProviderWorkOperation,{kind:'github.issue.create'}>,requestId:string,fetcher:Fetcher):Promise<ProviderActionResult>{
  const account=await prisma.integrationAccount.findUnique({where:{userId_provider:{userId,provider:'github'}},select:{accessToken:true,scope:true}})
  if(!account?.accessToken)fail('github_not_connected')
  if(!account.scope?.split(/[\s,]+/).includes('repo'))fail('github_repo_permission_required')
  let token:string
  try{token=resolveIntegrationCredential(account.accessToken,{userId,provider:'github'})}catch{fail('github_auth_required')}
  const path=operation.repository.split('/').map(encodeURIComponent).join('/')
  let response:Response
  try{
    response=await boundedFetch(fetcher,`https://api.github.com/repos/${path}/issues`,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:JSON.stringify({title:operation.title,body:`${operation.body}${operation.body?'\n\n':''}<!-- novo-request:${requestId} -->`}),cache:'no-store'},12_000)
  }catch{throw new ProviderActionError('uncertain','github_result_unknown')}
  if(!response.ok){
    if(response.status>=500||response.status===408)throw new ProviderActionError('uncertain','github_result_unknown')
    if(response.status===401)fail('github_auth_required')
    if(response.status===403||response.status===404)fail('github_permission_denied')
    if(response.status===429)fail('github_rate_limited')
    fail('github_issue_rejected')
  }
  const payload=await response.json().catch(()=>null) as {number?:unknown}|null
  if(!payload||!Number.isSafeInteger(payload.number)||Number(payload.number)<1)throw new ProviderActionError('uncertain','github_result_unknown')
  return {kind:'github_issue',resourceId:String(payload.number)}
}

async function redeployVercel(userId:string,operation:Extract<ProviderWorkOperation,{kind:'vercel.deployment.redeploy'}>,fetcher:Fetcher):Promise<ProviderActionResult>{
  const account=await prisma.integrationAccount.findUnique({where:{userId_provider:{userId,provider:'vercel'}},select:{accessToken:true,metadata:true}})
  if(!account?.accessToken)fail('vercel_not_connected')
  let token:string
  try{token=resolveIntegrationCredential(account.accessToken,{userId,provider:'vercel'})}catch{fail('vercel_auth_required')}
  const selection=readVercelProjectSelection(account.metadata)
  const project=selection.projects.find(candidate=>candidate.id===operation.projectId&&candidate.name===operation.projectName)
  if(!project)fail('vercel_project_not_selected')
  const lookupUrl=new URL('https://api.vercel.com/v7/deployments')
  lookupUrl.searchParams.set('limit','5');lookupUrl.searchParams.set('projectId',project.id)
  if(selection.teamId)lookupUrl.searchParams.set('teamId',selection.teamId)
  let lookup:Response
  try{lookup=await boundedFetch(fetcher,lookupUrl,{method:'GET',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store'},8_000)}catch{fail('vercel_deployment_unavailable')}
  if(!lookup.ok){if(lookup.status===401)fail('vercel_auth_required');if(lookup.status===403)fail('vercel_permission_denied');if(lookup.status===429)fail('vercel_rate_limited');fail('vercel_deployment_unavailable')}
  const deploymentPayload=await lookup.json().catch(()=>null) as {deployments?:unknown}|null
  if(!deploymentPayload||!Array.isArray(deploymentPayload.deployments))fail('vercel_deployment_unavailable')
  const recentDeployment=deploymentPayload.deployments.some(value=>value&&typeof value==='object'&&safeId((value as {uid?:unknown}).uid??(value as {id?:unknown}).id)===operation.deploymentId)
  if(!recentDeployment)fail('vercel_deployment_not_selected')
  const url=new URL('https://api.vercel.com/v13/deployments')
  if(selection.teamId)url.searchParams.set('teamId',selection.teamId)
  let response:Response
  try{
    response=await boundedFetch(fetcher,url,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({deploymentId:operation.deploymentId,target:operation.target}),cache:'no-store'},15_000)
  }catch{throw new ProviderActionError('uncertain','vercel_result_unknown')}
  if(!response.ok){
    if(response.status>=500||response.status===408)throw new ProviderActionError('uncertain','vercel_result_unknown')
    if(response.status===401)fail('vercel_auth_required')
    if(response.status===403)fail('vercel_permission_denied')
    if(response.status===429)fail('vercel_rate_limited')
    fail('vercel_redeploy_rejected')
  }
  const payload=await response.json().catch(()=>null) as {id?:unknown;uid?:unknown}|null
  const id=safeId(payload?.uid)??safeId(payload?.id)
  if(!id)throw new ProviderActionError('uncertain','vercel_result_unknown')
  return {kind:'vercel_deployment',resourceId:id}
}

/** Sends only one of the two typed, already-confirmed provider writes. */
export async function dispatchApprovedProviderAction(userId:string,operation:ProviderWorkOperation,requestId:string,fetcher:Fetcher=fetch):Promise<ProviderActionResult>{
  if(operation.kind==='github.issue.create')return createGitHubIssue(userId,operation,requestId,fetcher)
  return redeployVercel(userId,operation,fetcher)
}
