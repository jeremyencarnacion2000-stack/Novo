import {z} from 'zod'
import {updateProjectAssistantMemory,clearProjectAssistantMemory} from '@/lib/project-assistant/memory'
import {assistantId,projectMemoryPatchSchema,ProjectAssistantError} from '@/lib/project-assistant/contracts'
import {projectAssistantJson,projectAssistantErrorResponse,requireProjectAssistantSession,readProjectAssistantJson} from '@/lib/project-assistant/http'

type Context={params:Promise<{id:string}>}
export async function PUT(request:Request,context:Context) {
  try{
    const userId=await requireProjectAssistantSession(),{id}=await context.params
    if(!assistantId.safeParse(id).success)throw new ProjectAssistantError(400,'invalid_memory')
    const parsed=projectMemoryPatchSchema.safeParse(await readProjectAssistantJson(request))
    if(!parsed.success)throw new ProjectAssistantError(400,'invalid_memory_update')
    return projectAssistantJson({memory:await updateProjectAssistantMemory(userId,id,parsed.data)})
  }catch(error){return projectAssistantErrorResponse(error)}
}
export async function DELETE(request:Request,context:Context) {
  try{
    const userId=await requireProjectAssistantSession(),{id}=await context.params
    if(!assistantId.safeParse(id).success)throw new ProjectAssistantError(400,'invalid_memory')
    const parsed=z.object({revision:z.number().int().positive()}).strict().safeParse(await readProjectAssistantJson(request))
    if(!parsed.success)throw new ProjectAssistantError(400,'invalid_memory_update')
    await clearProjectAssistantMemory(userId,id,parsed.data.revision)
    return projectAssistantJson({cleared:true})
  }catch(error){return projectAssistantErrorResponse(error)}
}
