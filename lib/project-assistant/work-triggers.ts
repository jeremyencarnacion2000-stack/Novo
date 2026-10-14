import {prisma} from '@/lib/prisma'
import {ProjectAssistantError} from './contracts'
import {readProjectAssistantRecords,toAssistantMemoryView} from './memory'
import {enqueueProjectWork} from './jobs'
import {projectTriggerEvidence} from './trigger-evidence'
import {workCapabilitySchema} from './work-contracts'

/** No model decisions: refresh feeds only current, deterministic failure identities. */
export async function dispatchDelegationTriggers(userId:string,now=new Date()){
  const settings=await prisma.userSettings.findUnique({where:{userId},select:{settings:true}}),prefs=settings?.settings as Record<string,unknown>|null
  if(prefs?.ambientTwinPaused===true||prefs?.cognitiveLearningPaused===true)return {considered:0,queued:0}
  const excluded=new Set((await prisma.novoSignalSourcePreference.findMany({where:{userId,excludedAt:{not:null}},select:{source:true}})).map(row=>row.source))
  if(excluded.has('project_assistant')||excluded.has('work_context'))return {considered:0,queued:0}
  const [rules,records]=await Promise.all([prisma.projectDelegation.findMany({where:{userId,enabled:true},orderBy:{updatedAt:'asc'},take:100}),readProjectAssistantRecords(userId,{personal:true,projects:true,integrations:true,currentWorkContext:true})])
  let considered=0,queued=0
  for(const rule of rules){
    const record=records.find(row=>row.id===rule.memoryId)
    if(!record||!toAssistantMemoryView(record,now).tracked)continue
    const capability=workCapabilitySchema.safeParse(rule.capabilities[0]);if(!capability.success)continue
    const evidence=record.sources.filter(source=>!excluded.has(source.kind==='novo'?'projects':source.kind)).flatMap(source=>projectTriggerEvidence(source,now)).filter(trigger=>rule.triggers.includes(trigger.kind))
    for(const trigger of evidence){
      considered++
      const objective=trigger.kind==='ci_failure'?'Revisar el fallo reciente de las comprobaciones del proyecto.':trigger.kind==='deployment_failure'?'Revisar el fallo reciente del despliegue del proyecto.':'Revisar la tarea importante que ha vencido en este proyecto.'
      try{const work=await enqueueProjectWork(userId,{memoryId:record.id,capability:capability.data,objective,mode:'automatic',trigger},now);if(work.enqueued)queued++;break}catch(error){if(!(error instanceof ProjectAssistantError))throw error;if(!['project_work_active','daily_limit_reached','delegation_required','device_permission_required','workspace_not_authorized','trigger_not_authorized','context_permission_required','request_conflict','tracking_paused'].includes(error.code))throw error;}
    }
  }
  return {considered,queued}
}
/** Results and decision identities remain in ProjectWork; only event detail expires. */
export async function pruneOperationalWorkDetails(userId:string,now=new Date()){
  return prisma.projectWorkEvent.deleteMany({where:{userId,createdAt:{lt:new Date(now.getTime()-30*24*60*60*1000)}}})
}
