jest.mock('@/lib/prisma',()=>({prisma:{userSettings:{},novoSignalLedger:{deleteMany:jest.fn()},twinEvolutionLog:{deleteMany:jest.fn()},projectAssistantMemory:{},projectAssistantSource:{},project:{},novoSignalSourcePreference:{},companionDevice:{},$transaction:undefined}}))
import {prisma} from '@/lib/prisma'
import {recordProjectObservations,readProjectAssistantMemories,updateProjectAssistantMemory,clearProjectAssistantMemory,linkProjectAssistantMemories} from '../memory'

const db=prisma as any
let memories:any[],sources:any[],serial:Promise<unknown>
const at='2026-10-12T18:00:00.000Z'
const observation={kind:'github' as const,sourceKey:'owner/novo',title:'Repositorio',repository:'owner/novo',observedAt:at,facts:{openPullRequests:2,ci:{passed:3,failed:1,pending:0}}}
const access={personal:true,projects:true,integrations:true,currentWorkContext:true}
const matches=(row:any,where:any):boolean=>Object.entries(where??{}).every(([key,value]:any)=>{
  if(key==='userId_kind_sourceKey')return matches(row,value)
  if(key==='id'||key==='userId'||key==='memoryId'||key==='revision'||key==='clearedAt'||key==='kind'||key==='sourceKey')return row[key]===value
  if(key==='deviceId'&&value?.in)return value.in.includes(row.deviceId)
  return true
})
const apply=(row:any,data:any)=>{for(const [key,value] of Object.entries(data) as any)row[key]=value?.increment?row[key]+value.increment:value;return row}

beforeEach(()=>{
  memories=[];sources=[];serial=Promise.resolve()
  db.$executeRaw=jest.fn()
  db.$transaction=jest.fn((work:any)=>{const next=serial.then(()=>work(db));serial=next.catch(()=>{});return next})
  db.projectAssistantMemory.findMany=jest.fn(async({where}:any)=>memories.filter(row=>matches(row,where)).map(row=>({...row,sources:sources.filter(source=>source.memoryId===row.id)})))
  db.projectAssistantMemory.findFirst=jest.fn(async({where}:any)=>memories.find(row=>matches(row,where))??null)
  db.projectAssistantMemory.create=jest.fn(async({data}:any)=>{const row={id:`m${memories.length+1}`,projectId:null,trackingMode:'auto',correction:null,revision:1,clearedAt:null,createdAt:new Date(at),updatedAt:new Date(at),...data};memories.push(row);return row})
  db.projectAssistantMemory.updateMany=jest.fn(async({where,data}:any)=>{const rows=memories.filter(row=>matches(row,where));rows.forEach(row=>apply(row,data));return {count:rows.length}})
  db.projectAssistantSource.upsert=jest.fn(async({where,create,update}:any)=>{const row=sources.find(row=>matches(row,where));if(row)return apply(row,update);const made={id:`s${sources.length+1}`,availability:'available',...create};sources.push(made);return made})
  db.projectAssistantSource.updateMany=jest.fn(async({where,data}:any)=>{const rows=sources.filter(row=>matches(row,where));rows.forEach(row=>apply(row,data));return {count:rows.length}})
  db.novoSignalSourcePreference.findMany=jest.fn(async()=>[])
  db.companionDevice.findMany=jest.fn(async()=>[])
  db.project.findFirst=jest.fn(async()=>null)
  db.userSettings.findUnique=jest.fn(async()=>null)
})

test('project identity persists across requests and duplicate delivery',async()=>{
  await recordProjectObservations('owner',[observation],{now:new Date(at)})
  await recordProjectObservations('owner',[observation],{now:new Date(at)})
  const result=await readProjectAssistantMemories('owner',{access,now:new Date(at)})
  expect(result).toHaveLength(1);expect(result[0].blockerCount).toBe(1)
  expect(memories).toHaveLength(1);expect(sources).toHaveLength(1)
  expect(await readProjectAssistantMemories('other',{access,now:new Date(at)})).toEqual([])
})

test('manual correction survives worker updates and older evidence cannot win',async()=>{
  await recordProjectObservations('owner',[observation],{now:new Date(at)})
  await updateProjectAssistantMemory('owner','m1',{revision:1,correction:'Es el proyecto de mi curso',trackingMode:'on'})
  await recordProjectObservations('owner',[{...observation,observedAt:'2026-10-12T18:01:00.000Z',facts:{...observation.facts,openPullRequests:3}}],{now:new Date('2026-10-12T18:02:00Z')})
  await recordProjectObservations('owner',[observation],{now:new Date('2026-10-12T18:02:00Z')})
  expect(memories[0].correction).toBe('Es el proyecto de mi curso')
  expect(sources[0].facts.openPullRequests).toBe(3)
  await expect(updateProjectAssistantMemory('owner','m1',{revision:1,correction:'Sobrescribir'})).rejects.toMatchObject({code:'revision_conflict'})
})

