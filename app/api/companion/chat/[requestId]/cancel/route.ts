import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import {CompanionError,requireCompanionOAuth} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'
import {cancelCompanionTurn} from '@/lib/companion/chat-turns'
import {companionJson,companionErrorResponse} from '@/lib/companion/http'
export async function POST(request:Request,{params}:{params:Promise<{requestId:string}>}){
  try{
    const actor=await requireCompanionOAuth(request,['device:connect','ai:chat'])
    const deviceId=request.headers.get('X-Novo-Device-Id')
    await requireActiveCompanionDevice(actor,deviceId)
    const {requestId}=await params
    if(!z.string().uuid().safeParse(requestId).success)throw new CompanionError(400,'invalid_request')
    const turn=await prisma.companionChatTurn.findUnique({where:{userId_requestId:{userId:actor.userId,requestId}},include:{device:{select:{deviceId:true}}}})
    if(!turn || turn.device.deviceId!==deviceId || turn.grantId!==actor.grantId)throw new CompanionError(404,'turn_not_found')
    await cancelCompanionTurn(actor.userId,requestId)
    return companionJson({cancelled:true})
  }catch(error){return companionErrorResponse(error)}
}
