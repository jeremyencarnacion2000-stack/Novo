import {parseProjectSourceObservation,PROJECT_ASSISTANT_FRESH_MS} from './contracts'
import {workFingerprint} from './work-fingerprint'
import type {z} from 'zod'
import type {automaticTriggerEvidenceSchema} from './work-contracts'
type StoredSource=Parameters<typeof parseProjectSourceObservation>[0]&{availability:string}
export function projectTriggerEvidence(source:StoredSource,now=new Date()):Array<z.infer<typeof automaticTriggerEvidenceSchema>>{
  const observation=parseProjectSourceObservation(source)
  const age=now.getTime()-source.observedAt.getTime()
  if(!observation||source.availability!=='available'||age< -120000||age>PROJECT_ASSISTANT_FRESH_MS)return []
  const common={sourceKey:source.sourceKey,observedAt:source.observedAt.toISOString()}
  if(observation.kind==='github'&&observation.facts.ci.failed>0&&observation.facts.commit&&observation.facts.failedCheckIds?.length){
    const failedCheckIds=[...observation.facts.failedCheckIds].sort()
    return [{...common,kind:'ci_failure',evidenceKey:workFingerprint({kind:'ci_failure',sourceKey:source.sourceKey,commit:observation.facts.commit,failedCheckIds})}]
  }
  if(observation.kind==='vercel'&&observation.facts.state==='ERROR')return [{...common,kind:'deployment_failure',evidenceKey:workFingerprint({kind:'deployment_failure',sourceKey:source.sourceKey,deploymentId:observation.facts.deploymentId})}]
  if(observation.kind==='novo')return observation.facts.tasks.filter(task=>task.status!=='done'&&task.priority==='high'&&task.dueDate&&Date.parse(task.dueDate)<now.getTime()).map(task=>({...common,kind:'task_blocker' as const,evidenceKey:workFingerprint({kind:'task_blocker',sourceKey:source.sourceKey,taskId:task.id,dueDate:task.dueDate})}))
  return []
}
