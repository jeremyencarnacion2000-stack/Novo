import {requireCompanionOAuth} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'
import {companionJson,companionErrorResponse} from '@/lib/companion/http'
import {findGoogleAccountForScopes} from '@/lib/google-account'
import {gmailService} from '@/lib/google'
import {isGmailReauthorizationError} from '@/lib/ai/gmail-context'

export const dynamic='force-dynamic'

/** Owner-scoped live connection health; no message content or provider diagnostics. */
export async function GET(request:Request):Promise<Response>{
  try{
    const actor=await requireCompanionOAuth(request,['device:connect','integrations:read'])
    await requireActiveCompanionDevice(actor,request.headers.get('X-Novo-Device-Id'))
    const grant=await findGoogleAccountForScopes(actor.userId,['gmail.readonly'])
    if(!grant)return companionJson({status:'not_connected'})
    try{
      await gmailService.checkAccessForUser(actor.userId)
      return companionJson({status:'available'})
    }catch(error){
      return companionJson({status:isGmailReauthorizationError(error)?'reauthorization_required':'unavailable'})
    }
  }catch(error){return companionErrorResponse(error)}
}
