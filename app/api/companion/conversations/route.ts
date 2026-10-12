import {requireCompanionOAuth} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'
import {requireCompanionChatEnabled} from '@/lib/companion/feature'
import {listCompanionConversations} from '@/lib/companion/conversations'
import {companionJson,companionErrorResponse} from '@/lib/companion/http'
export async function GET(request:Request){
  try{
    const actor=await requireCompanionOAuth(request,['device:connect','ai:chat'])
    requireCompanionChatEnabled()
    await requireActiveCompanionDevice(actor,request.headers.get('X-Novo-Device-Id'))
    return companionJson({conversations:await listCompanionConversations(actor.userId)})
  }catch(error){return companionErrorResponse(error)}
}
