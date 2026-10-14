'use client'

import {useState,type FormEvent} from 'react'
import {Button} from '@/components/ui/button'
import {ProjectAssistantMutationError,useProjectAssistant,type ProjectWorkDevice, type ProjectWorkRecord} from '@/hooks/use-project-assistant'

type ActionDraft=
  | {kind:'task.create';title:string;category:'Training'|'Study'|'Personal'|'Work';priority:'low'|'medium'|'high';dueDate?:string}
  | {kind:'note.create';content:string;tags:string[];noteType:'note'|'idea'|'task'|'reminder'}
  | {kind:'calendar.create';title:string;description?:string;start:string;end:string;allDay:boolean}
  | {kind:'github.issue.create';repository:string;title:string;body:string}
  | {kind:'vercel.deployment.redeploy';projectId:string;projectName:string;deploymentId:string;target:'preview'|'production'}
type StoredDecision={state?:string;requestId?:string;fingerprint?:string;operation?:ActionDraft;operationResult?:{kind:string;resourceId:string}}
const phaseName:Record<string,string>={pending:'En cola',waiting_device:'Esperando tu PC',running:'Trabajando en la carpeta autorizada',awaiting_confirmation:'Esperando tu decisión',completed:'Completado',failed:'No se pudo completar',cancelled:'Cancelado',uncertain:'Estado por confirmar'}
const capabilityName:Record<string,string>={'project.diagnose':'Revisar el proyecto','codex.prepare_fix':'Preparar una corrección con Codex','claude.prepare_fix':'Preparar una corrección con Claude'}
const active=new Set(['pending','waiting_device','running'])

