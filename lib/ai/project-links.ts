import { z } from 'zod'

export const projectHintSchema=z.object({
  source:z.enum(['folder','github','vercel']), name:z.string().min(1).max(120),
  repository:z.string().regex(/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i).max(201).optional(),
  vercelProjectId:z.string().regex(/^[a-z0-9_-]{1,128}$/i).optional(),
}).strict()
export type ProjectHint=z.infer<typeof projectHintSchema>
export const localConnectionsSchema=z.object({github:z.string().max(6000).optional(),vercel:z.string().max(6000).optional(),codex:z.string().max(2000).optional()}).strict()
export type ProjectEvidence=Omit<ProjectHint,'source'> & {source:ProjectHint['source']|'novo';novoId?:string}
const nameKey=(name:string)=>name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s*\(\d+\)$/,'').replace(/[^a-z0-9]/g,'')

/** Names suggest a relation; only matching stable identifiers join records. */
export function relateProjects(records:ProjectEvidence[]){
  const sameRepo=(a:ProjectEvidence,b:ProjectEvidence)=>Boolean(a.repository&&b.repository&&a.repository.toLowerCase()===b.repository.toLowerCase())
  const sameVercel=(a:ProjectEvidence,b:ProjectEvidence)=>Boolean(a.vercelProjectId&&a.vercelProjectId===b.vercelProjectId)
  const groups:ProjectEvidence[][]=[]
  const conflicts=(a:ProjectEvidence,b:ProjectEvidence)=>Boolean(a.repository&&b.repository&&!sameRepo(a,b))
  for(const row of records){
    const matches=groups.filter(group=>group.some(other=>sameRepo(row,other)||sameVercel(row,other))&&!group.some(other=>conflicts(row,other)))
    if(!matches.length){groups.push([row]);continue;}
    const target=matches[0];target.push(row)
    // Never let a transitive Vercel match join conflicting repositories.
    for(const group of matches.slice(1))if(!group.some(a=>target.some(b=>conflicts(a,b)))){target.push(...group);groups.splice(groups.indexOf(group),1)}
  }
  const probable:{left:number;right:number;reason:string}[]=[]
  for(let left=0;left<groups.length;left++)for(let right=left+1;right<groups.length;right++){
    if(groups[left].some(a=>groups[right].some(b=>conflicts(a,b))))continue
    if(groups[left].some(a=>groups[right].some(b=>{
      const namesA=[a.name,a.repository?.split('/')[1]].filter(Boolean) as string[]
      const namesB=[b.name,b.repository?.split('/')[1]].filter(Boolean) as string[]
      return namesA.some(x=>namesB.some(y=>nameKey(x).length>=3&&nameKey(x)===nameKey(y)))
    })))probable.push({left,right,reason:'nombre coincidente; falta confirmar un identificador'})
  }
  return {groups:groups.map(members=>({members,confidence:members.length>1?'identifier_match':'single_source'})),probable}
}
