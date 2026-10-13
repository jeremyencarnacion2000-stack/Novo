import type {Prisma,ProjectAssistantMemory,ProjectAssistantSource} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import {withProviderSyncLock} from '@/lib/provider-sync-lock'
import {resolveObservationIdentity} from './identity'
import {projectObservationSchema,projectMemoryPatchSchema,parseProjectSourceObservation,ProjectAssistantError,PROJECT_ASSISTANT_FRESH_MS,type ProjectObservation,type ProjectMemoryPatch,type ProjectAssistantAccess,type AssistantMemoryView} from './contracts'

type MemoryRecord=ProjectAssistantMemory&{sources:ProjectAssistantSource[]}
type ObservationOptions={deviceId?:string;now?:Date}
const fullAccess:ProjectAssistantAccess={personal:true,projects:true,integrations:true,development:true,currentWorkContext:true}

/** Validate before storing; the device namespace is assigned by the authenticated caller. */
export async function recordProjectObservations(userId:string,observations:ProjectObservation[],options:ObservationOptions={}) {
  if(observations.length>100)throw new ProjectAssistantError(400,'invalid_observations')
  const now=options.now??new Date()
  const settings=await prisma.userSettings?.findUnique({where:{userId},select:{settings:true}})
  const preferences=settings?.settings&&typeof settings.settings==='object'?settings.settings as Record<string,unknown>:{}
  if(preferences.cognitiveLearningPaused===true||preferences.ambientTwinPaused===true)return {changed:0,conflicts:0,paused:true}
  const parsed=observations.map(value=>{
    const result=projectObservationSchema.safeParse(value)
    if(!result.success)throw new ProjectAssistantError(400,'invalid_observations')
    if(new Date(result.data.observedAt).getTime()>now.getTime()+120_000)throw new ProjectAssistantError(400,'invalid_observed_at')
    if((result.data.kind==='folder'||result.data.kind==='agent')&&!options.deviceId)throw new ProjectAssistantError(403,'device_required')
    return result.data
  })
  return withProviderSyncLock(prisma,`project-memory:${userId}`,async tx=>{
    const records=await tx.projectAssistantMemory.findMany({where:{userId},include:{sources:{where:{userId}}},take:500})
    let changed=0,conflicts=0
    for(const observation of parsed){
      const local=observation.kind==='folder'||observation.kind==='agent'
      const sourceKey=local?`${options.deviceId}:${observation.sourceKey}`:observation.sourceKey
      const repository=observation.repository??(observation.kind==='github'?observation.sourceKey:null)
      const vercelProjectId=observation.vercelProjectId??(observation.kind==='vercel'?observation.sourceKey:null)
      const identity={...observation,sourceKey,repository,vercelProjectId}
      const resolution=resolveObservationIdentity(records,identity)
      if(resolution.kind==='conflict'){conflicts++;continue}
      let record=resolution.kind==='existing'?records.find(row=>row.id===resolution.id):undefined
      // Forgotten identities retain a tombstone, including after new evidence arrives.
      if(record?.clearedAt)continue
      let projectId:string|null=null
      if(observation.kind==='novo'){
        const project=await tx.project.findFirst({where:{id:observation.sourceKey,userId},select:{id:true}})
        if(!project)throw new ProjectAssistantError(404,'project_not_found')
        projectId=project.id
        if(record?.projectId&&record.projectId!==projectId){conflicts++;continue}
      }
      let created=false
      if(!record){
        const memory=await tx.projectAssistantMemory.create({data:{userId,projectId,title:observation.title}})
        record={...memory,sources:[]};records.push(record);created=true
      }
      const previous=record.sources.find(source=>source.kind===observation.kind&&source.sourceKey===sourceKey)
      const observedAt=new Date(observation.observedAt)
      if(previous&&previous.observedAt>observedAt)continue
      // Equal timestamps with different content are ambiguous, not a newer fact.
      if(previous&&previous.observedAt.getTime()===observedAt.getTime()&&JSON.stringify(previous.facts)!==JSON.stringify(observation.facts)){conflicts++;continue}
      const facts=observation.facts as Prisma.InputJsonValue
      const sourceChanged=!previous||previous.title!==observation.title||previous.repository!==repository||previous.vercelProjectId!==vercelProjectId||JSON.stringify(previous.facts)!==JSON.stringify(facts)
      const data={title:observation.title,repository,vercelProjectId,deviceId:local?options.deviceId!:null,facts,observedAt,lastAttemptAt:now,availability:'available'}
      const source=await tx.projectAssistantSource.upsert({where:{userId_kind_sourceKey:{userId,kind:observation.kind,sourceKey}},create:{userId,memoryId:record.id,kind:observation.kind,sourceKey,...data},update:data})
      if(previous)record.sources[record.sources.indexOf(previous)]=source
      else record.sources.push(source)
      if(sourceChanged){
        changed++
        if(!created){
          const patch={revision:{increment:1},...(projectId?{projectId,title:observation.title}:{}),updatedAt:now}
          await tx.projectAssistantMemory.updateMany({where:{id:record.id,userId,clearedAt:null},data:patch})
          record.revision++;record.updatedAt=now
          if(projectId){record.projectId=projectId;record.title=observation.title}
        }
      }
    }
    return {changed,conflicts}
  })
}

