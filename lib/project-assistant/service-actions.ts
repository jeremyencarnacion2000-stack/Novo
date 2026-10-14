import type {Prisma} from '@prisma/client'
import {z} from 'zod'
import {ProjectAssistantError,safeAssistantText} from './contracts'

const dueDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const parsed=new Date(`${value}T00:00:00Z`);return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value})
export const internalWorkOperationSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('task.create'),title:safeAssistantText(120),category:z.enum(['Training','Study','Personal','Work']),priority:z.enum(['low','medium','high']),dueDate:dueDate.optional()}).strict(),
  z.object({kind:z.literal('note.create'),content:safeAssistantText(1200),tags:z.array(safeAssistantText(32)).max(8).default([]),noteType:z.enum(['note','idea','task','reminder']).default('note')}).strict(),
  z.object({kind:z.literal('calendar.create'),title:safeAssistantText(120),description:safeAssistantText(480).optional(),start:z.string().datetime({offset:true}),end:z.string().datetime({offset:true}),allDay:z.boolean().default(false)}).strict(),
]).superRefine((value,ctx)=>{if(value.kind==='calendar.create'&&Date.parse(value.end)<=Date.parse(value.start))ctx.addIssue({code:z.ZodIssueCode.custom,path:['end'],message:'invalid_event_range'})})
export type InternalWorkOperation=z.infer<typeof internalWorkOperationSchema>

/** Executes only typed, confirmed mutations inside the caller's idempotent transaction. */
export async function executeApprovedServiceAction(tx:Prisma.TransactionClient,userId:string,input:unknown){
  const parsed=internalWorkOperationSchema.safeParse(input)
  if(!parsed.success)throw new ProjectAssistantError(400,'invalid_service_action')
  const operation=parsed.data
  if(operation.kind==='task.create'){
    const row=await tx.task.create({data:{title:operation.title,status:'todo',priority:operation.priority,dueDate:operation.dueDate,tags:JSON.stringify([operation.category]),userId},select:{id:true}})
    return {kind:'task',resourceId:row.id}
  }
  if(operation.kind==='note.create'){
    const row=await tx.quickNote.create({data:{content:operation.content,type:operation.noteType,tags:operation.tags,userId},select:{id:true}})
    return {kind:'note',resourceId:row.id}
  }
  const row=await tx.calendarEvent.create({data:{title:operation.title,description:operation.description,start:new Date(operation.start),end:new Date(operation.end),allDay:operation.allDay,source:'novo',userId},select:{id:true}})
  return {kind:'calendar_event',resourceId:row.id}
}
