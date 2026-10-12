import {prisma} from '@/lib/prisma'
import {CompanionError} from '@/lib/companion/auth'
import type {NovoChatModel} from '@/lib/companion/contracts'

/** Explicit selection supported by the existing router, not a provider probe.
 * OpenRouter remains rescue-only; auto can use it, a direct choice cannot. */
export async function getNovoChatModels(userId:string):Promise<NovoChatModel[]> {
  const user = await prisma.user.findUnique({where:{id:userId},select:{plan:true}})
  if (!user) throw new CompanionError(401,'unauthorized')
  const allowsTwinMode = user.plan === 'pro'
  const models: NovoChatModel[] = []
  if (process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY) {
    models.push({id:'auto',label:'Automático · Novo',allowsTwinMode})
  }
  if (process.env.GROQ_API_KEY) {
    models.push({id:'openai/gpt-oss-120b',label:'GPT-OSS 120B',allowsTwinMode},
      {id:'openai/gpt-oss-20b',label:'GPT-OSS 20B · rápido',allowsTwinMode})
  }
  if (process.env.GEMINI_API_KEY) models.push({id:'gemini-flash-latest',label:'Gemini Flash',allowsTwinMode})
  return models
}

export async function assertNovoChatModelAllowed(userId:string,model:string,twinMode:boolean):Promise<void> {
  const models = await getNovoChatModels(userId)
  if (!models.length) throw new CompanionError(503,'provider_not_configured')
  const selected = models.find(item=>item.id===model)
  if (!selected) throw new CompanionError(403,'model_unavailable')
  if (twinMode && !selected.allowsTwinMode) throw new CompanionError(403,'twin_mode_unavailable')
}
