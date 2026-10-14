/** @jest-environment node */
import {validateWorkResult,acceptVerifiedWorkResult} from '../work-results'
const execution='11111111-1111-4111-8111-111111111111',artifact='22222222-2222-4222-8222-222222222222'
const job:any={id:'j1',userId:'owner',memoryId:'m1',phase:'running',capability:'codex.prepare_fix',executionId:execution,baseCommit:'a'.repeat(40),scope:{memoryId:'m1',deviceId:execution,workspaceId:artifact,verification:[{kind:'npm_script',script:'test'}],timeoutSeconds:600}}
const result:any={executionId:execution,sessionId:execution,baseCommit:job.baseCommit,artifactId:artifact,diffHash:'b'.repeat(64),changedPaths:['app/route.ts'],summary:'Preparé una propuesta de cambios.',verification:{status:'passed',checks:[{kind:'npm_script',script:'test',exitCode:0,evidenceId:execution}]}}
test('a prepared change requires each frozen independent verifier',()=>{
  expect(validateWorkResult(job,result).phase).toBe('completed')
  for(const verification of [{status:'passed',checks:[]},{status:'not_run',checks:[]},{status:'passed',checks:[{...result.verification.checks[0],script:'other'}]},{status:'passed',checks:[{...result.verification.checks[0],exitCode:1}]}])expect(validateWorkResult(job,{...result,verification}).phase).toBe('failed')
})
test('changed execution/base and private or escaping paths are rejected',()=>{
  for(const patch of [{executionId:artifact},{baseCommit:'c'.repeat(40)},{changedPaths:['../private']},{changedPaths:['.GIT/config']},{changedPaths:['.npmrc']}])expect(()=>validateWorkResult(job,{...result,...patch})).toThrow()
})
test('diagnosis never attests edits or verification it did not perform',()=>{
  const diagnostic={...result,changedPaths:[],diffHash:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',verification:{status:'not_run',checks:[]}}
  expect(validateWorkResult({...job,capability:'project.diagnose'},diagnostic).reasonCode).toBe('diagnosis_ready')
  expect(()=>validateWorkResult({...job,capability:'project.diagnose'},result)).toThrow()
})
test('the owned result records factual memory and Twin evidence once without modifying tasks',async()=>{
  let recorded=false
  const tx:any={userSettings:{findUnique:jest.fn().mockResolvedValue(null)},projectAssistantMemory:{findFirst:jest.fn().mockResolvedValue({id:'m1',clearedAt:null}),updateMany:jest.fn()},novoSignalLedger:{findUnique:jest.fn().mockImplementation(async()=>recorded?{id:'seen'}:null),create:jest.fn().mockImplementation(async()=>{recorded=true})},cognitiveTwinRecord:{upsert:jest.fn().mockResolvedValue({id:'t1'})},twinEvolutionLog:{create:jest.fn()},task:{updateMany:jest.fn()}}
  await acceptVerifiedWorkResult(tx,'owner',job,result);await acceptVerifiedWorkResult(tx,'owner',job,result)
  expect(tx.novoSignalLedger.create).toHaveBeenCalledTimes(1);expect(tx.twinEvolutionLog.create).toHaveBeenCalledTimes(1);expect(tx.task.updateMany).not.toHaveBeenCalled()
  await expect(acceptVerifiedWorkResult(tx,'other',job,result)).rejects.toMatchObject({code:'work_not_found'})
})
test('manual results persist while learning is paused without creating Twin signals',async()=>{
  const tx:any={userSettings:{findUnique:jest.fn().mockResolvedValue({settings:{cognitiveLearningPaused:true}})},projectAssistantMemory:{findFirst:jest.fn().mockResolvedValue({id:'m1'})},novoSignalLedger:{findUnique:jest.fn(),create:jest.fn()}}
  expect((await acceptVerifiedWorkResult(tx,'owner',job,result)).phase).toBe('completed')
  expect(tx.novoSignalLedger.create).not.toHaveBeenCalled()
})
