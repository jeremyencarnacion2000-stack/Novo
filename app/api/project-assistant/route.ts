import {readProjectAssistantMemories} from '@/lib/project-assistant/memory'
import {projectAssistantJson,projectAssistantErrorResponse,requireProjectAssistantSession} from '@/lib/project-assistant/http'
import {ProjectAssistantError} from '@/lib/project-assistant/contracts'
import {refreshProjectAssistantForUser} from '@/lib/project-assistant/refresh'
import {readProjectAssistantJson} from '@/lib/project-assistant/http'
import {z} from 'zod'

export const dynamic='force-dynamic'
export async function GET(request:Request) {
  try{
    const userId=await requireProjectAssistantSession()
    const query=new URL(request.url).searchParams.get('query')??undefined
    if(query&&query.length>500)throw new ProjectAssistantError(400,'invalid_query')
    const memories=await readProjectAssistantMemories(userId,{query,access:{personal:true,projects:true,integrations:true,development:true,currentWorkContext:true}})
    const background=['github-actions','inngest'].includes(process.env.PROJECT_ASSISTANT_SCHEDULER??'')?process.env.PROJECT_ASSISTANT_SCHEDULER:'unavailable'
    return projectAssistantJson({memories,refresh:{background,intervalMinutes:15}})
  }catch(error){return projectAssistantErrorResponse(error)}
}
export async function POST(request:Request){
  try{const userId=await requireProjectAssistantSession();if(!z.object({}).strict().safeParse(await readProjectAssistantJson(request)).success)throw new ProjectAssistantError(400,'invalid_request');return projectAssistantJson(await refreshProjectAssistantForUser(userId))}catch(error){return projectAssistantErrorResponse(error)}
}
