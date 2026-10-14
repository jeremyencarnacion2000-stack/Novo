import {after} from 'next/server'
import {assistantId,ProjectAssistantError} from '@/lib/project-assistant/contracts'
import {requireProjectAssistantSession,projectAssistantJson,projectAssistantErrorResponse,readProjectAssistantJson} from '@/lib/project-assistant/http'
import {projectWorkView} from '@/lib/project-assistant/device-work'
import {decideProjectWorkAction,prepareProjectWorkAction} from '@/lib/project-assistant/work-decisions'
import {refreshProjectAssistantForUser} from '@/lib/project-assistant/refresh'

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
    const decision=work.decision&&typeof work.decision==='object'&&!Array.isArray(work.decision)?work.decision as Record<string,unknown>:null
    const operation=decision?.operation&&typeof decision.operation==='object'&&!Array.isArray(decision.operation)?decision.operation as Record<string,unknown>:null
    if(decision?.state==='applied'&&(operation?.kind==='github.issue.create'||operation?.kind==='vercel.deployment.redeploy')){
      after(()=>refreshProjectAssistantForUser(userId,{minIntervalMs:0}).catch(()=>undefined))
    }
    return projectAssistantJson({work:projectWorkView(work)})
  }catch(error){return projectAssistantErrorResponse(error)}
}
