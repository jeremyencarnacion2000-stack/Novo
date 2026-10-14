import {projectObservationSchema,projectMemoryPatchSchema} from '../contracts'

const workspace='bcf7c70d-6d39-4bb9-86d2-9e75509c1b69'
const at='2026-10-12T18:00:00.000Z'
const folder={kind:'folder',sourceKey:workspace,title:'Novo',repository:'Angel/Novo',observedAt:at,facts:{workspaceId:workspace,branch:'main',commit:'a'.repeat(40),dirtyFiles:2}}

test('workspace metadata is bounded and contains no paths or source contents',()=>{
  expect(projectObservationSchema.parse(folder).repository).toBe('angel/novo')
  for(const extra of [{path:'C:\\Users\\Angel\\private'},{contents:'private document'},{accessToken:'private-key'}]){
    expect(projectObservationSchema.safeParse({...folder,facts:{...folder.facts,...extra}}).success).toBe(false)
  }
  expect(projectObservationSchema.safeParse({...folder,title:'C:\\Users\\Angel\\private'}).success).toBe(false)
  expect(projectObservationSchema.safeParse({...folder,repository:'https://token@github.com/o/r'}).success).toBe(false)
})

test('rejects secret-like corrections, mutable system fields and unbounded counts',()=>{
  expect(projectMemoryPatchSchema.safeParse({revision:1,correction:'token=private'}).success).toBe(false)
  expect(projectMemoryPatchSchema.safeParse({revision:1,userId:'someone'}).success).toBe(false)
  expect(projectMemoryPatchSchema.parse({revision:1,correction:'Es mi proyecto de estudio',trackingMode:'on'}).trackingMode).toBe('on')
  expect(projectObservationSchema.safeParse({...folder,facts:{...folder.facts,dirtyFiles:-1}}).success).toBe(false)
  expect(projectObservationSchema.safeParse({...folder,observedAt:'not-a-date'}).success).toBe(false)
})

test('provider observations accept only factual service fields',()=>{
  const github={kind:'github',sourceKey:'owner/novo',title:'Novo',repository:'owner/novo',observedAt:at,facts:{openPullRequests:1,ci:{passed:4,failed:1,pending:0}}}
  expect(projectObservationSchema.safeParse(github).success).toBe(true)
  expect(projectObservationSchema.safeParse({...github,facts:{...github.facts,commands:['git push']}}).success).toBe(false)
  expect(projectObservationSchema.safeParse({kind:'vercel',sourceKey:'prj_1',title:'Novo',vercelProjectId:'prj_1',observedAt:at,facts:{deploymentId:'dpl_1',state:'ERROR',createdAt:at}}).success).toBe(true)
})
test('raw credential formats are rejected even without a token label',()=>{
  for(const value of ['sk-proj-'+ 'x'.repeat(32),'ghp_'+ 'a'.repeat(36),'github_pat_'+ 'A'.repeat(40)])expect(projectMemoryPatchSchema.safeParse({revision:1,correction:value}).success).toBe(false)
})
