import type {Message,MessageBlock} from '@/components/ai/modern-chatbot/types'

// Pure, browser-safe merge. Stale client collisions cannot overwrite a
// server message, but new local IDs are retained for an explicit CAS retry.
export function mergeConversationMessages(server:Message[],local:Message[]):Message[] {
  const localById=new Map(local.map(message=>[message.id,message]))
  const rank:Record<string,number>={waiting:0,pending:0,executing:1,failed:2,cancelled:3,success:4,confirmed:4}
  const blockRank=(block:MessageBlock)=>block.type==='confirmation'&&block.status==='waiting'&&block.content?.type==='SEND_EMAIL'&&block.content?.deliveryRecovery===true?2:rank[block.status??'']??0
  const progressText=(remote:string,nearby:string)=>nearby.startsWith(remote)?nearby:remote
  const merged=server.map(message=>{
    const nearby=localById.get(message.id)
    if(!nearby)return message
    const blocks=[...(Array.isArray(message.blocks)?message.blocks:[])]
    for(const block of Array.isArray(nearby.blocks)?nearby.blocks:[]){
      const index=blocks.findIndex(item=>item.id===block.id)
      if(index<0){blocks.push(block);continue}
      const current=blocks[index]
      const selected=blockRank(block)>blockRank(current)?block:current
      blocks[index]={...selected,...(typeof current.content==='string'&&typeof block.content==='string'?{content:progressText(current.content,block.content)}:{})}
    }
    const content=progressText(message.content,nearby.content)
    return {...message,content,...(blocks.length?{blocks}:{})}
  })
  const known=new Set(server.map(message=>message.id))
  for(const message of local)if(!known.has(message.id)){known.add(message.id);merged.push(message)}
  return merged
}

/** An interrupted UI request is not proof of failed delivery. Keep the card ID
 * so its next approval checks the same durable Gmail claim rather than sends again. */
export function recoverInterruptedMailReviews(messages:Message[]):Message[]{
  return messages.map(message=>({...message,...(Array.isArray(message.blocks)?{blocks:message.blocks.map((block:MessageBlock)=>
    block.type==='confirmation'&&block.status==='executing'&&block.content?.type==='SEND_EMAIL'
      ? {...block,status:'waiting' as const,content:{...block.content,deliveryRecovery:true}}:block)}:{})}))
}
