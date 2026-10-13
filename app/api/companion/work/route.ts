import {z} from 'zod'
import {requireCompanionOAuth} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'
import {companionJson,readCompanionJson,companionErrorResponse} from '@/lib/companion/http'
import {ProjectAssistantError} from '@/lib/project-assistant/contracts'
import {claimDeviceWork} from '@/lib/project-assistant/device-work'
import {deviceWorkCapabilitiesSchema} from '@/lib/project-assistant/work-contracts'
export const dynamic='force-dynamic'
export async function POST(request:Request){
  try{
    const actor=await requireCompanionOAuth(request,['device:connect','device:work:read','device:work:execute'])
    const deviceId=request.headers.get('X-Novo-Device-Id')
    await requireActiveCompanionDevice(actor,deviceId)
    if(!deviceId)throw new ProjectAssistantError(400,'device_id_required')
    const parsed=z.object({capabilities:deviceWorkCapabilitiesSchema}).strict().safeParse(await readCompanionJson(request))
    if(!parsed.success)throw new ProjectAssistantError(400,'invalid_capabilities')
    return companionJson({work:await claimDeviceWork(actor,deviceId,parsed.data.capabilities)})
  }catch(error){return error instanceof ProjectAssistantError?companionJson({error:error.code},error.status):companionErrorResponse(error)}
}
