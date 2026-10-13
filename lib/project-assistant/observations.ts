import {projectObservationSchema,type ProjectObservation} from './contracts'

type NovoProjectEvidence={id:string;title:string;status:string;progress:number;priority:string;version?:number;description?:string|null;notes?:string|null;tags?:string|null;tasks?:Array<{id:string;title:string;status:string;priority:string;dueDate?:string|null}>}
export function projectIdentifiers(project:NovoProjectEvidence) {
  const metadata=[project.description,project.notes,project.tags].filter(Boolean).join('\n')
  const repositories=[...new Set([...metadata.matchAll(/https:\/\/github\.com\/([\w.-]+\/[\w.-]+)/gi)].map(match=>match[1].replace(/\.git$/i,'').toLowerCase()))]
  const vercelIds=[...new Set([...metadata.matchAll(/\bprj_[a-z0-9_-]+\b/gi)].map(match=>match[0]))]
  return {repository:repositories.length===1?repositories[0]:undefined,vercelProjectId:vercelIds.length===1?vercelIds[0]:undefined}
}

/** Explicit factual projection: descriptions/notes are used for identity only. */
export function createNovoProjectObservations(projects:NovoProjectEvidence[],now=new Date()):ProjectObservation[] {
  return projects.flatMap(project=>{
    const result=projectObservationSchema.safeParse({kind:'novo',sourceKey:project.id,title:project.title,...projectIdentifiers(project),observedAt:now.toISOString(),facts:{status:project.status,progress:project.progress,priority:project.priority,version:project.version,tasks:(project.tasks??[]).map(task=>({id:task.id,title:task.title,status:task.status,priority:task.priority,dueDate:task.dueDate??null}))}})
    return result.success?[result.data]:[]
  })
}