test('forgetting keeps a tombstone and cannot be undone by queued observations',async()=>{
  await recordProjectObservations('owner',[observation],{now:new Date(at)})
  await clearProjectAssistantMemory('owner','m1',1)
  await recordProjectObservations('owner',[{...observation,observedAt:'2026-10-12T18:02:00Z'}],{now:new Date('2026-10-12T18:03:00Z')})
  expect(await readProjectAssistantMemories('owner',{access})).toEqual([])
  expect(memories).toHaveLength(1)
  expect(db.novoSignalLedger.deleteMany).toHaveBeenCalledWith({where:{userId:'owner',source:'project_assistant',sourceRef:'m1'}})
  await expect(updateProjectAssistantMemory('other','m1',{revision:2,trackingMode:'on'})).rejects.toMatchObject({code:'memory_not_found'})
})
test('pausing prevents new facts and excluding projects removes private project context',async()=>{
  db.userSettings.findUnique.mockResolvedValue({settings:{ambientTwinPaused:true}})
  expect(await recordProjectObservations('owner',[observation],{now:new Date(at)})).toMatchObject({changed:0,paused:true})
  expect(memories).toHaveLength(0)
  db.userSettings.findUnique.mockResolvedValue(null)
  db.project.findFirst.mockResolvedValue({id:'p1'})
  await recordProjectObservations('owner',[{kind:'novo',sourceKey:'p1',title:'Private',observedAt:at,facts:{status:'in-progress',priority:'high',progress:2,tasks:[]}}],{now:new Date(at)})
  db.novoSignalSourcePreference.findMany.mockResolvedValue([{source:'projects'}])
  expect(await readProjectAssistantMemories('owner',{access})).toEqual([])
})

test('scope filtering excludes source facts, labels and user corrections',async()=>{
  await recordProjectObservations('owner',[observation],{now:new Date(at)})
  memories[0].title='Private Novo label';memories[0].correction='Private user correction'
  const narrow=await readProjectAssistantMemories('owner',{access:{personal:false,integrations:true},now:new Date(at)})
  expect(narrow[0].title).toBe('Repositorio');expect(narrow[0].correction).toBeNull();expect(narrow[0].linkedProjectId).toBeNull()
  db.novoSignalSourcePreference.findMany.mockResolvedValue([{source:'github'}])
  expect(await readProjectAssistantMemories('owner',{access})).toEqual([])
})

test('local observations need a bound device and revoked devices are not usable',async()=>{
  const workspace='bcf7c70d-6d39-4bb9-86d2-9e75509c1b69'
  const local={kind:'folder' as const,sourceKey:workspace,title:'Carpeta elegida',repository:'owner/novo',observedAt:at,facts:{workspaceId:workspace,dirtyFiles:1}}
  await expect(recordProjectObservations('owner',[local],{now:new Date(at)})).rejects.toMatchObject({code:'device_required'})
  await recordProjectObservations('owner',[local],{deviceId:workspace,now:new Date(at)})
  expect(await readProjectAssistantMemories('owner',{access,now:new Date(at)})).toEqual([])
  db.companionDevice.findMany.mockResolvedValue([{deviceId:workspace}])
  expect((await readProjectAssistantMemories('owner',{access,now:new Date(at)}))[0].sources[0].deviceId).toBe(workspace)
})
test('explicit owned linking merges source identities, checks both revisions and preserves the chosen correction',async()=>{
  await recordProjectObservations('owner',[observation],{now:new Date(at)})
  await recordProjectObservations('owner',[{...observation,sourceKey:'owner/another',repository:'owner/another',title:'Local project'}],{now:new Date(at)})
  memories[0].correction='Mantener esta corrección'
  await expect(linkProjectAssistantMemories('other','m1',{revision:1,targetId:'m2',targetRevision:1})).rejects.toMatchObject({code:'memory_not_found'})
  await expect(linkProjectAssistantMemories('owner','m1',{revision:3,targetId:'m2',targetRevision:1})).rejects.toMatchObject({code:'revision_conflict'})
  await linkProjectAssistantMemories('owner','m2',{revision:1,targetId:'m1',targetRevision:1})
  expect(memories[0].correction).toBe('Mantener esta corrección')
  expect(memories[0].manualIdentity).toBe(true)
  expect(sources.every(source=>source.memoryId==='m1')).toBe(true)
  await recordProjectObservations('owner',[{...observation,sourceKey:'owner/another',repository:'owner/another',title:'Local project',observedAt:'2026-10-12T18:03:00Z'}],{now:new Date('2026-10-12T18:04:00Z')})
  expect(memories).toHaveLength(2)
  expect((await readProjectAssistantMemories('owner',{access}))).toHaveLength(1)
})
