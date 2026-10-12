import {relateProjects,projectHintSchema} from '../project-links'
test('one project connects a folder, GitHub, Vercel and Novo through identifiers',()=>{
  const result=relateProjects([
    {source:'folder',name:'novo-local (2)',repository:'angel/novo',vercelProjectId:'prj_1'},
    {source:'github',name:'angel/novo',repository:'Angel/Novo'},
    {source:'vercel',name:'productivitynovo',vercelProjectId:'prj_1'},
    {source:'novo',name:'Novo',novoId:'owned-project',repository:'angel/novo'},
  ])
  expect(result.groups).toHaveLength(1);expect(result.groups[0].members).toHaveLength(4)
  expect(result.groups[0].confidence).toBe('identifier_match')
})
test('equal names are only probable; conflicting repositories never merge',()=>{
  expect(relateProjects([{source:'folder',name:'Novo (2)'},{source:'novo',name:'Novo'}]).probable).toHaveLength(1)
  const result=relateProjects([{source:'folder',name:'Novo',repository:'owner/first',vercelProjectId:'prj_1'},{source:'vercel',name:'Novo',repository:'owner/second',vercelProjectId:'prj_1'}])
  expect(result.groups).toHaveLength(2);expect(result.probable).toEqual([])
})
test('rejects credential URLs and arbitrary provider paths in native identities',()=>{
  expect(projectHintSchema.safeParse({source:'folder',name:'Novo',repository:'https://token@github.com/o/r'}).success).toBe(false)
  expect(projectHintSchema.safeParse({source:'vercel',name:'Novo',vercelProjectId:'../private'}).success).toBe(false)
})
