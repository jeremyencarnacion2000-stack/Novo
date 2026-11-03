import {z} from 'zod'
import {CompanionError,requireCompanionOAuth} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'
import {companionErrorResponse,companionJson,readCompanionJson} from '@/lib/companion/http'
import {listPendingAssistantActions,prepareAssistantAction,assistantTaskOperationSchema} from '@/lib/companion/assistant-actions'

export const dynamic='force-dynamic'
const prepareSchema=z.object({requestId:z.string().uuid(),operation:assistantTaskOperationSchema}).strict()

export async function GET(request:Request){
  try{
    const actor=await requireCompanionOAuth(request,['device:connect','tasks:write'])
    const deviceId=request.headers.get('X-Novo-Device-Id')
    if(!deviceId)throw new CompanionError(400,'device_id_required')
    return companionJson({actions:await listPendingAssistantActions(actor,deviceId)})
  }catch(error){return companionErrorResponse(error)}
}

export async function POST(request:Request){
  try{
    const actor=await requireCompanionOAuth(request,['device:connect','tasks:write'])
    const deviceId=request.headers.get('X-Novo-Device-Id')
    if(!deviceId)throw new CompanionError(400,'device_id_required')
    await requireActiveCompanionDevice(actor,deviceId)
    const parsed=prepareSchema.safeParse(await readCompanionJson(request,16*1024))
    if(!parsed.success)throw new CompanionError(400,'invalid_request')
    return companionJson({action:await prepareAssistantAction(actor,deviceId,parsed.data.requestId,parsed.data.operation)},201)
  }catch(error){return companionErrorResponse(error)}
}
