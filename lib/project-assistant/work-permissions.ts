import type {Prisma} from '@prisma/client'
import {ProjectAssistantError} from './contracts'
import {automaticTriggerEvidenceSchema} from './work-contracts'
export async function requireAutomaticTracking(tx:Prisma.TransactionClient,userId:string,memoryId:string,trigger:unknown){
  const settings=await tx.userSettings.findUnique({where:{userId},select:{settings:true}}),prefs=settings?.settings as Record<string,unknown>|null
  if(prefs?.ambientTwinPaused===true||prefs?.cognitiveLearningPaused===true)throw new ProjectAssistantError(403,'tracking_paused')
  const memory=await tx.projectAssistantMemory.findFirst({where:{id:memoryId,userId,clearedAt:null},select:{trackingMode:true}})
  if(!memory||memory.trackingMode==='off')throw new ProjectAssistantError(403,'tracking_paused')
  const parsed=automaticTriggerEvidenceSchema.safeParse(trigger)
  if(!parsed.success)throw new ProjectAssistantError(403,'trigger_not_authorized')
  const sources=parsed.data.kind==='ci_failure'?['github']:parsed.data.kind==='deployment_failure'?['vercel']:['tasks','projects']
  if(await tx.novoSignalSourcePreference.findFirst({where:{userId,source:{in:sources},excludedAt:{not:null}},select:{id:true}}))throw new ProjectAssistantError(403,'trigger_not_authorized')
}
