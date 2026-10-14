import {executeApprovedServiceAction} from '../service-actions'
const tx:any={task:{create:jest.fn(async()=>({id:'task-1'}))},quickNote:{create:jest.fn(async()=>({id:'note-1'}))},calendarEvent:{create:jest.fn(async()=>({id:'event-1'}))}}
beforeEach(()=>{jest.clearAllMocks()})

test('creates only an owned task with fixed Novo defaults',async()=>{
  await expect(executeApprovedServiceAction(tx,'owner',{kind:'task.create',title:'Revisar publicación',category:'Work',priority:'high'})).resolves.toEqual({kind:'task',resourceId:'task-1'})
  expect(tx.task.create).toHaveBeenCalledWith({data:{title:'Revisar publicación',status:'todo',priority:'high',dueDate:undefined,tags:'["Work"]',userId:'owner'},select:{id:true}})
  await expect(executeApprovedServiceAction(tx,'owner',{kind:'task.create',title:'Revisar publicación',category:'Work',priority:'high',dueDate:'2026-02-31'})).rejects.toMatchObject({code:'invalid_service_action'})
})

test('creates a private Novo note with allowlisted fields only',async()=>{
  await executeApprovedServiceAction(tx,'owner',{kind:'note.create',content:'Revisar el informe',tags:['trabajo'],noteType:'idea'})
  expect(tx.quickNote.create).toHaveBeenCalledWith({data:{content:'Revisar el informe',type:'idea',tags:['trabajo'],userId:'owner'},select:{id:true}})
})

test('creates an event only in the owned Novo calendar',async()=>{
  await executeApprovedServiceAction(tx,'owner',{kind:'calendar.create',title:'Revisión',start:'2026-10-15T10:00:00-04:00',end:'2026-10-15T11:00:00-04:00',allDay:false})
  expect(tx.calendarEvent.create).toHaveBeenCalledWith({data:{title:'Revisión',description:undefined,start:new Date('2026-10-15T10:00:00-04:00'),end:new Date('2026-10-15T11:00:00-04:00'),allDay:false,source:'novo',userId:'owner'},select:{id:true}})
})

test('rejects arbitrary mutation and invalid ranges without reaching any adapter',async()=>{
  await expect(executeApprovedServiceAction(tx,'owner',{kind:'task.delete',id:'anything'})).rejects.toMatchObject({code:'invalid_service_action'})
  await expect(executeApprovedServiceAction(tx,'owner',{kind:'calendar.create',title:'Evento',start:'2026-10-15T11:00:00Z',end:'2026-10-15T10:00:00Z'})).rejects.toMatchObject({code:'invalid_service_action'})
  expect(tx.task.create).not.toHaveBeenCalled();expect(tx.quickNote.create).not.toHaveBeenCalled();expect(tx.calendarEvent.create).not.toHaveBeenCalled()
})
