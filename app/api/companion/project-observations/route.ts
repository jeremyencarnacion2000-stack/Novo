import {CompanionError,requireCompanionOAuth} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'
import {companionJson,companionErrorResponse,readCompanionJson} from '@/lib/companion/http'
import {projectObservationsSchema,ProjectAssistantError} from '@/lib/project-assistant/contracts'
import {recordProjectObservations} from '@/lib/project-assistant/memory'

export const dynamic='force-dynamic'
export async function POST(request:Request) {
  try{
    const actor=await requireCompanionOAuth(request,['device:connect','device:work-context:write'])
    const deviceId=request.headers.get('X-Novo-Device-Id')
    await requireActiveCompanionDevice(actor,deviceId)
    if(!deviceId)throw new CompanionError(400,'device_id_required')
    const parsed=projectObservationsSchema.safeParse(await readCompanionJson(request))
    if(!parsed.success||parsed.data.observations.some(item=>item.kind!=='folder'&&item.kind!=='agent'))throw new CompanionError(400,'invalid_observations')
    const result=await recordProjectObservations(actor.userId,parsed.data.observations,{deviceId,replaceInventory:parsed.data.replaceInventory,guard:async tx=>{
      const current=await tx.companionDevice.findFirst({where:{userId:actor.userId,deviceId,clientId:actor.clientId,grantId:actor.grantId,revokedAt:null,scopes:{has:'device:work-context:write'}},select:{id:true}})
      if(!current)throw new CompanionError(403,'device_authorization_mismatch')
      for(const observation of parsed.data.observations){
        if(observation.kind!=='agent')continue
        const folder=await tx.projectAssistantSource.findFirst({where:{userId:actor.userId,deviceId,kind:'folder',sourceKey:`${deviceId}:${observation.facts.workspaceId}`,availability:'available'},select:{id:true}})
        if(!folder)throw new CompanionError(403,'workspace_not_authorized')
      }
    }})
    return companionJson(result)
  }catch(error){
    if(error instanceof ProjectAssistantError)return companionJson({error:error.code},error.status)
    return companionErrorResponse(error)
  }
}
