import {linkProjectAssistantMemories} from '@/lib/project-assistant/memory'
import {requireProjectAssistantSession,readProjectAssistantJson,projectAssistantJson,projectAssistantErrorResponse} from '@/lib/project-assistant/http'
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{const userId=await requireProjectAssistantSession();const {id}=await params;await linkProjectAssistantMemories(userId,id,await readProjectAssistantJson(request));return projectAssistantJson({linked:true})}catch(error){return projectAssistantErrorResponse(error)}
}
