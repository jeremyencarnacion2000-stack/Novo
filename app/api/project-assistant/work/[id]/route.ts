import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import {assistantId,ProjectAssistantError} from '@/lib/project-assistant/contracts'
import {requireProjectAssistantSession,projectAssistantJson,projectAssistantErrorResponse,readProjectAssistantJson} from '@/lib/project-assistant/http'
import {projectWorkView} from '@/lib/project-assistant/device-work'
import {cancelProjectWork} from '@/lib/project-assistant/jobs'
type Context={params:Promise<{id:string}>}
export async function GET(_request:Request,{params}:Context){
  try{const userId=await requireProjectAssistantSession(),{id}=await params;if(!assistantId.safeParse(id).success)throw new ProjectAssistantError(400,'invalid_work');const work=await prisma.projectWork.findFirst({where:{id,userId}});if(!work)throw new ProjectAssistantError(404,'work_not_found');return projectAssistantJson({work:projectWorkView(work)})}catch(error){return projectAssistantErrorResponse(error)}
}
export async function DELETE(request:Request,{params}:Context){
  try{const userId=await requireProjectAssistantSession(),{id}=await params;if(!assistantId.safeParse(id).success)throw new ProjectAssistantError(400,'invalid_work');const parsed=z.object({revision:z.number().int().positive()}).strict().safeParse(await readProjectAssistantJson(request));if(!parsed.success)throw new ProjectAssistantError(400,'invalid_work_request');await cancelProjectWork(userId,id,parsed.data.revision);return projectAssistantJson({cancelled:true})}catch(error){return projectAssistantErrorResponse(error)}
}
