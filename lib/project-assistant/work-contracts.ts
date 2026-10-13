import {z} from 'zod'
import {assistantId,assistantRepository,safeAssistantText} from './contracts'

export const workCapabilitySchema=z.enum(['project.diagnose','codex.prepare_fix','claude.prepare_fix'])
export const workPhaseSchema=z.enum(['pending','running','awaiting_confirmation','waiting_device','completed','failed','cancelled','uncertain'])
export const workTriggerSchema=z.enum(['ci_failure','deployment_failure','task_blocker'])
export const verificationSchema=z.object({kind:z.literal('npm_script'),script:z.string().max(80).regex(/^[a-z0-9_.:-]+$/i)}).strict()
export const delegationInputSchema=z.object({memoryId:assistantId,deviceId:z.string().uuid(),workspaceId:z.string().uuid(),capabilities:z.array(workCapabilitySchema).min(1).max(3),enabled:z.boolean(),version:z.number().int().min(0).default(0),dailyLimit:z.number().int().min(1).max(10).default(3),triggers:z.array(workTriggerSchema).max(3).default([]),timezone:z.string().max(80).refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true}catch{return false}}).default('UTC'),verification:z.array(verificationSchema).max(4).default([]),timeoutSeconds:z.number().int().min(60).max(900).default(600)}).strict().superRefine((value,ctx)=>{if(value.capabilities.some(cap=>cap.endsWith('prepare_fix'))&&!value.verification.length)ctx.addIssue({code:z.ZodIssueCode.custom,path:['verification'],message:'verification_required'})})
export type DelegationInput=z.infer<typeof delegationInputSchema>
export const frozenWorkScopeSchema=z.object({memoryId:assistantId,deviceId:z.string().uuid(),workspaceId:z.string().uuid(),repository:assistantRepository.optional(),verification:z.array(verificationSchema).max(4),timeoutSeconds:z.number().int().min(60).max(900)}).strict()
export type FrozenWorkScope=z.infer<typeof frozenWorkScopeSchema>
export const automaticTriggerEvidenceSchema=z.object({kind:workTriggerSchema,sourceKey:z.string().min(1).max(256).regex(/^[a-z0-9_.:/-]+$/i),evidenceKey:assistantId,observedAt:z.string().datetime({offset:true})}).strict()
export const enqueueWorkSchema=z.object({memoryId:assistantId,capability:workCapabilitySchema,objective:safeAssistantText(480),mode:z.enum(['manual','automatic']),requestId:z.string().uuid().optional(),trigger:automaticTriggerEvidenceSchema.optional()}).strict().superRefine((input,ctx)=>{if(input.mode==='manual'&&(!input.requestId||input.trigger)||input.mode==='automatic'&&(!input.trigger||input.requestId))ctx.addIssue({code:z.ZodIssueCode.custom,message:'request_identity_required'})})
export type EnqueueWorkInput=z.infer<typeof enqueueWorkSchema>
export type ProjectWorkPhase=z.infer<typeof workPhaseSchema>
export const ACTIVE_WORK_PHASES=['pending','running','awaiting_confirmation','waiting_device','uncertain']
export const TERMINAL_WORK_PHASES=['completed','failed','cancelled']

/** UTC boundaries for the owner's calendar day, including DST offset changes. */
export function ownerDayStart(now:Date,timezone:string):Date{
  const parts=(date:Date)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(part=>[part.type,part.value]))
  const local=parts(now),midnight=Date.UTC(Number(local.year),Number(local.month)-1,Number(local.day))
  let guess=midnight
  for(let attempt=0;attempt<3;attempt++){const value=parts(new Date(guess));const localTime=Date.UTC(Number(value.year),Number(value.month)-1,Number(value.day),Number(value.hour),Number(value.minute),Number(value.second));guess=midnight-(localTime-guess)}
  return new Date(guess)
}
