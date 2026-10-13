import {z} from 'zod'

const privateText=/(?:https?:\/\/|\bwww\.|(?:^|\s)[a-z]:[\\/]|\\\\|\/(?:users|home|private|etc)\/|\b(?:api[_ -]?key|access[_ -]?token|password|secret|bearer|token)\s*[:=]|[\u0000-\u001f\u007f])/i
export const safeAssistantText=(max:number)=>z.string().trim().min(1).max(max).refine(value=>!privateText.test(value),'unsafe_text')
export const assistantId=z.string().min(1).max(128).regex(/^[a-z0-9_.:-]+$/i)
export const assistantRepository=z.string().max(201).regex(/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i).transform(value=>value.toLowerCase())
const count=z.number().int().min(0).max(1_000_000)
const date=z.string().datetime({offset:true})
const common={sourceKey:assistantId,title:safeAssistantText(120),repository:assistantRepository.optional(),vercelProjectId:assistantId.optional(),observedAt:date}
const task=z.object({id:assistantId,title:safeAssistantText(160),status:z.enum(['todo','in-progress','done']),priority:z.enum(['low','medium','high']),dueDate:z.string().max(40).refine(value=>Number.isFinite(Date.parse(value))).nullable().optional()}).strict()

export const projectObservationSchema=z.discriminatedUnion('kind',[
  z.object({...common,kind:z.literal('novo'),facts:z.object({status:z.enum(['not-started','in-progress','completed']),progress:z.number().min(0).max(100),priority:z.enum(['low','medium','high']),tasks:z.array(task).max(100),version:z.number().int().positive().optional()}).strict()}).strict(),
  z.object({...common,kind:z.literal('github'),sourceKey:assistantRepository,facts:z.object({openPullRequests:count,requestedReviewers:count.optional(),latestReviewState:z.enum(['approved','changes_requested','commented','pending','none']).optional(),ci:z.object({passed:count,failed:count,pending:count}).strict(),commit:z.string().regex(/^[a-f0-9]{40,64}$/i).optional(),failedCheckIds:z.array(assistantId).max(100).optional()}).strict()}).strict(),
  z.object({...common,kind:z.literal('vercel'),facts:z.object({deploymentId:assistantId,state:z.enum(['READY','ERROR','BUILDING','QUEUED','CANCELED','UNKNOWN']),createdAt:date}).strict()}).strict(),
  z.object({...common,kind:z.literal('folder'),sourceKey:z.string().uuid(),facts:z.object({workspaceId:z.string().uuid(),branch:z.string().max(200).regex(/^[a-z0-9_.\/-]+$/i).optional(),commit:z.string().regex(/^[a-f0-9]{40,64}$/i).optional(),dirtyFiles:count.optional()}).strict()}).strict(),
  z.object({...common,kind:z.literal('agent'),facts:z.object({workspaceId:z.string().uuid(),agent:z.enum(['codex','claude','cursor','gemini','copilot','muse','opencode','amp','hermes','antigravity']),sessionId:assistantId,state:z.enum(['running','waiting','completed','failed','idle'])}).strict()}).strict(),
]).superRefine((value,ctx)=>{
  if(value.kind==='folder'&&value.sourceKey!==value.facts.workspaceId)ctx.addIssue({code:z.ZodIssueCode.custom,message:'workspace_mismatch',path:['sourceKey']})
  if(value.kind==='github'&&value.repository&&value.sourceKey!==value.repository)ctx.addIssue({code:z.ZodIssueCode.custom,message:'repository_mismatch',path:['repository']})
  if(value.kind==='vercel'&&value.vercelProjectId&&value.sourceKey!==value.vercelProjectId)ctx.addIssue({code:z.ZodIssueCode.custom,message:'project_mismatch',path:['vercelProjectId']})
})
export type ProjectObservation=z.infer<typeof projectObservationSchema>
export type ProjectSourceKind=ProjectObservation['kind']
export const projectObservationsSchema=z.object({observations:z.array(projectObservationSchema).max(100),replaceInventory:z.boolean().optional()}).strict()
export const projectMemoryPatchSchema=z.object({revision:z.number().int().positive(),trackingMode:z.enum(['auto','on','off']).optional(),correction:safeAssistantText(480).nullable().optional()}).strict()
export type ProjectMemoryPatch=z.infer<typeof projectMemoryPatchSchema>
export type ProjectAssistantAccess={personal:boolean;projects?:boolean;integrations:boolean;development?:boolean;currentWorkContext?:boolean}
export type AssistantMemoryView={
  id:string;title:string;linkedProjectId:string|null;trackingMode:'auto'|'on'|'off';tracked:boolean;revision:number;correction:string|null;
  sources:Array<{kind:ProjectSourceKind;sourceKey:string;observedAt:string;fresh:boolean;available:boolean;repository?:string;vercelProjectId?:string;deviceId?:string}>;
  taskCount:number;blockerCount:number;nextStep:string;updatedAt:string
}
export const PROJECT_ASSISTANT_FRESH_MS=15*60*1000

export function parseProjectSourceObservation(source:{kind:string;sourceKey:string;title:string;repository?:string|null;vercelProjectId?:string|null;deviceId?:string|null;observedAt:Date;facts:unknown}):ProjectObservation|null {
  if(!Number.isFinite(source.observedAt.getTime()))return null
  const sourceKey=source.kind==='folder'?source.sourceKey.split(':').pop():source.kind==='agent'&&source.deviceId?source.sourceKey.slice(source.deviceId.length+1):source.sourceKey
  const result=projectObservationSchema.safeParse({kind:source.kind,sourceKey,title:source.title,repository:source.repository??undefined,vercelProjectId:source.vercelProjectId??undefined,observedAt:source.observedAt.toISOString(),facts:source.facts})
  return result.success?result.data:null
}

export class ProjectAssistantError extends Error {
  constructor(public readonly status:400|401|403|404|409|413|503,public readonly code:string){super(code);this.name='ProjectAssistantError'}
}
