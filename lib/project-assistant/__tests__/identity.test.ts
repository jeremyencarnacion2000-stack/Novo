import {resolveObservationIdentity} from '../identity'

const existing=[{id:'m1',title:'Novo',sources:[{kind:'github',sourceKey:'owner/novo',repository:'owner/novo',vercelProjectId:null},{kind:'folder',sourceKey:'device:workspace-a',repository:'owner/novo',vercelProjectId:'prj_1'}]}]

test('binds different authorized workspaces to the same repository identity',()=>{
  expect(resolveObservationIdentity(existing,{kind:'folder',sourceKey:'device:workspace-b',title:'Nuevo checkout',repository:'OWNER/NOVO'})).toEqual({kind:'existing',id:'m1'})
  expect(resolveObservationIdentity(existing,{kind:'vercel',sourceKey:'prj_1',title:'productivitynovo',vercelProjectId:'prj_1'})).toEqual({kind:'existing',id:'m1'})
})

test('same name alone remains a candidate and never merges records',()=>{
  expect(resolveObservationIdentity(existing,{kind:'folder',sourceKey:'other',title:'Novo'})).toEqual({kind:'new',candidates:['m1']})
})

test('a conflicting repository blocks even an exact Vercel or source-key match',()=>{
  expect(resolveObservationIdentity(existing,{kind:'vercel',sourceKey:'prj_1',title:'Novo',vercelProjectId:'prj_1',repository:'owner/other'})).toEqual({kind:'conflict',ids:['m1']})
  expect(resolveObservationIdentity(existing,{kind:'github',sourceKey:'owner/novo',title:'Novo',repository:'owner/other'})).toEqual({kind:'conflict',ids:['m1']})
})

test('matching two existing records requires explicit reconciliation',()=>{
  const second={id:'m2',title:'Otro',sources:[{kind:'vercel',sourceKey:'prj_2',repository:null,vercelProjectId:'prj_2'}]}
  expect(resolveObservationIdentity([...existing,second],{kind:'github',sourceKey:'owner/novo',title:'Novo',repository:'owner/novo',vercelProjectId:'prj_2'})).toEqual({kind:'conflict',ids:['m1','m2']})
})
