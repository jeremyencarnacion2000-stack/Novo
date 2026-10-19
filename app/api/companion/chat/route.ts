import {CompanionError,requireCompanionOAuth} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'
import {companionChatRequestSchema,companionChatEventSchema,companionChatErrorSchema,type CompanionChatEvent} from '@/lib/companion/contracts'
import {requireCompanionChatEnabled} from '@/lib/companion/feature'
import {claimCompanionTurn,finishCompanionTurn,failCompanionTurn,cancelCompanionTurn} from '@/lib/companion/chat-turns'
import {getCompanionConversation} from '@/lib/companion/conversations'
import {companionJson,companionErrorResponse,readCompanionJson} from '@/lib/companion/http'
import {assertNovoChatModelAllowed} from '@/lib/ai/chat-catalog'
import {streamNovoChat,parseNovoChatInput,normalizeHistory} from '@/lib/ai/chat-service'
import {releaseUserChatLease} from '@/lib/ai/chat-lease'
import {emailProposalSchema,type EmailProposal} from '@/lib/gmail-message'

export const maxDuration=180
const encoder=new TextEncoder()
const bytes=(event:CompanionChatEvent)=>encoder.encode(`data: ${JSON.stringify(companionChatEventSchema.parse(event))}\n\n`)
function replay(events:CompanionChatEvent[]):Response {
  return new Response(new ReadableStream({start(controller){for(const event of events)controller.enqueue(bytes(event));controller.close()}}),
    {headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store'}})
}

export async function POST(request:Request):Promise<Response> {
  let claimed:{userId:string;requestId:string}|null=null
  try{
    const actor=await requireCompanionOAuth(request,['device:connect','ai:chat'])
    requireCompanionChatEnabled()
    const deviceId=request.headers.get('X-Novo-Device-Id')
    await requireActiveCompanionDevice(actor,deviceId)
    const parsed=companionChatRequestSchema.safeParse(await readCompanionJson(request,192*1024))
    if(!parsed.success)throw new CompanionError(400,'invalid_request')
    const input=parsed.data
    await assertNovoChatModelAllowed(actor.userId,input.model,input.twinMode)
    if(input.twinMode && !actor.scopes.has('twin:read'))throw new CompanionError(403,'twin_permission_required')
    const claim=await claimCompanionTurn(actor,deviceId!,input)
    if(claim.kind==='conflict')return companionJson({error:claim.code},409)
    if(claim.kind==='pending')return companionJson({state:'pending',requestId:claim.requestId},202)
    if(claim.kind==='replay')return replay(claim.events)
    claimed={userId:actor.userId,requestId:input.requestId}
    const conversation=await getCompanionConversation(actor.userId,claim.conversationId)
    const history=normalizeHistory(conversation.messages.filter(m=>m.id!==claim.userMessageId))
    const serviceInput=parseNovoChatInput({message:input.message,model:input.model,twinMode:input.twinMode,history,localContext:input.localContext,projectHints:input.projectHints,localConnections:input.localConnections})!
    const abort=new AbortController()
    const signal=AbortSignal.any([request.signal,abort.signal])
    const upstream=await streamNovoChat(serviceInput,{userId:actor.userId,surface:'companion',contextAccess:{personal:actor.scopes.has('account:context:read'),projects:actor.scopes.has('projects:read'),integrations:actor.scopes.has('integrations:read'),twin:actor.scopes.has('twin:read'),development:actor.scopes.has('development:read'),currentWorkContext:actor.scopes.has('device:work-context:read'),deviceActivityRead:actor.scopes.has('device:activity:read')}},signal,claim.lease)
    if(!upstream.ok || !upstream.body || !upstream.headers.get('Content-Type')?.includes('text/event-stream')){
      throw new CompanionError(upstream.status===409?409:503,upstream.status===409?'cancelled':'provider_unavailable')
    }
    const reader=upstream.body.getReader()
    let transportClosed=false
    const stream=new ReadableStream<Uint8Array>({
      async start(controller){
        const emit=(event:CompanionChatEvent)=>{if(!transportClosed)controller.enqueue(bytes(event))}
        let text='',modelId=input.model,buffer='',sawDone=false
        let proposedEmail:EmailProposal|undefined
        const decoder=new TextDecoder('utf-8',{fatal:true})
        try{
          emit({type:'metadata',requestId:input.requestId,conversationId:claim.conversationId,revision:claim.revision,userMessageId:claim.userMessageId})
          for(;;){
            if(signal.aborted)throw new CompanionError(409,'cancelled')
            const next=await reader.read()
            buffer+=(next.done?decoder.decode():decoder.decode(next.value,{stream:true}))
            buffer=buffer.replace(/\r\n/g,'\n')
            let boundary:number
            while((boundary=buffer.indexOf('\n\n'))!==-1){
              const frame=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2)
              if(encoder.encode(frame).byteLength>65536)throw new CompanionError(503,'stream_interrupted')
              const data=frame.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n')
              if(!data)continue
              if(data==='[DONE]'){sawDone=true;continue}
              if(sawDone)throw new CompanionError(503,'stream_interrupted')
              const event=JSON.parse(data)
              if(event.error)throw new CompanionError(503,'stream_interrupted')
              if(event.proposal){
                const proposal=emailProposalSchema.safeParse(event.proposal)
                if(!proposal.success || proposedEmail)throw new CompanionError(503,'stream_interrupted')
                proposedEmail=proposal.data
              }
              if(event.meta){
                if(typeof event.meta.model!=='string'||event.meta.model.length>120)throw new CompanionError(503,'stream_interrupted')
                modelId=event.meta.model
                emit({type:'phase',requestId:input.requestId,phase:'composing_response'})
              }
              if(typeof event.content==='string'){
                text+=event.content
                if(text.length>500000)throw new CompanionError(503,'stream_interrupted')
                emit({type:'delta',requestId:input.requestId,text:event.content})
              }
            }
            if(encoder.encode(buffer).byteLength>65536)throw new CompanionError(503,'stream_interrupted')
            if(next.done)break
          }
          if(!sawDone || buffer.trim() || signal.aborted)throw new CompanionError(503,'stream_interrupted')
          // Revalidate the actual access token, Grant and device at completion.
          const current=await requireCompanionOAuth(request,['device:connect','ai:chat'])
          if(current.userId!==actor.userId || current.grantId!==actor.grantId || current.clientId!==actor.clientId)throw new CompanionError(401,'unauthorized')
          await requireActiveCompanionDevice(current,deviceId)
          if(signal.aborted)throw new CompanionError(409,'cancelled')
          const reviewLink=proposedEmail ? `\n\n[Revisar el correo y aprobar su envío en Novo](${new URL(request.url).origin}/chat?conversation=${encodeURIComponent(claim.conversationId)})` : ''
          const complete=await finishCompanionTurn(actor.userId,input.requestId,{text:text+reviewLink,modelId,...(proposedEmail?{proposedEmail}:{})})
          if(reviewLink)emit({type:'delta',requestId:input.requestId,text:reviewLink})
          emit(complete)
        }catch(error){
          abort.abort()
          const safe=error instanceof CompanionError ? companionChatErrorSchema.safeParse(error.code) : null
          const code=safe?.success ? safe.data : 'stream_interrupted'
          if(code==='cancelled')await cancelCompanionTurn(actor.userId,input.requestId).catch(()=>undefined)
          else await failCompanionTurn(actor.userId,input.requestId,code).catch(()=>undefined)
          emit({type:'error',requestId:input.requestId,code})
        }finally{
          abort.abort()
          await reader.cancel().catch(()=>undefined)
          reader.releaseLock()
          await releaseUserChatLease(actor.userId,input.requestId).catch(()=>undefined)
          if(!transportClosed){transportClosed=true;controller.close()}
        }
      },
      async cancel(){transportClosed=true;abort.abort();await cancelCompanionTurn(actor.userId,input.requestId)},
    })
    return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Accel-Buffering':'no'}})
  }catch(error){
    if(claimed){await failCompanionTurn(claimed.userId,claimed.requestId).catch(()=>undefined);await releaseUserChatLease(claimed.userId,claimed.requestId).catch(()=>undefined)}
    return companionErrorResponse(error)
  }
}
