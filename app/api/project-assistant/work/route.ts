import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import {ProjectAssistantError,assistantId,safeAssistantText} from '@/lib/project-assistant/contracts'
import {requireProjectAssistantSession,projectAssistantJson,projectAssistantErrorResponse,readProjectAssistantJson} from '@/lib/project-assistant/http'
import {enqueueProjectWork} from '@/lib/project-assistant/jobs'
import {projectWorkView} from '@/lib/project-assistant/device-work'
import {workCapabilitySchema} from '@/lib/project-assistant/work-contracts'
export const dynamic='force-dynamic'
export async function GET(request:Request){
  try{
    const userId=await requireProjectAssistantSession(),memoryId=new URL(request.url).searchParams.get('memoryId')??undefined
    if(memoryId&&!assistantId.safeParse(memoryId).success)throw new ProjectAssistantError(400,'invalid_memory')
    const [work,delegations,devices,workspaces]=await Promise.all([
      prisma.projectWork.findMany({where:{userId,...(memoryId?{memoryId}:{})},orderBy:{updatedAt:'desc'},take:50}),
      prisma.projectDelegation.findMany({where:{userId,...(memoryId?{memoryId}:{})},orderBy:{updatedAt:'desc'},take:100}),
      prisma.companionDevice.findMany({where:{userId,revokedAt:null},select:{deviceId:true,name:true,workCapabilities:true,workLastSeenAt:true,scopes:true},take:100}),
      prisma.projectAssistantSource.findMany({where:{userId,kind:'folder',availability:'available',...(memoryId?{memoryId}:{})},select:{memoryId:true,sourceKey:true,title:true,deviceId:true,repository:true,facts:true},take:100}),
    ])
    return projectAssistantJson({work:work.map(projectWorkView),delegations:delegations.map(row=>({id:row.id,memoryId:row.memoryId,deviceId:row.deviceId,workspaceId:row.workspaceId,enabled:row.enabled,version:row.version,capabilities:row.capabilities,triggers:row.triggers,dailyLimit:row.dailyLimit,timezone:row.timezone,verification:row.verification,timeoutSeconds:row.timeoutSeconds})),devices:devices.map(row=>({id:row.deviceId,name:row.name,capabilities:row.workCapabilities,lastSeenAt:row.workLastSeenAt?.toISOString()??null,canExecute:row.scopes.includes('device:work:execute')})),workspaces:workspaces.flatMap(row=>{const workspaceId=row.sourceKey.split(':').pop();return workspaceId&&z.string().uuid().safeParse(workspaceId).success?[{id:workspaceId,memoryId:row.memoryId,name:row.title,deviceId:row.deviceId,repository:row.repository}]:[]})})
  }catch(error){return projectAssistantErrorResponse(error)}
}
const requestSchema=z.object({memoryId:assistantId,capability:workCapabilitySchema,objective:safeAssistantText(480),requestId:z.string().uuid()}).strict()
export async function POST(request:Request){
  try{const userId=await requireProjectAssistantSession();const parsed=requestSchema.safeParse(await readProjectAssistantJson(request));if(!parsed.success)throw new ProjectAssistantError(400,'invalid_work_request');return projectAssistantJson({work:projectWorkView(await enqueueProjectWork(userId,{...parsed.data,mode:'manual'}))})}catch(error){return projectAssistantErrorResponse(error)}
}
