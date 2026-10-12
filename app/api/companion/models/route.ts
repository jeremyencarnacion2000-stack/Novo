import {requireCompanionOAuth} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'
import {companionJson,companionErrorResponse} from '@/lib/companion/http'
import {requireCompanionChatEnabled} from '@/lib/companion/feature'
import {getNovoChatModels} from '@/lib/ai/chat-catalog'

export const dynamic = 'force-dynamic'
export async function GET(request:Request) {
  try {
    const actor = await requireCompanionOAuth(request,['device:connect','ai:chat'])
    requireCompanionChatEnabled()
    await requireActiveCompanionDevice(actor,request.headers.get('X-Novo-Device-Id'))
    return companionJson({models:await getNovoChatModels(actor.userId)})
  } catch (error) {return companionErrorResponse(error)}
}
