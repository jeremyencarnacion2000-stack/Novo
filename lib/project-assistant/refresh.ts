import {prisma} from '@/lib/prisma'
import {withProviderSyncLock} from '@/lib/provider-sync-lock'
import {resolveIntegrationCredential,decryptIntegrationCredential} from '@/lib/companion/credential-vault'
import {fetchGitHubDeveloperContext} from '@/lib/companion/github'
import {fetchVercelProjects,fetchVercelDeployments,readVercelProjectSelection} from '@/lib/companion/vercel'
import {projectObservationSchema,ProjectAssistantError,type ProjectObservation} from './contracts'
import {readProjectAssistantRecords,toAssistantMemoryView,recordProjectObservations} from './memory'
import {reconcileNovoProjectMemories} from './reconcile'
import {dispatchDelegationTriggers,pruneOperationalWorkDetails} from './work-triggers'

const claimKey='project-assistant:refresh'
const interval=15*60_000
const ttl=5*60_000
async function acquire(userId:string,minIntervalMs:number,now:Date) {
  const existing=await prisma.ambientReconciliationClaim.findUnique({where:{userId_idempotencyKey:{userId,idempotencyKey:claimKey}},select:{id:true,status:true,claimedAt:true,claimExpiresAt:true}})
  if(existing?.claimedAt&&existing.claimedAt.getTime()>now.getTime()-minIntervalMs)return null
  if(existing?.status==='processing'&&existing.claimExpiresAt&&existing.claimExpiresAt>now)return null
  const data={status:'processing',claimedAt:now,claimExpiresAt:new Date(now.getTime()+ttl),completedAt:null,failureCode:null}
  if(existing){
    const won=await prisma.ambientReconciliationClaim.updateMany({where:{id:existing.id,userId,OR:[{status:{not:'processing'}},{claimExpiresAt:{lte:now}},{claimExpiresAt:null}]},data:{...data,attempts:{increment:1}}})
    return won.count?{id:existing.id,claimedAt:now}:null
  }
  try{return await prisma.ambientReconciliationClaim.create({data:{userId,provider:'novo',providerAccountId:userId,entityType:'project_sync',sourceEntityId:'tracked_projects',idempotencyKey:claimKey,attempts:1,...data},select:{id:true,claimedAt:true}})}catch(error){if((error as {code?:string}).code==='P2002')return null;throw error}
}

