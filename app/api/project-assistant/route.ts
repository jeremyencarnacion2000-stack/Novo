import {readProjectAssistantMemories} from '@/lib/project-assistant/memory'
import {projectAssistantJson,projectAssistantErrorResponse,requireProjectAssistantSession} from '@/lib/project-assistant/http'
import {ProjectAssistantError} from '@/lib/project-assistant/contracts'

export const dynamic='force-dynamic'
export async function GET(request:Request) {
  try{
    const userId=await requireProjectAssistantSession()
    const query=new URL(request.url).searchParams.get('query')??undefined
    if(query&&query.length>500)throw new ProjectAssistantError(400,'invalid_query')
    const memories=await readProjectAssistantMemories(userId,{query,access:{personal:true,projects:true,integrations:true,development:true,currentWorkContext:true}})
    return projectAssistantJson({memories})
  }catch(error){return projectAssistantErrorResponse(error)}
}
