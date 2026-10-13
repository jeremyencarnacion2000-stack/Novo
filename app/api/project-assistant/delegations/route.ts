import {saveDelegation} from '@/lib/project-assistant/delegations'
import {requireProjectAssistantSession,projectAssistantJson,projectAssistantErrorResponse,readProjectAssistantJson} from '@/lib/project-assistant/http'
export async function POST(request:Request){
  try{const userId=await requireProjectAssistantSession();const rule=await saveDelegation(userId,await readProjectAssistantJson(request));return projectAssistantJson({delegation:{id:rule.id,memoryId:rule.memoryId,version:rule.version,enabled:rule.enabled}})}catch(error){return projectAssistantErrorResponse(error)}
}
