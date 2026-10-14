import {z} from 'zod'
import {requireCompanionOAuth} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'
import {companionJson,readCompanionJson,companionErrorResponse} from '@/lib/companion/http'
import {ProjectAssistantError,assistantId} from '@/lib/project-assistant/contracts'
import {requireWorkStep,reportDeviceWork,reconcileDeviceWork} from '@/lib/project-assistant/device-work'
import {workReportSchema,workReceiptSchema} from '@/lib/project-assistant/work-contracts'
export const dynamic='force-dynamic'
const input=z.discriminatedUnion('action',[
  z.object({action:z.literal('step'),leaseToken:z.string().uuid()}).strict(),
  z.object({action:z.literal('report'),report:workReportSchema}).strict(),
  z.object({action:z.literal('reconcile'),receipt:workReceiptSchema}).strict(),
])
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const actor=await requireCompanionOAuth(request,['device:connect','device:work:read','device:work:execute'])
    const deviceId=request.headers.get('X-Novo-Device-Id');await requireActiveCompanionDevice(actor,deviceId)
    if(!deviceId)throw new ProjectAssistantError(400,'device_id_required')
    const {id}=await params
    if(!assistantId.safeParse(id).success)throw new ProjectAssistantError(400,'invalid_work')
    const parsed=input.safeParse(await readCompanionJson(request))
    if(!parsed.success)throw new ProjectAssistantError(400,'invalid_work_request')
    const boundActor={...actor,deviceId}
    return companionJson(parsed.data.action==='step'?await requireWorkStep(boundActor,id,parsed.data.leaseToken):{work:parsed.data.action==='report'?await reportDeviceWork(boundActor,id,parsed.data.report):await reconcileDeviceWork(boundActor,id,parsed.data.receipt)})
  }catch(error){return error instanceof ProjectAssistantError?companionJson({error:error.code},error.status):companionErrorResponse(error)}
}
