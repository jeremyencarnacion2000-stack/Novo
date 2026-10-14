/** @jest-environment node */
jest.mock('@/lib/prisma',()=>({prisma:{project:{findMany:jest.fn()},novoSignalLedger:{findUnique:jest.fn(),create:jest.fn()},twinEvolutionLog:{create:jest.fn()},$executeRaw:jest.fn(),$transaction:jest.fn()}}))
jest.mock('../memory',()=>({recordProjectObservations:jest.fn(),readProjectAssistantRecords:jest.fn(),toAssistantMemoryView:jest.fn(()=>({tracked:true,blockerCount:1,taskCount:2}))}))
jest.mock('@/lib/cognitive/get-or-create-twin',()=>({getOrCreateTwin:jest.fn(async()=>({id:'twin'}))}))
import {prisma} from '@/lib/prisma'
import {recordProjectObservations,readProjectAssistantRecords} from '../memory'
import {reconcileNovoProjectMemories} from '../reconcile'
const db=prisma as any
beforeEach(()=>{
  jest.clearAllMocks(); db.$transaction.mockImplementation((work:any)=>work(db))
  db.project.findMany.mockResolvedValue([{id:'p1',title:'Novo',priority:'high',status:'in-progress',progress:10,tasks:[]}])
  ;(recordProjectObservations as jest.Mock).mockResolvedValue({changed:1,conflicts:0})
  ;(readProjectAssistantRecords as jest.Mock).mockResolvedValue([{id:'m1',title:'Novo',correction:null,trackingMode:'on',sources:[{kind:'github',sourceKey:'owner/novo',availability:'available',facts:{ci:{failed:1}}}]}])
  db.novoSignalLedger.findUnique.mockResolvedValue(null)
})
test('reconciles owned tasks and records deterministic project evolution without editing user fields',async()=>{
  expect(await reconcileNovoProjectMemories('owner')).toMatchObject({changed:1,tracked:1})
  expect(db.project.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{userId:'owner'},select:expect.objectContaining({tasks:expect.objectContaining({where:{userId:'owner'}})})}))
  expect(db.novoSignalLedger.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({userId:'owner',source:'project_assistant',sourceRef:'m1'})}))
  expect(db.twinEvolutionLog.create).toHaveBeenCalledTimes(1)
})
test('unchanged observations have the same fingerprint and do not duplicate evolution',async()=>{
  await reconcileNovoProjectMemories('owner')
  const first=db.novoSignalLedger.create.mock.calls[0][0].data.fingerprint
  db.novoSignalLedger.findUnique.mockResolvedValue({id:'existing'})
  await reconcileNovoProjectMemories('owner')
  expect(db.novoSignalLedger.findUnique.mock.calls[1][0].where.userId_fingerprint.fingerprint).toBe(first)
  expect(db.twinEvolutionLog.create).toHaveBeenCalledTimes(1)
})
test('pause prevents project evolution as well as ingestion',async()=>{
  ;(recordProjectObservations as jest.Mock).mockResolvedValue({changed:0,paused:true})
  expect(await reconcileNovoProjectMemories('owner')).toMatchObject({changed:0,tracked:0})
  expect(db.twinEvolutionLog.create).not.toHaveBeenCalled()
})