function record(value:unknown):Record<string,unknown>|null{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null}
function pendingDecision(value:unknown):StoredDecision|null{const parsed=record(value);return parsed?.state==='pending'?parsed as StoredDecision:null}
function dateOnly(value:string){const parts=value.split('-').map(Number);if(parts.length!==3||parts.some(part=>!Number.isInteger(part)))return value;const date=new Date(Date.UTC(parts[0],parts[1]-1,parts[2],12));return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat('es',{dateStyle:'long',timeZone:'UTC'}).format(date)}
function dateTime(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat('es',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC',timeZoneName:'short'}).format(date)}
function priorityName(value:string){return value==='high'?'Alta':value==='low'?'Baja':'Media'}
function operationDescription(operation:ActionDraft|undefined){
  if(!operation)return null
  if(operation.kind==='task.create')return <>
    <h6 className="font-medium">Crear tarea</h6>
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      <dt className="text-muted-foreground">Título</dt><dd className="break-words">{operation.title}</dd>
      <dt className="text-muted-foreground">Categoría</dt><dd>{operation.category}</dd>
      <dt className="text-muted-foreground">Prioridad</dt><dd>{priorityName(operation.priority)}</dd>
      {operation.dueDate&&<><dt className="text-muted-foreground">Fecha límite</dt><dd><time dateTime={operation.dueDate}>{dateOnly(operation.dueDate)}</time></dd></>}
    </dl>
  </>
  if(operation.kind==='note.create')return <>
    <h6 className="font-medium">Guardar nota</h6>
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      <dt className="text-muted-foreground">Tipo</dt><dd>{({note:'Nota',idea:'Idea',task:'Tarea',reminder:'Recordatorio'} as const)[operation.noteType]}</dd>
      <dt className="text-muted-foreground">Contenido</dt><dd className="whitespace-pre-wrap break-words">{operation.content}</dd>
      <dt className="text-muted-foreground">Etiquetas</dt><dd className="break-words">{operation.tags.length?operation.tags.join(', '):'Ninguna'}</dd>
    </dl>
  </>
  if(operation.kind==='github.issue.create')return <>
    <h6 className="font-medium">Crear un issue en GitHub</h6>
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      <dt className="text-muted-foreground">Repositorio</dt><dd className="break-words">{operation.repository}</dd>
      <dt className="text-muted-foreground">Título</dt><dd className="break-words">{operation.title}</dd>
      <dt className="text-muted-foreground">Descripción</dt><dd className="whitespace-pre-wrap break-words">{operation.body||'Sin descripción'}</dd>
    </dl>
  </>
  if(operation.kind==='vercel.deployment.redeploy')return <>
    <h6 className="font-medium">Repetir un despliegue existente en Vercel</h6>
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      <dt className="text-muted-foreground">Proyecto</dt><dd className="break-words">{operation.projectName} · <code>{operation.projectId}</code></dd>
      <dt className="text-muted-foreground">Despliegue de origen</dt><dd className="break-all"><code>{operation.deploymentId}</code></dd>
      <dt className="text-muted-foreground">Destino</dt><dd>{operation.target==='production'?'Producción':'Vista previa'}</dd>
    </dl>
  </>
  return <>
    <h6 className="font-medium">Añadir al calendario de Novo</h6>
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      <dt className="text-muted-foreground">Título</dt><dd className="break-words">{operation.title}</dd>
      <dt className="text-muted-foreground">Descripción</dt><dd className="whitespace-pre-wrap break-words">{operation.description||'Sin descripción'}</dd>
      <dt className="text-muted-foreground">Empieza</dt><dd><time dateTime={operation.start}>{dateTime(operation.start)}</time></dd>
      <dt className="text-muted-foreground">Termina</dt><dd><time dateTime={operation.end}>{dateTime(operation.end)}</time></dd>
      <dt className="text-muted-foreground">Duración</dt><dd>{operation.allDay?'Todo el día':'Con horario'}</dd>
      <dt className="col-span-2 mt-1 text-xs text-muted-foreground">Horarios mostrados en UTC.</dt>
    </dl>
  </>
}
function safeResult(value:unknown):{summary?:string;artifactId?:string;baseCommit?:string;changedPaths:string[];verification?:{status:string;checks:{script:string;exitCode:number}[]}}{
  const parsed=record(value),verification=record(parsed?.verification)
  const checks=Array.isArray(verification?.checks)?verification.checks.flatMap(value=>{const check=record(value);return typeof check?.script==='string'&&typeof check.exitCode==='number'?[{script:check.script,exitCode:check.exitCode}]:[]}):[]
  return {
    ...(typeof parsed?.summary==='string'?{summary:parsed.summary}:{}),
    ...(typeof parsed?.artifactId==='string'&&/^[0-9a-f-]{36}$/i.test(parsed.artifactId)?{artifactId:parsed.artifactId}:{}),
    ...(typeof parsed?.baseCommit==='string'&&/^[0-9a-f]{40,64}$/i.test(parsed.baseCommit)?{baseCommit:parsed.baseCommit}:{}),
    changedPaths:Array.isArray(parsed?.changedPaths)?parsed.changedPaths.filter((value):value is string=>typeof value==='string'&&!value.startsWith('/')&&!value.includes('..')&&!/[\\:\u0000-\u001f\u007f]/.test(value)).slice(0,100):[],
    ...(verification&&['passed','failed','not_run'].includes(String(verification.status))?{verification:{status:String(verification.status),checks}}:{}),
  }
}

export function ProjectWorkCard({work,devices}:{work:ProjectWorkRecord;devices:ProjectWorkDevice[]}){
  const assistant=useProjectAssistant()
  const [kind,setKind]=useState<ActionDraft['kind']>('task.create'),[title,setTitle]=useState(work.objective.slice(0,120)),[category,setCategory]=useState<'Training'|'Study'|'Personal'|'Work'>('Work'),[priority,setPriority]=useState<'low'|'medium'|'high'>('medium'),[dueDate,setDueDate]=useState(''),[content,setContent]=useState(''),[tags,setTags]=useState(''),[noteType,setNoteType]=useState<'note'|'idea'|'task'|'reminder'>('note'),[description,setDescription]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState(''),[allDay,setAllDay]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[staleAfterConflict,setStaleAfterConflict]=useState(false),[freshRequested,setFreshRequested]=useState(false)
  const [repository,setRepository]=useState(''),[body,setBody]=useState(''),[projectId,setProjectId]=useState(''),[projectName,setProjectName]=useState(''),[deploymentId,setDeploymentId]=useState(''),[target,setTarget]=useState<'preview'|'production'>('preview')
  const result=safeResult(work.result),decision=staleAfterConflict?null:pendingDecision(work.decision),decisionState=record(work.decision),operationResult=record(decisionState?.operationResult),device=devices.find(item=>item.id===work.deviceId)
  const displayedPhase=decisionState?.state==='executing'?'Enviando la acción aprobada':phaseName[work.phase]??work.phase
  const resultKind=record(work.result)?.verification&&record(record(work.result)?.verification)?.status
  const expired=decisionState?.state==='expired',staleResult=work.resultStale===true||staleAfterConflict
  const canPropose=((work.phase==='completed'&&!work.decision)||(work.phase==='failed'&&decisionState?.state==='failed'))&&Boolean(work.result)&&!staleResult
  async function send(action:()=>Promise<void>){
    setBusy(true);setError('');setNotice('')
    try{await action();setNotice('Estado de Novo actualizado.');return true}
    catch(failure){setError(failure instanceof Error?failure.message:'No se pudo conectar con Novo. Conservamos esta tarea para que puedas reintentarlo.');if(failure instanceof ProjectAssistantMutationError&&failure.code==='result_stale')setStaleAfterConflict(true);return false}
    finally{setBusy(false)}
  }
  function operation():ActionDraft|null{
    if(kind==='task.create')return title.trim()?{kind,title:title.trim(),category,priority,...(dueDate?{dueDate}:{})}:null
    if(kind==='note.create')return content.trim()?{kind,content:content.trim(),noteType,tags:tags.split(',').map(tag=>tag.trim()).filter(Boolean).slice(0,8)}:null
    if(kind==='github.issue.create')return repository.trim()&&title.trim()?{kind,repository:repository.trim(),title:title.trim(),body:body.trim()}:null
    if(kind==='vercel.deployment.redeploy')return projectId.trim()&&projectName.trim()&&deploymentId.trim()?{kind,projectId:projectId.trim(),projectName:projectName.trim(),deploymentId:deploymentId.trim(),target}:null
    if(!title.trim()||!start||!end)return null
    const startDate=new Date(start),endDate=new Date(end)
    if(!Number.isFinite(startDate.getTime())||!Number.isFinite(endDate.getTime())||endDate<=startDate)return null
    return {kind,title:title.trim(),...(description.trim()?{description:description.trim()}:{}),start:startDate.toISOString(),end:endDate.toISOString(),allDay}
  }
  function prepare(event:FormEvent){event.preventDefault();const draft=operation();if(!draft){setError('Completa los campos y revisa el horario antes de preparar la acción.');return}void send(()=>assistant.prepareAction(work.id,work.revision,draft))}
  function decide(value:'confirm'|'deny'){
    if(!decision?.requestId||!decision.fingerprint)return
    void send(()=>assistant.decideAction(work.id,{revision:work.revision,requestId:decision.requestId!,fingerprint:decision.fingerprint!,decision:value}))
  }
  async function requestFreshResult(){if(await send(()=>assistant.enqueue({memoryId:work.memoryId,capability:work.capability,objective:work.objective})))setFreshRequested(true)}
  const contentId=`work-action-content-${work.id}`
  return <article aria-label={`Trabajo de Novo: ${work.objective}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-xs font-medium text-primary">{work.mode==='automatic'?'Seguimiento automático':'Solicitud tuya'}</span><span aria-label={`Estado: ${displayedPhase}`} className="rounded-full bg-muted px-2.5 py-1 text-xs">{displayedPhase}</span></div>
        <h4 className="mt-2 break-words font-semibold">{work.objective}</h4><p className="mt-1 text-sm text-muted-foreground">{capabilityName[work.capability]??'Trabajo de Novo'} · {device?`Lo ejecuta ${device.name}`:'PC seleccionado'}</p>
      </div>
      {active.has(work.phase)&&<Button variant="outline" size="sm" disabled={busy} onClick={()=>void send(()=>assistant.cancel(work.id,work.revision))}>Cancelar</Button>}
    </div>
    {result.summary&&<p className="mt-3 whitespace-pre-wrap break-words text-sm">{result.summary}</p>}
    {work.phase==='completed'&&(result.changedPaths.length>0||result.verification||result.artifactId)&&<details className="mt-3 rounded-xl border border-border/70 px-3 py-2">
      <summary className="w-fit cursor-pointer py-1 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Ver archivos y comprobaciones</summary>
      {result.changedPaths.length>0&&<><p className="mt-2 text-xs text-muted-foreground">Archivos de la propuesta ({result.changedPaths.length}). Los archivos originales siguen intactos.</p><ul className="mt-1 space-y-1">{result.changedPaths.slice(0,12).map(path=><li key={path} className="break-all font-mono text-xs">{path}</li>)}</ul>{result.changedPaths.length>12&&<p className="mt-1 text-xs text-muted-foreground">Y {result.changedPaths.length-12} archivos más.</p>}</>}
      {result.verification&&<div className="mt-3 text-xs"><p className="font-medium">Comprobaciones: {result.verification.status==='passed'?'correctas':result.verification.status==='failed'?'con errores':'no ejecutadas'}</p>{result.verification.checks.map((check,index)=><p key={`${check.script}:${index}`} className="mt-1 break-all text-muted-foreground">{check.script}: {check.exitCode===0?'correcto':`código ${check.exitCode}`}</p>)}</div>}
      {result.baseCommit&&<p className="mt-3 text-xs text-muted-foreground">Punto de partida: <code>{result.baseCommit.slice(0,12)}</code></p>}
      {result.artifactId&&work.capability.endsWith('prepare_fix')&&<div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs"><p className="font-medium">Abrir la propuesta en Novo Companion</p><p className="mt-1 text-muted-foreground">En {device?.name??'el PC que ejecutó el trabajo'}, ve a Ajustes → Asistente → Propuestas locales y busca esta referencia:</p><code className="mt-2 block break-all">{result.artifactId}</code><p className="mt-1 text-muted-foreground">El Companion conserva la copia privada en ese PC; el proyecto original no se modifica.</p></div>}
      {result.artifactId&&!work.capability.endsWith('prepare_fix')&&<div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs"><p className="font-medium">Referencia local del diagnóstico</p><code className="mt-2 block break-all">{result.artifactId}</code><p className="mt-1 text-muted-foreground">El diagnóstico se conserva en {device?.name??'el PC que ejecutó el trabajo'}; no incluye una propuesta de código para abrir.</p></div>}
    </details>}
    {decisionState?.state==='applied'&&<p role="status" className="mt-3 text-sm">{operationResult?.kind==='github_issue'?`Issue #${operationResult.resourceId} creado en GitHub.`:operationResult?.kind==='vercel_deployment'?`Vercel aceptó el nuevo despliegue ${operationResult.resourceId}.`:<>La acción aprobada se guardó en Novo.{operationResult?.kind==='task'?' Puedes verla en Tareas.':operationResult?.kind==='note'?' Puedes verla en Notas.':operationResult?.kind==='calendar_event'?' Puedes verla en el Calendario.':''}</>}</p>}
    {decisionState?.state==='denied'&&<p className="mt-3 text-sm text-muted-foreground">Rechazaste la acción; no se modificaron tus datos.</p>}
    {decisionState?.state==='executing'&&<p role="status" className="mt-3 text-sm text-muted-foreground">Enviando la acción que aprobaste. Novo no la enviará dos veces.</p>}
    {decisionState?.state==='failed'&&<p role="alert" className="mt-3 text-sm text-destructive">El proveedor rechazó la acción ({String(decisionState.failureCode??'provider_unavailable').replaceAll('_',' ')}). Revisa la conexión y el permiso indicados; después puedes preparar una nueva aprobación.</p>}
    {decisionState?.state==='uncertain'&&<p role="alert" className="mt-3 text-sm text-destructive">No se pudo confirmar el resultado ({String(decisionState.failureCode??'provider_result_unknown').replaceAll('_',' ')}). Comprueba GitHub o Vercel antes de volver a intentarlo; Novo no la repetirá automáticamente.</p>}
    {(expired||staleResult)&&<div className="mt-3 space-y-2"><p className="text-sm text-muted-foreground">{expired?'La autorización venció y ya no se puede usar. Solicita un resultado nuevo para revisar una acción actualizada.':'El resultado quedó desactualizado y no se puede aprobar. Solicita uno nuevo para revisar una acción vigente.'}</p><Button variant="outline" size="sm" disabled={busy||freshRequested} onClick={()=>void requestFreshResult()}>{freshRequested?'Nueva ejecución solicitada':busy?'Solicitando…':'Volver a ejecutar en el PC autorizado'}</Button></div>}
    {work.phase==='completed'&&work.capability.endsWith('prepare_fix')&&<p className="mt-2 text-xs text-muted-foreground">La propuesta fue preparada, no publicada. Revisa el cambio en el PC que la ejecutó.</p>}
    {work.reasonCode&&work.phase!=='completed'&&!['failed','uncertain'].includes(String(decisionState?.state))&&<p className="mt-2 text-sm text-muted-foreground">Motivo: {work.reasonCode.replaceAll('_',' ')}</p>}
    <p className="mt-3 text-xs text-muted-foreground">Última actualización: {new Date(work.updatedAt).toLocaleString('es')} · secuencia {work.sequence}</p>
    {decision&&<section aria-label="Acción pendiente de aprobación" className="mt-4 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div><h5 className="font-medium">Revisa todos los datos antes de aprobar</h5><div className="mt-2">{operationDescription(decision.operation)}</div><p className="mt-2 text-xs text-muted-foreground">Solo se guardará exactamente esta acción. La autorización vence en 24 horas.</p></div>
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>decide('confirm')}>{decision.operation?.kind==='github.issue.create'||decision.operation?.kind==='vercel.deployment.redeploy'?'Confirmar y ejecutar':'Confirmar y guardar'}</Button><Button variant="outline" disabled={busy} onClick={()=>decide('deny')}>Rechazar</Button></div>
    </section>}
    {canPropose&&<details className="mt-4 border-t border-border pt-3"><summary className="w-fit cursor-pointer py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Preparar una acción en Novo</summary>
      <form onSubmit={prepare} className="mt-3 space-y-3">
        <label className="block text-sm font-medium" htmlFor={`work-action-kind-${work.id}`}>Qué quieres preparar</label>
        <select id={`work-action-kind-${work.id}`} value={kind} onChange={event=>setKind(event.target.value as ActionDraft['kind'])} className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="task.create">Crear una tarea</option><option value="note.create">Guardar una nota</option><option value="calendar.create">Añadir al calendario Novo</option><option value="github.issue.create">Crear un issue en GitHub</option><option value="vercel.deployment.redeploy">Repetir un despliegue existente en Vercel</option></select>
        {(kind==='task.create'||kind==='github.issue.create')&&<>
          <label className="block text-sm" htmlFor={`work-task-title-${work.id}`}>{kind==='task.create'?'Título de la tarea':'Título del issue'}</label><input id={`work-task-title-${work.id}`} maxLength={120} required value={title} onChange={event=>setTitle(event.target.value)} className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"/>
        </>}
        {kind==='task.create'&&<>
          <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Categoría<select value={category} onChange={event=>setCategory(event.target.value as typeof category)} className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-2"><option>Work</option><option>Personal</option><option>Study</option><option>Training</option></select></label><label className="text-sm">Prioridad<select value={priority} onChange={event=>setPriority(event.target.value as typeof priority)} className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-2"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></label><label className="text-sm">Fecha límite<input type="date" value={dueDate} onChange={event=>setDueDate(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-2"/></label></div>
        </>}
        {kind==='note.create'&&<><label className="block text-sm" htmlFor={contentId}>Contenido de la nota</label><textarea id={contentId} maxLength={1200} required rows={3} value={content} onChange={event=>setContent(event.target.value)} className="w-full rounded-xl border border-input bg-background p-3 text-sm"/><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Tipo<select value={noteType} onChange={event=>setNoteType(event.target.value as typeof noteType)} className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-2"><option value="note">Nota</option><option value="idea">Idea</option><option value="task">Tarea</option><option value="reminder">Recordatorio</option></select></label><label className="text-sm">Etiquetas, separadas por comas<input value={tags} onChange={event=>setTags(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-2"/></label></div></>}
        {kind==='calendar.create'&&<><label className="block text-sm" htmlFor={`work-event-title-${work.id}`}>Título del evento</label><input id={`work-event-title-${work.id}`} maxLength={120} required value={title} onChange={event=>setTitle(event.target.value)} className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"/><label className="block text-sm" htmlFor={`work-event-description-${work.id}`}>Descripción (opcional)</label><textarea id={`work-event-description-${work.id}`} maxLength={480} rows={2} value={description} onChange={event=>setDescription(event.target.value)} className="w-full rounded-xl border border-input bg-background p-3 text-sm"/><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Empieza<input required type="datetime-local" value={start} onChange={event=>setStart(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-2"/></label><label className="text-sm">Termina<input required type="datetime-local" value={end} onChange={event=>setEnd(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-2"/></label></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allDay} onChange={event=>setAllDay(event.target.checked)}/>Evento de todo el día</label></>}
        {kind==='github.issue.create'&&<><label className="block text-sm" htmlFor={`work-github-repository-${work.id}`}>Repositorio (organización/repositorio)</label><input id={`work-github-repository-${work.id}`} required maxLength={201} placeholder="acme/novo" value={repository} onChange={event=>setRepository(event.target.value)} className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"/><label className="block text-sm" htmlFor={`work-github-body-${work.id}`}>Descripción del issue</label><textarea id={`work-github-body-${work.id}`} maxLength={10000} rows={4} value={body} onChange={event=>setBody(event.target.value)} className="w-full rounded-xl border border-input bg-background p-3 text-sm"/><p className="text-xs text-muted-foreground">La cuenta conectada debe tener permiso de escritura en ese repositorio. Novo mostrará título y descripción antes de crear el issue.</p></>}
        {kind==='vercel.deployment.redeploy'&&<><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Nombre exacto del proyecto<input required maxLength={100} value={projectName} onChange={event=>setProjectName(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"/></label><label className="block text-sm">ID de proyecto<input required maxLength={128} placeholder="prj_…" value={projectId} onChange={event=>setProjectId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"/></label></div><label className="block text-sm">ID del despliegue existente<input required maxLength={128} placeholder="dpl_…" value={deploymentId} onChange={event=>setDeploymentId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"/></label><label className="block text-sm">Destino<select value={target} onChange={event=>setTarget(event.target.value as typeof target)} className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="preview">Vista previa</option><option value="production">Producción</option></select></label><p className="text-xs text-muted-foreground">Solo se repetirá un despliegue reciente de un proyecto Vercel que ya elegiste en Conectores. La producción requiere tu confirmación aquí.</p></>}
        <p className="text-xs text-muted-foreground">Primero se preparará para revisión. No ejecutará ni guardará la acción hasta que la confirmes.</p>
        <Button type="submit" disabled={busy}>{busy?'Preparando…':'Preparar para revisar'}</Button>
      </form>
    </details>}
    {notice&&<p role="status" className="mt-3 text-sm text-muted-foreground">{notice}</p>}{error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {resultKind==='failed'&&<p className="sr-only">Las comprobaciones fallaron.</p>}
  </article>
}