function allowedSource(kind:string,access:ProjectAssistantAccess,excluded:Set<string>) {
  if(kind==='novo')return Boolean((access.personal||access.projects)&&!excluded.has('projects'))
  if(kind==='github'||kind==='vercel')return Boolean((access.integrations||access.development)&&!excluded.has(kind))
  if(kind==='folder'||kind==='agent')return Boolean((access.currentWorkContext??access.personal)&&!excluded.has('work_context'))
  return false
}

/** Internal records are permission-filtered before any summary or prompt is built. */
export async function readProjectAssistantRecords(userId:string,access:ProjectAssistantAccess) {
  if(!access.personal&&!access.projects&&!access.integrations&&!access.development&&!access.currentWorkContext)return [] as MemoryRecord[]
  const [rows,preferences,devices]=await Promise.all([
    prisma.projectAssistantMemory.findMany({where:{userId,clearedAt:null},include:{sources:{where:{userId}}},orderBy:{updatedAt:'desc'},take:100}),
    prisma.novoSignalSourcePreference.findMany({where:{userId,excludedAt:{not:null}},select:{source:true}}),
    (access.currentWorkContext??access.personal)?prisma.companionDevice.findMany({where:{userId,revokedAt:null},select:{deviceId:true}}):Promise.resolve([]),
  ])
  const excluded=new Set(preferences.map(row=>row.source)),activeDevices=new Set(devices.map(row=>row.deviceId))
  return rows.flatMap(row=>{
    const sources=row.sources.filter(source=>allowedSource(source.kind,access,excluded)&&(!source.deviceId||activeDevices.has(source.deviceId))).map(source=>source.kind==='novo'&&excluded.has('tasks')?{...source,facts:{...(source.facts as object),tasks:[]}}:source)
    return sources.length?[{...row,projectId:access.personal||access.projects?row.projectId:null,title:access.personal||access.projects?row.title:sources[0].title,correction:access.personal||access.projects?row.correction:null,sources}]:[]
  })
}

