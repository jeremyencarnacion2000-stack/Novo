import {createHash} from 'node:crypto'
import {prisma} from '@/lib/prisma'
import {getOrCreateTwin} from '@/lib/cognitive/get-or-create-twin'
import {withProviderSyncLock} from '@/lib/provider-sync-lock'
import {createNovoProjectObservations} from './observations'
import {recordProjectObservations,readProjectAssistantRecords,toAssistantMemoryView} from './memory'

/** Factual project evolution; never modifies priorities, deadlines or manual task state. */
export async function reconcileNovoProjectMemories(userId:string,now=new Date()) {
  const projects=await prisma.project.findMany({where:{userId},select:{id:true,title:true,status:true,priority:true,progress:true,version:true,description:true,notes:true,tags:true,tasks:{where:{userId},select:{id:true,title:true,status:true,priority:true,dueDate:true},orderBy:{id:'asc'},take:100}},orderBy:{updatedAt:'desc'},take:100})
  const recorded=await recordProjectObservations(userId,createNovoProjectObservations(projects,now),{now})
  if(recorded.paused)return {changed:0,tracked:0}
  const records=await readProjectAssistantRecords(userId,{personal:true,projects:true,integrations:true,currentWorkContext:true})
  const tracked=records.filter(row=>toAssistantMemoryView(row,now).tracked)
  if(!tracked.length)return {changed:recorded.changed,tracked:0}
  const twin=await getOrCreateTwin(userId)
  await withProviderSyncLock(prisma,`project-evolution:${userId}`,async tx=>{
    for(const row of tracked){
      const view=toAssistantMemoryView(row,now)
      const evidence=row.sources.map(source=>({kind:source.kind,key:source.sourceKey,availability:source.availability,facts:source.facts})).sort((a,b)=>`${a.kind}:${a.key}`.localeCompare(`${b.kind}:${b.key}`))
      const hash=createHash('sha256').update(JSON.stringify({id:row.id,evidence,correction:row.correction,trackingMode:row.trackingMode})).digest('hex')
      const fingerprint=`project:${row.id}:${hash}`
      if(await tx.novoSignalLedger.findUnique({where:{userId_fingerprint:{userId,fingerprint}},select:{id:true}}))continue
      const label=`${row.title}: ${view.taskCount} pendientes, ${view.blockerCount} bloqueos`.slice(0,240)
      await tx.novoSignalLedger.create({data:{userId,fingerprint,source:'project_assistant',sourceRef:row.id,signalType:'project_state_reconciled',label,observedAt:now,reliability:'deterministic'}})
      await tx.twinEvolutionLog.create({data:{userId,twinId:twin.id,changeType:'project_context_updated',description:label,newValue:JSON.stringify({memoryId:row.id,fingerprint,taskCount:view.taskCount,blockerCount:view.blockerCount})}})
    }
  })
  return {changed:recorded.changed,tracked:tracked.length}
}
