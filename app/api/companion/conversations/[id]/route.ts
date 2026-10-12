import {requireCompanionOAuth} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'
import {requireCompanionChatEnabled} from '@/lib/companion/feature'
import {getCompanionConversation} from '@/lib/companion/conversations'
import {companionJson,companionErrorResponse} from '@/lib/companion/http'
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const actor=await requireCompanionOAuth(request,['device:connect','ai:chat'])
    requireCompanionChatEnabled()
    await requireActiveCompanionDevice(actor,request.headers.get('X-Novo-Device-Id'))
    return companionJson(await getCompanionConversation(actor.userId,(await params).id))
  }catch(error){return companionErrorResponse(error)}
}
