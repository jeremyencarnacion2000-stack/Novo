import type {Message} from '@/components/ai/modern-chatbot/types'

// Pure, browser-safe merge. Stale client collisions cannot overwrite a
// server message, but new local IDs are retained for an explicit CAS retry.
export function mergeConversationMessages(server:Message[],local:Message[]):Message[] {
  const known=new Set(server.map(message=>message.id))
  const merged=[...server]
  for(const message of local)if(!known.has(message.id)){known.add(message.id);merged.push(message)}
  return merged
}
