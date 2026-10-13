import type {Prisma} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import {withProviderSyncLock} from '@/lib/provider-sync-lock'
import {ProjectAssistantError} from './contracts'
import {delegationInputSchema,type DelegationInput} from './work-contracts'

export async function requireDelegationBinding(tx:Prisma.TransactionClient,userId:string,input:Pick<DelegationInput,'memoryId'|'deviceId'|'workspaceId'>){
  const memory=await tx.projectAssistantMemory.findFirst({where:{id:input.memoryId,userId,clearedAt:null},select:{id:true,projectId:true}})
  if(!memory)throw new ProjectAssistantError(404,'memory_not_found')
  const device=await tx.companionDevice.findFirst({where:{userId,deviceId:input.deviceId,revokedAt:null,scopes:{hasEvery:['device:work:read','device:work:execute']}},select:{id:true,deviceId:true}})
  if(!device)throw new ProjectAssistantError(403,'device_permission_required')
  const workspace=await tx.projectAssistantSource.findFirst({where:{userId,memoryId:input.memoryId,deviceId:input.deviceId,kind:'folder',sourceKey:`${input.deviceId}:${input.workspaceId}`,availability:'available'},select:{repository:true,facts:true}})
  if(!workspace)throw new ProjectAssistantError(403,'workspace_not_authorized')
  return {memory,workspace}
}
export async function saveDelegation(userId:string,input:unknown){
  const parsed=delegationInputSchema.safeParse(input)
  if(!parsed.success)throw new ProjectAssistantError(400,'invalid_delegation')
  const {version,...data}=parsed.data
  return withProviderSyncLock(prisma,`project-memory:${userId}`,async tx=>{
    // Disabling an existing rule is always possible, including with an offline/revoked PC.
    const current=await tx.projectDelegation.findFirst({where:{userId,memoryId:data.memoryId}})
    if(data.enabled||!current||data.deviceId!==current.deviceId||data.workspaceId!==current.workspaceId)await requireDelegationBinding(tx,userId,data)
    if(current){
      if(current.version!==version)throw new ProjectAssistantError(409,'revision_conflict')
      const saved=await tx.projectDelegation.updateMany({where:{id:current.id,userId,version},data:{...data,verification:data.verification as Prisma.InputJsonValue,version:{increment:1}}})
      if(!saved.count)throw new ProjectAssistantError(409,'revision_conflict')
      await tx.projectWork.updateMany({where:{userId,delegationId:current.id,phase:{in:['pending','waiting_device','running','awaiting_confirmation']}},data:{phase:'cancelled',reasonCode:'delegation_changed',finishedAt:new Date(),revision:{increment:1}}})
      return {...current,...data,version:version+1}
    }
    if(version!==0)throw new ProjectAssistantError(409,'revision_conflict')
    return tx.projectDelegation.create({data:{userId,...data,verification:data.verification as Prisma.InputJsonValue}})
  })
}
