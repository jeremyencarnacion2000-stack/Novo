import {z} from 'zod'
import {CompanionError,requireCompanionOAuth} from '@/lib/companion/auth'
import {companionErrorResponse,companionJson,readCompanionJson} from '@/lib/companion/http'
import {decideAssistantAction,getAssistantAction} from '@/lib/companion/assistant-actions'

export const dynamic='force-dynamic'

export async function GET(request:Request,context:{params:Promise<{id:string}>}){
  try{
    const actor=await requireCompanionOAuth(request,['device:connect','tasks:write'])
    const deviceId=request.headers.get('X-Novo-Device-Id')
    if(!deviceId)throw new CompanionError(400,'device_id_required')
    const {id}=await context.params
    return companionJson({action:await getAssistantAction(actor,deviceId,id)})
  }catch(error){return companionErrorResponse(error)}
}

export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{
    const actor=await requireCompanionOAuth(request,['device:connect','tasks:write'])
    const deviceId=request.headers.get('X-Novo-Device-Id')
    if(!deviceId)throw new CompanionError(400,'device_id_required')
    const parsed=z.object({revision:z.number().int().positive(),decision:z.enum(['confirm','deny'])}).strict().safeParse(await readCompanionJson(request,4096))
    if(!parsed.success)throw new CompanionError(400,'invalid_request')
    const {id}=await context.params
    return companionJson({action:await decideAssistantAction(actor,deviceId,id,parsed.data)})
  }catch(error){return companionErrorResponse(error)}
}
