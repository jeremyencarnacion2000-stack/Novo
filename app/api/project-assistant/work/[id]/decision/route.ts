import {assistantId,ProjectAssistantError} from '@/lib/project-assistant/contracts'
import {requireProjectAssistantSession,projectAssistantJson,projectAssistantErrorResponse,readProjectAssistantJson} from '@/lib/project-assistant/http'
import {projectWorkView} from '@/lib/project-assistant/device-work'
import {decideProjectWorkAction,prepareProjectWorkAction} from '@/lib/project-assistant/work-decisions'

export const dynamic='force-dynamic'
type Context={params:Promise<{id:string}>}

export async function POST(request:Request,{params}:Context){
  try{
    const userId=await requireProjectAssistantSession(),{id}=await params
    if(!assistantId.safeParse(id).success)throw new ProjectAssistantError(400,'invalid_work')
    const work=await prepareProjectWorkAction(userId,id,await readProjectAssistantJson(request))
    return projectAssistantJson({work:projectWorkView(work)})
  }catch(error){return projectAssistantErrorResponse(error)}
}

export async function PATCH(request:Request,{params}:Context){
  try{
    const userId=await requireProjectAssistantSession(),{id}=await params
    if(!assistantId.safeParse(id).success)throw new ProjectAssistantError(400,'invalid_work')
    const work=await decideProjectWorkAction(userId,id,await readProjectAssistantJson(request))
    return projectAssistantJson({work:projectWorkView(work)})
  }catch(error){return projectAssistantErrorResponse(error)}
}
