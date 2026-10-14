'use client'
import {useCallback,useEffect,useState} from 'react'
import {Button} from '@/components/ui/button'
import type {AssistantMemoryView} from '@/lib/project-assistant/contracts'
import {useProjectAssistant} from '@/hooks/use-project-assistant'
import {DelegationControls} from '@/components/project-assistant/delegation-controls'

type Snapshot={memories:AssistantMemoryView[];refresh?:{background:string;intervalMinutes:number}}
const sourceNames:Record<string,string>={novo:'Novo',github:'GitHub',vercel:'Vercel',folder:'Carpeta del PC',agent:'Agente local'}
const issue=(status:number)=>status===401?'Inicia sesión para consultar tu seguimiento.':status===409?'La información cambió. Recarga el seguimiento y revisa tu corrección antes de guardarla.':'No se pudo actualizar el seguimiento. Vuelve a intentarlo.'

export function SettingsProjectAssistant(){
  const [snapshot,setSnapshot]=useState<Snapshot>({memories:[]}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const assistant=useProjectAssistant()
  const load=useCallback(async(signal?:AbortSignal)=>{
    setLoading(true);setError('')
    try{const response=await fetch('/api/project-assistant',{cache:'no-store',signal});if(!response.ok)throw new Error(issue(response.status));const body=await response.json();if(!Array.isArray(body.memories))throw new Error(issue(503));setSnapshot(body)}catch(failure){if(!signal?.aborted)setError(failure instanceof Error?failure.message:issue(503))}finally{if(!signal?.aborted)setLoading(false)}
  },[])
  useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort()},[load])
  async function mutate(url:string,method:string,body:unknown){
    setBusy(true);setError('');setNotice('')
    try{const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok){setError(issue(response.status));return false}await load();return true}catch{setError(issue(503));return false}finally{setBusy(false)}
  }
  async function refresh(){if(await mutate('/api/project-assistant','POST',{}))setNotice('Consulta de fuentes terminada. Revisa la fecha de cada fuente.')}
  return <section aria-label="Seguimiento de proyectos" className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-xl"><h3 className="text-lg font-semibold">Proyectos que Novo sigue contigo</h3><p className="mt-2 text-sm text-muted-foreground">Novo conserva el contexto de tus proyectos entre conversaciones. Los proyectos activos de prioridad alta se siguen automáticamente; puedes elegir otros aquí.</p></div><Button variant="outline" disabled={busy||loading} onClick={()=>void refresh()}>Actualizar fuentes</Button></div>
    <p className="text-sm text-muted-foreground">{snapshot.refresh?.background==='github-actions'?'Refresco remoto programado cada 15 minutos. Puede haber retrasos; comprueba la última evidencia.':snapshot.refresh?.background==='inngest'?'Refresco remoto programado cada 15 minutos.':'El refresco con la web cerrada todavía no está activado. Las fuentes se actualizan al usar Novo y desde el compañero conectado.'}</p>
    {error&&<div role="alert" className="space-y-2"><p className="text-sm text-destructive">{error}</p><Button variant="outline" disabled={busy} onClick={()=>void load()}>Volver a cargar</Button></div>}
    {notice&&<p role="status" className="text-sm">{notice}</p>}
    {loading&&<p role="status" className="text-sm text-muted-foreground">Cargando seguimiento…</p>}
    {!loading&&!error&&!snapshot.memories.length&&<p className="py-4 text-sm text-muted-foreground">Actualiza las fuentes para empezar a seguir tus proyectos.</p>}
    <ul className="divide-y divide-border">{snapshot.memories.map(memory=><MemoryRow key={memory.id} memory={memory} others={snapshot.memories.filter(row=>row.id!==memory.id&&(!row.linkedProjectId||!memory.linkedProjectId||row.linkedProjectId===memory.linkedProjectId))} busy={busy} mutate={mutate} assistant={assistant}/>)}</ul>
    <p className="text-sm text-muted-foreground">Seguir un proyecto autoriza consultas y memoria. Para que Novo prepare trabajo por ti, activa una delegación con el PC y las capacidades que elijas.</p>
  </section>
}
function MemoryRow({memory,others,busy,mutate,assistant}:{memory:AssistantMemoryView;others:AssistantMemoryView[];busy:boolean;mutate:(url:string,method:string,body:unknown)=>Promise<boolean>;assistant:ReturnType<typeof useProjectAssistant>}){
  const [correction,setCorrection]=useState(memory.correction??''),[target,setTarget]=useState(''),[forgetting,setForgetting]=useState(false)
  const base=`/api/project-assistant/${encodeURIComponent(memory.id)}`
  return <li className="min-w-0 py-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h4 className="break-words font-semibold">{memory.title}</h4><p className="mt-1 text-sm text-muted-foreground">{memory.tracked?'En seguimiento':'Sin seguimiento'} · {memory.taskCount} tareas pendientes{memory.blockerCount?` · ${memory.blockerCount} bloqueos`:''}</p></div><Button variant="outline" disabled={busy} aria-label={`${memory.tracked?'Pausar':'Activar'} seguimiento de ${memory.title}`} onClick={()=>void mutate(base,'PUT',{revision:memory.revision,trackingMode:memory.tracked?'off':'on'})}>{memory.tracked?'Pausar':'Seguir'}</Button></div>
    <ul className="mt-3 space-y-1 text-sm text-muted-foreground">{memory.sources.map(source=><li key={`${source.kind}:${source.sourceKey}`} className="break-words">{sourceNames[source.kind]}{source.repository?` · ${source.repository}`:''} — {source.available?(source.fresh?'Actualizada':'Última evidencia guardada'):'No disponible ahora'}<span className="block text-xs">{new Date(source.observedAt).toLocaleString('es')}</span></li>)}</ul>
    <details className="mt-4"><summary className="w-fit cursor-pointer rounded-md py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Revisar memoria</summary><div className="mt-3 space-y-4">
      <form onSubmit={event=>{event.preventDefault();void mutate(base,'PUT',{revision:memory.revision,correction:correction.trim()||null})}} className="space-y-2"><label htmlFor={`correction-${memory.id}`} className="block text-sm">Lo que Novo debe recordar de este proyecto</label><textarea id={`correction-${memory.id}`} aria-label={`Corrección para ${memory.title}`} maxLength={480} rows={3} value={correction} onChange={event=>setCorrection(event.target.value)} className="w-full resize-y rounded-xl border border-input bg-transparent p-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"/><Button variant="outline" disabled={busy} type="submit">Guardar corrección</Button></form>
      {others.length>0&&<form onSubmit={event=>{event.preventDefault();const selected=others.find(row=>row.id===target);if(selected)void mutate(`${base}/link`,'POST',{revision:memory.revision,targetId:selected.id,targetRevision:selected.revision})}} className="space-y-2"><label htmlFor={`link-${memory.id}`} className="block text-sm">Estas fuentes pertenecen al mismo proyecto que…</label><select id={`link-${memory.id}`} value={target} onChange={event=>setTarget(event.target.value)} className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="">Elige un proyecto</option>{others.map(row=><option value={row.id} key={row.id}>{row.title}</option>)}</select><p className="text-sm text-muted-foreground">Vincular conserva las fuentes y la configuración del proyecto elegido. No cambia tus tareas.</p><Button variant="outline" disabled={busy||!target} type="submit">Vincular fuentes</Button></form>}
      {!forgetting?<Button variant="ghost" disabled={busy} aria-label={`Olvidar memoria de ${memory.title}`} onClick={()=>setForgetting(true)}>Olvidar esta memoria</Button>:<div className="space-y-2"><p className="text-sm">Novo dejará de usar estos recuerdos. Tus proyectos y archivos se conservan.</p><div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={busy} onClick={()=>void mutate(base,'DELETE',{revision:memory.revision})}>Confirmar olvido</Button><Button variant="outline" disabled={busy} onClick={()=>setForgetting(false)}>Conservar memoria</Button></div></div>}
    </div></details>
    <DelegationControls key={`${memory.id}:${assistant.delegations.find(row=>row.memoryId===memory.id)?.version??'new'}`} memoryId={memory.id} delegation={assistant.delegations.find(row=>row.memoryId===memory.id)} devices={assistant.devices} workspaces={assistant.workspaces.filter(row=>row.memoryId===memory.id)}/>
  </li>
}
