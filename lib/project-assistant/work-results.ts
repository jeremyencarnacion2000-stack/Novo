import type {Prisma,ProjectWork} from '@prisma/client'
import {ProjectAssistantError} from './contracts'
import {frozenWorkScopeSchema,workResultSchema} from './work-contracts'
import {workFingerprint} from './work-fingerprint'

const emptyHash='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
/** Evidence is collected by the bound device adapter, never by model text. */
export function validateWorkResult(job:ProjectWork,input:unknown){
  const result=workResultSchema.safeParse(input),scope=frozenWorkScopeSchema.safeParse(job.scope)
  if(!result.success||!scope.success)throw new ProjectAssistantError(400,'invalid_work_result')
  if(result.data.executionId!==job.executionId||result.data.baseCommit!==job.baseCommit)throw new ProjectAssistantError(409,'execution_conflict')
  const data=result.data
  if(new Set(data.changedPaths).size!==data.changedPaths.length)throw new ProjectAssistantError(400,'invalid_work_result')
  if(job.capability==='project.diagnose'){
    if(data.changedPaths.length||data.diffHash!==emptyHash||data.verification.status!=='not_run'||data.verification.checks.length)throw new ProjectAssistantError(400,'invalid_diagnosis')
    return {phase:'completed',reasonCode:'diagnosis_ready',result:data}
  }
  if(!['codex.prepare_fix','claude.prepare_fix'].includes(job.capability))throw new ProjectAssistantError(400,'invalid_capability')
  const checks=data.verification.checks,expected=scope.data.verification
  const passed=data.verification.status==='passed'&&expected.length>0&&checks.length===expected.length&&new Set(checks.map(check=>check.evidenceId)).size===checks.length&&checks.every((check,index)=>check.kind===expected[index].kind&&check.script===expected[index].script&&check.exitCode===0)
  return {phase:passed?'completed':'failed',reasonCode:passed?(data.changedPaths.length?'prepared_change':'no_change'):'verification_failed',result:data}
}

/** Called only inside the fenced report/receipt transaction, after authorization. */
export async function acceptVerifiedWorkResult(tx:Prisma.TransactionClient,userId:string,job:ProjectWork,input:unknown,now=new Date()):Promise<Prisma.ProjectWorkUpdateManyMutationInput>{
  if(job.userId!==userId)throw new ProjectAssistantError(404,'work_not_found')
  const accepted=validateWorkResult(job,input)
  const memory=await tx.projectAssistantMemory.findFirst({where:{id:job.memoryId,userId,clearedAt:null},select:{id:true}})
  if(!memory)throw new ProjectAssistantError(403,'memory_not_available')
  const mutation:Prisma.ProjectWorkUpdateManyMutationInput={phase:accepted.phase,reasonCode:accepted.reasonCode,result:accepted.result as Prisma.InputJsonValue,finishedAt:now,leaseExpiresAt:null}
  const settings=await tx.userSettings.findUnique({where:{userId},select:{settings:true}}),prefs=settings?.settings as Record<string,unknown>|null
  if(prefs?.ambientTwinPaused===true||prefs?.cognitiveLearningPaused===true)return mutation
  const fingerprint=`work:${job.id}:${workFingerprint(accepted.result)}`
  if(!await tx.novoSignalLedger.findUnique({where:{userId_fingerprint:{userId,fingerprint}},select:{id:true}})){
    const label=accepted.reasonCode==='prepared_change'?'Propuesta preparada y comprobada; pendiente de revisión y publicación.':accepted.reasonCode==='diagnosis_ready'?'Estado local del proyecto revisado.':accepted.reasonCode==='no_change'?'Comprobaciones completadas sin proponer cambios.':'La propuesta no superó las comprobaciones registradas.'
    const twin=await tx.cognitiveTwinRecord.upsert({where:{userId},update:{},create:{userId,confidenceScore:0,trustLevel:'initial',isInitialized:false,totalSignals:0},select:{id:true}})
    await tx.novoSignalLedger.create({data:{userId,fingerprint,source:'project_assistant',sourceRef:job.memoryId,signalType:'project_work_result',label,observedAt:now,reliability:'deterministic'}})
    await tx.twinEvolutionLog.create({data:{userId,twinId:twin.id,changeType:'project_context_updated',description:label,newValue:JSON.stringify({memoryId:job.memoryId,workId:job.id,fingerprint,outcome:accepted.reasonCode})}})
    await tx.projectAssistantMemory.updateMany({where:{id:job.memoryId,userId,clearedAt:null},data:{revision:{increment:1}}})
  }
  return mutation
}