export function toAssistantMemoryView(row:MemoryRecord,now=new Date()):AssistantMemoryView {
  let taskCount=0,blockerCount=0,highPriority=false
  const sources:AssistantMemoryView['sources']=[]
  for(const source of row.sources){
    const facts=parseProjectSourceObservation(source)
    if(!facts)continue
    const fresh=now.getTime()-source.observedAt.getTime()<=PROJECT_ASSISTANT_FRESH_MS&&source.observedAt.getTime()<=now.getTime()+120_000
    const available=source.availability==='available'
    sources.push({kind:facts.kind,sourceKey:source.sourceKey,observedAt:source.observedAt.toISOString(),fresh,available,...(source.repository?{repository:source.repository}:{}),...(source.vercelProjectId?{vercelProjectId:source.vercelProjectId}:{}),...(source.deviceId?{deviceId:source.deviceId}:{})})
    if(facts.kind==='novo'){
      taskCount+=facts.facts.tasks.filter(task=>task.status!=='done').length
      highPriority=facts.facts.status!=='completed'&&(facts.facts.priority==='high'||facts.facts.tasks.some(task=>task.status!=='done'&&task.priority==='high'))
    }
    if(fresh&&available){
      if(facts.kind==='github')blockerCount+=facts.facts.ci.failed
      if(facts.kind==='vercel'&&facts.facts.state==='ERROR')blockerCount++
      if(facts.kind==='agent'&&facts.facts.state==='failed')blockerCount++
    }
  }
  const mode=row.trackingMode==='on'||row.trackingMode==='off'?row.trackingMode:'auto'
  return {id:row.id,title:row.title,linkedProjectId:row.projectId,trackingMode:mode,tracked:mode==='on'||(mode==='auto'&&highPriority),revision:row.revision,correction:row.correction,sources,taskCount,blockerCount,nextStep:blockerCount?'Revisar el bloqueo detectado':taskCount?'Continuar las tareas pendientes':'Contexto listo para consultar',updatedAt:row.updatedAt.toISOString()}
}

export async function readProjectAssistantMemories(userId:string,options:{access:ProjectAssistantAccess;query?:string;now?:Date}) {
  const records=await readProjectAssistantRecords(userId,options.access)
  const query=options.query?.toLowerCase()
  return records.filter(row=>!query||query.includes(row.title.toLowerCase())||row.sources.some(source=>source.repository&&query.includes(source.repository.split('/').pop()!.toLowerCase()))).map(row=>toAssistantMemoryView(row,options.now)).filter(row=>row.sources.length>0)
}

export async function updateProjectAssistantMemory(userId:string,id:string,input:ProjectMemoryPatch) {
  const parsed=projectMemoryPatchSchema.safeParse(input)
  if(!parsed.success)throw new ProjectAssistantError(400,'invalid_memory_update')
  const {revision,...patch}=parsed.data
  const current=await prisma.projectAssistantMemory.findFirst({where:{id,userId,clearedAt:null}})
  if(!current)throw new ProjectAssistantError(404,'memory_not_found')
  const updated=await prisma.projectAssistantMemory.updateMany({where:{id,userId,revision,clearedAt:null},data:{...patch,revision:{increment:1}}})
  if(!updated.count)throw new ProjectAssistantError(409,'revision_conflict')
  return (await readProjectAssistantMemories(userId,{access:fullAccess})).find(row=>row.id===id)??null
}

export async function clearProjectAssistantMemory(userId:string,id:string,revision:number) {
  await withProviderSyncLock(prisma,`project-memory:${userId}`,async tx=>{
    const current=await tx.projectAssistantMemory.findFirst({where:{id,userId,clearedAt:null}})
    if(!current)throw new ProjectAssistantError(404,'memory_not_found')
    const result=await tx.projectAssistantMemory.updateMany({where:{id,userId,revision,clearedAt:null},data:{clearedAt:new Date(),correction:null,trackingMode:'off',revision:{increment:1}}})
    if(!result.count)throw new ProjectAssistantError(409,'revision_conflict')
    await tx.projectAssistantSource.updateMany({where:{userId,memoryId:id},data:{facts:{},availability:'forgotten'}})
    await tx.novoSignalLedger.deleteMany({where:{userId,source:'project_assistant',sourceRef:id}})
    await tx.twinEvolutionLog.deleteMany({where:{userId,changeType:'project_context_updated',newValue:{contains:`"memoryId":${JSON.stringify(id)}`}}})
  })
}