export async function refreshProjectAssistantForUser(userId:string,options:{minIntervalMs?:number;now?:Date}={}) {
  const now=options.now??new Date(),claim=await acquire(userId,options.minIntervalMs??interval,now)
  if(!claim)return {status:'skipped' as const,reason:'recent_or_processing'}
  const finish=(status:string)=>prisma.ambientReconciliationClaim.updateMany({where:{id:claim.id,userId,status:'processing',claimedAt:claim.claimedAt},data:{status,completedAt:new Date(),claimExpiresAt:null}})
  const guard=async(tx:Parameters<Parameters<typeof withProviderSyncLock>[2]>[0])=>{
    const current=await tx.ambientReconciliationClaim.findUnique({where:{userId_idempotencyKey:{userId,idempotencyKey:claimKey}},select:{id:true,status:true,claimedAt:true,claimExpiresAt:true}})
    if(!current||current.id!==claim.id||current.status!=='processing'||current.claimedAt?.getTime()!==claim.claimedAt?.getTime()||!current.claimExpiresAt||current.claimExpiresAt<=new Date())throw new ProjectAssistantError(409,'refresh_lease_lost')
  }
  try{
    const settings=await prisma.userSettings.findUnique({where:{userId},select:{settings:true}})
    const prefs=settings?.settings as Record<string,unknown>|null
    if(prefs?.ambientTwinPaused===true||prefs?.cognitiveLearningPaused===true){await finish('completed');return {status:'skipped' as const,reason:'paused'}}
    await reconcileNovoProjectMemories(userId,now)
    const records=await readProjectAssistantRecords(userId,{personal:true,projects:true,integrations:true,currentWorkContext:true})
    const tracked=records.filter(row=>toAssistantMemoryView(row,now).tracked)
    const sources=tracked.flatMap(row=>row.sources).sort((a,b)=>(a.lastAttemptAt?.getTime()??0)-(b.lastAttemptAt?.getTime()??0))
    const excluded=await prisma.novoSignalSourcePreference.findMany({where:{userId,excludedAt:{not:null}},select:{source:true}})
    const blocked=new Set(excluded.map(row=>row.source))
    const accounts=await prisma.integrationAccount.findMany({where:{userId,provider:{in:['github','vercel'].filter(provider=>!blocked.has(provider))}},select:{provider:true,accessToken:true,metadata:true}})
    const observations:ProjectObservation[]=[],failedTargets:Array<{kind:string;keys:string[]}>=[]
    const push=(value:unknown)=>{const parsed=projectObservationSchema.safeParse(value);if(parsed.success)observations.push(parsed.data)}
    await Promise.all(accounts.map(async account=>{
      if(!account.accessToken)return
      if(account.provider==='github'){
        const repositories=[...new Set(sources.flatMap(source=>source.repository?[source.repository]:[]))].slice(0,3)
        if(!repositories.length)return
        try{
          const data=await fetchGitHubDeveloperContext(resolveIntegrationCredential(account.accessToken,{userId,provider:'github'}),fetch,{repositories,query:''})
          for(const row of data)push({kind:'github',sourceKey:row.repository,title:row.repository,repository:row.repository,observedAt:new Date().toISOString(),facts:{openPullRequests:row.openPullRequests,requestedReviewers:row.requestedReviewers,latestReviewState:row.latestReviewState,ci:row.ci,commit:row.commit,failedCheckIds:row.failedCheckIds}})
          const successful=new Set(data.map(row=>row.repository.toLowerCase()))
          failedTargets.push({kind:'github',keys:repositories.filter(repo=>!successful.has(repo))})
        }catch{failedTargets.push({kind:'github',keys:repositories})}
      }else if(account.provider==='vercel'){
        const selection=readVercelProjectSelection(account.metadata)
        const ids=new Set(sources.flatMap(source=>source.vercelProjectId?[source.vercelProjectId]:[]))
        const wanted=selection.projects.filter(project=>ids.has(project.id)).slice(0,3)
        if(!wanted.length)return
        try{
          const token=decryptIntegrationCredential(account.accessToken,{userId,provider:'vercel'})
          const catalog=await fetchVercelProjects(token,selection.teamId)
          const allowed=catalog.filter(project=>wanted.some(target=>target.id===project.id))
          const deployments=await fetchVercelDeployments(token,allowed,selection.teamId)
          for(const project of allowed){const latest=deployments.find(row=>row.projectId===project.id);if(latest)push({kind:'vercel',sourceKey:project.id,title:project.name,repository:project.repository,vercelProjectId:project.id,observedAt:new Date().toISOString(),facts:{deploymentId:latest.id,state:latest.state,createdAt:latest.createdAt}})}
          failedTargets.push({kind:'vercel',keys:wanted.filter(project=>!deployments.some(row=>row.projectId===project.id)).map(project=>project.id)})
        }catch{failedTargets.push({kind:'vercel',keys:wanted.map(project=>project.id)})}
      }
    }))
    if(observations.length)await recordProjectObservations(userId,observations,{guard})
    if(failedTargets.some(target=>target.keys.length))await withProviderSyncLock(prisma,`project-memory:${userId}`,async tx=>{
      await guard(tx)
      for(const target of failedTargets)if(target.keys.length)await tx.projectAssistantSource.updateMany({where:{userId,kind:target.kind,sourceKey:{in:target.keys}},data:{lastAttemptAt:new Date(),availability:'unavailable'}})
    })
    await reconcileNovoProjectMemories(userId)
    await dispatchDelegationTriggers(userId)
    await pruneOperationalWorkDetails(userId)
    await finish('completed')
    return {status:'refreshed' as const,observed:observations.length,unavailable:failedTargets.reduce((sum,target)=>sum+target.keys.length,0)}
  }catch(error){await finish('failed').catch(()=>undefined);throw error}
}

export async function refreshProjectAssistantBatch(limit=100) {
  const cap=Math.min(100,Math.max(1,limit))
  const never=await prisma.user.findMany({where:{ambientReconciliationClaims:{none:{idempotencyKey:claimKey}},OR:[{projects:{some:{}}},{projectAssistantMemories:{some:{clearedAt:null}}}]},select:{id:true},orderBy:{createdAt:'asc'},take:cap})
  const attempted=never.length===cap?[]:await prisma.ambientReconciliationClaim.findMany({where:{idempotencyKey:claimKey,userId:{notIn:never.map(row=>row.id)}},select:{userId:true},orderBy:{claimedAt:'asc'},take:cap-never.length})
  const ids=[...never.map(row=>row.id),...attempted.map(row=>row.userId)]
  let next=0,succeeded=0,failed=0,skipped=0
  await Promise.all(Array.from({length:Math.min(5,ids.length)},async()=>{while(next<ids.length){const id=ids[next++];try{const result=await refreshProjectAssistantForUser(id);if(result.status==='refreshed')succeeded++;else skipped++}catch{failed++}}}))
  return {processed:ids.length,succeeded,failed,skipped}
}
