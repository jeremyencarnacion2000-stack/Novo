/** @jest-environment node */
jest.mock('@/lib/prisma',()=>({prisma:{projectDelegation:{findMany:jest.fn()},userSettings:{findUnique:jest.fn()},novoSignalSourcePreference:{findMany:jest.fn()},projectWorkEvent:{deleteMany:jest.fn()}}}))
jest.mock('../memory',()=>({readProjectAssistantRecords:jest.fn(),toAssistantMemoryView:jest.fn(row=>({tracked:row.trackingMode==='on'}))}))
jest.mock('../jobs',()=>({enqueueProjectWork:jest.fn()}))
import {prisma} from '@/lib/prisma'
import {readProjectAssistantRecords} from '../memory'
import {enqueueProjectWork} from '../jobs'
import {dispatchDelegationTriggers,pruneOperationalWorkDetails} from '../work-triggers'
import {ownerDayStart} from '../work-contracts'
const db=prisma as any,now=new Date('2026-10-13T18:00:00Z')
beforeEach(()=>{
  jest.clearAllMocks();db.userSettings.findUnique.mockResolvedValue(null);db.novoSignalSourcePreference.findMany.mockResolvedValue([])
  db.projectDelegation.findMany.mockResolvedValue([{memoryId:'m1',capabilities:['project.diagnose'],triggers:['ci_failure']}]);db.projectWorkEvent.deleteMany.mockResolvedValue({count:2})
  ;(enqueueProjectWork as jest.Mock).mockResolvedValue({id:'j1'})
  ;(readProjectAssistantRecords as jest.Mock).mockResolvedValue([{id:'m1',trackingMode:'on',sources:[{kind:'github',sourceKey:'owner/novo',title:'Novo',repository:'owner/novo',observedAt:now,availability:'available',facts:{openPullRequests:0,ci:{passed:0,failed:1,pending:0},commit:'a'.repeat(40),failedCheckIds:['42']}}]}])
})
test('only tracked fresh deterministic failures feed explicitly enabled owned rules',async()=>{
  await dispatchDelegationTriggers('owner',now)
  expect(db.projectDelegation.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{userId:'owner',enabled:true}}))
  expect(enqueueProjectWork).toHaveBeenCalledWith('owner',expect.objectContaining({memoryId:'m1',mode:'automatic',capability:'project.diagnose',trigger:expect.objectContaining({kind:'ci_failure'})}),now)
})
test('paused/excluded and stale or untracked evidence do not execute work',async()=>{
  db.userSettings.findUnique.mockResolvedValue({settings:{ambientTwinPaused:true}});await dispatchDelegationTriggers('owner',now);expect(enqueueProjectWork).not.toHaveBeenCalled()
  db.userSettings.findUnique.mockResolvedValue(null);db.novoSignalSourcePreference.findMany.mockResolvedValue([{source:'github'}]);await dispatchDelegationTriggers('owner',now);expect(enqueueProjectWork).not.toHaveBeenCalled()
  db.novoSignalSourcePreference.findMany.mockResolvedValue([])
  const records=await readProjectAssistantRecords('owner',{personal:true,integrations:true,currentWorkContext:true});records[0].sources[0].observedAt=new Date(now.getTime()-16*60000);await dispatchDelegationTriggers('owner',now);expect(enqueueProjectWork).not.toHaveBeenCalled()
  records[0].sources[0].observedAt=now;records[0].trackingMode='off';await dispatchDelegationTriggers('owner',now);expect(enqueueProjectWork).not.toHaveBeenCalled()
})
test('owner day boundaries include offset changes and never use rolling 24 hours',()=>{
  expect(ownerDayStart(new Date('2026-03-08T18:00:00Z'),'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z')
  expect(ownerDayStart(new Date('2026-11-01T18:00:00Z'),'America/New_York').toISOString()).toBe('2026-11-01T04:00:00.000Z')
  expect(ownerDayStart(now,'America/La_Paz').toISOString()).toBe('2026-10-13T04:00:00.000Z')
})
test('retention deletes only owned operational events after 30 days',async()=>{
  await pruneOperationalWorkDetails('owner',now)
  expect(db.projectWorkEvent.deleteMany).toHaveBeenCalledWith({where:{userId:'owner',createdAt:{lt:new Date('2026-09-13T18:00:00Z')}}})
})
