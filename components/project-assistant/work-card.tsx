'use client'

import {useState,type FormEvent} from 'react'
import {Button} from '@/components/ui/button'
import {useProjectAssistant,type ProjectWorkDevice, type ProjectWorkRecord} from '@/hooks/use-project-assistant'

type ActionDraft=
  | {kind:'task.create';title:string;category:'Training'|'Study'|'Personal'|'Work';priority:'low'|'medium'|'high';dueDate?:string}
  | {kind:'note.create';content:string;tags:string[];noteType:'note'|'idea'|'task'|'reminder'}
  | {kind:'calendar.create';title:string;description?:string;start:string;end:string;allDay:boolean}
type StoredDecision={state?:string;requestId?:string;fingerprint?:string;operation?:ActionDraft;operationResult?:{kind:string;resourceId:string}}
const phaseName:Record<string,string>={pending:'En cola',waiting_device:'Esperando tu PC',running:'Trabajando en la carpeta autorizada',awaiting_confirmation:'Esperando tu decisión',completed:'Completado',failed:'No se pudo completar',cancelled:'Cancelado',uncertain:'Estado por confirmar'}
const capabilityName:Record<string,string>={'project.diagnose':'Revisar el proyecto','codex.prepare_fix':'Preparar una corrección con Codex','claude.prepare_fix':'Preparar una corrección con Claude'}
const active=new Set(['pending','waiting_device','running'])

function record(value:unknown):Record<string,unknown>|null{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null}
function pendingDecision(value:unknown):StoredDecision|null{const parsed=record(value);return parsed?.state==='pending'?parsed as StoredDecision:null}
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
  const [kind,setKind]=useState<ActionDraft['kind']>('task.create'),[title,setTitle]=useState(work.objective.slice(0,120)),[category,setCategory]=useState<'Training'|'Study'|'Personal'|'Work'>('Work'),[priority,setPriority]=useState<'low'|'medium'|'high'>('medium'),[dueDate,setDueDate]=useState(''),[content,setContent]=useState(''),[tags,setTags]=useState(''),[noteType,setNoteType]=useState<'note'|'idea'|'task'|'reminder'>('note'),[description,setDescription]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState(''),[allDay,setAllDay]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const result=safeResult(work.result),decision=pendingDecision(work.decision),decisionState=record(work.decision),operationResult=record(decisionState?.operationResult),device=devices.find(item=>item.id===work.deviceId)
  const resultKind=record(work.result)?.verification&&record(record(work.result)?.verification)?.status
  const canPropose=work.phase==='completed'&&!work.decision&&Boolean(work.result)
  async function send(action:()=>Promise<void>){
    setBusy(true);setError('');setNotice('')
    try{await action();setNotice('Estado de Novo actualizado.')}
    catch(failure){setError(failure instanceof Error?failure.message:'No se pudo conectar con Novo. Conservamos esta tarea para que puedas reintentarlo.')}
    finally{setBusy(false)}
  }
  function operation():ActionDraft|null{
    if(kind==='task.create')return title.trim()?{kind,title:title.trim(),category,priority,...(dueDate?{dueDate}:{})}:null
    if(kind==='note.create')return content.trim()?{kind,content:content.trim(),noteType,tags:tags.split(',').map(tag=>tag.trim()).filter(Boolean).slice(0,8)}:null
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
  const contentId=`work-action-content-${work.id}`
  return <article aria-label={`Trabajo de Novo: ${work.objective}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-xs font-medium text-primary">{work.mode==='automatic'?'Seguimiento automático':'Solicitud tuya'}</span><span aria-label={`Estado: ${phaseName[work.phase]??work.phase}`} className="rounded-full bg-muted px-2.5 py-1 text-xs">{phaseName[work.phase]??work.phase}</span></div>
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
      {result.artifactId&&<p className="mt-2 text-xs text-muted-foreground">Referencia del artefacto local en {device?.name??'el PC que ejecutó el trabajo'}: <code className="break-all">{result.artifactId}</code>. El parche permanece en ese Companion; esta vista conserva el resumen y el historial.</p>}
    </details>}
    {decisionState?.state==='applied'&&<p role="status" className="mt-3 text-sm">La acción aprobada se guardó en Novo.{operationResult?.kind==='task'?' Puedes verla en Tareas.':operationResult?.kind==='note'?' Puedes verla en Notas.':operationResult?.kind==='calendar_event'?' Puedes verla en el Calendario.':''}</p>}
    {decisionState?.state==='denied'&&<p className="mt-3 text-sm text-muted-foreground">Rechazaste la acción; no se modificaron tus datos.</p>}
    {decisionState?.state==='expired'&&<p className="mt-3 text-sm text-muted-foreground">La revisión venció. Vuelve a preparar la acción desde un resultado reciente.</p>}
    {work.phase==='completed'&&work.capability.endsWith('prepare_fix')&&<p className="mt-2 text-xs text-muted-foreground">La propuesta fue preparada, no publicada. Revisa el cambio en el PC que la ejecutó.</p>}
    {work.reasonCode&&work.phase!=='completed'&&<p className="mt-2 text-sm text-muted-foreground">Motivo: {work.reasonCode.replaceAll('_',' ')}</p>}
    <p className="mt-3 text-xs text-muted-foreground">Última actualización: {new Date(work.updatedAt).toLocaleString('es')} · secuencia {work.sequence}</p>
    {decision&&<section aria-label="Acción pendiente de aprobación" className="mt-4 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div><h5 className="font-medium">Revisa esta acción de Novo</h5><p className="mt-1 text-sm">{decision.operation?.kind==='task.create'&&`Crear tarea: ${decision.operation.title}`}{decision.operation?.kind==='note.create'&&`Guardar nota: ${decision.operation.content}`}{decision.operation?.kind==='calendar.create'&&`Añadir al calendario: ${decision.operation.title}`}</p><p className="mt-1 text-xs text-muted-foreground">Solo se guardará exactamente esta acción. La autorización vence en 24 horas.</p></div>
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>decide('confirm')}>Confirmar y guardar</Button><Button variant="outline" disabled={busy} onClick={()=>decide('deny')}>Rechazar</Button></div>
    </section>}
    {canPropose&&<details className="mt-4 border-t border-border pt-3"><summary className="w-fit cursor-pointer py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Preparar una acción en Novo</summary>
      <form onSubmit={prepare} className="mt-3 space-y-3">
        <label className="block text-sm font-medium" htmlFor={`work-action-kind-${work.id}`}>Qué quieres preparar</label>
        <select id={`work-action-kind-${work.id}`} value={kind} onChange={event=>setKind(event.target.value as ActionDraft['kind'])} className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="task.create">Crear una tarea</option><option value="note.create">Guardar una nota</option><option value="calendar.create">Añadir al calendario Novo</option></select>
        {kind==='task.create'&&<>
          <label className="block text-sm" htmlFor={`work-task-title-${work.id}`}>Título de la tarea</label><input id={`work-task-title-${work.id}`} maxLength={120} required value={title} onChange={event=>setTitle(event.target.value)} className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"/>
          <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Categoría<select value={category} onChange={event=>setCategory(event.target.value as typeof category)} className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-2"><option>Work</option><option>Personal</option><option>Study</option><option>Training</option></select></label><label className="text-sm">Prioridad<select value={priority} onChange={event=>setPriority(event.target.value as typeof priority)} className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-2"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></label><label className="text-sm">Fecha límite<input type="date" value={dueDate} onChange={event=>setDueDate(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-2"/></label></div>
        </>}
        {kind==='note.create'&&<><label className="block text-sm" htmlFor={contentId}>Contenido de la nota</label><textarea id={contentId} maxLength={1200} required rows={3} value={content} onChange={event=>setContent(event.target.value)} className="w-full rounded-xl border border-input bg-background p-3 text-sm"/><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Tipo<select value={noteType} onChange={event=>setNoteType(event.target.value as typeof noteType)} className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-2"><option value="note">Nota</option><option value="idea">Idea</option><option value="task">Tarea</option><option value="reminder">Recordatorio</option></select></label><label className="text-sm">Etiquetas, separadas por comas<input value={tags} onChange={event=>setTags(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-2"/></label></div></>}
        {kind==='calendar.create'&&<><label className="block text-sm" htmlFor={`work-event-title-${work.id}`}>Título del evento</label><input id={`work-event-title-${work.id}`} maxLength={120} required value={title} onChange={event=>setTitle(event.target.value)} className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"/><label className="block text-sm" htmlFor={`work-event-description-${work.id}`}>Descripción (opcional)</label><textarea id={`work-event-description-${work.id}`} maxLength={480} rows={2} value={description} onChange={event=>setDescription(event.target.value)} className="w-full rounded-xl border border-input bg-background p-3 text-sm"/><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Empieza<input required type="datetime-local" value={start} onChange={event=>setStart(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-2"/></label><label className="text-sm">Termina<input required type="datetime-local" value={end} onChange={event=>setEnd(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-2"/></label></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allDay} onChange={event=>setAllDay(event.target.checked)}/>Evento de todo el día</label></>}
        <p className="text-xs text-muted-foreground">Primero se preparará para revisión. No cambia tus tareas ni tu calendario hasta que confirmes la acción.</p>
        <Button type="submit" disabled={busy}>{busy?'Preparando…':'Preparar para revisar'}</Button>
      </form>
    </details>}
    {notice&&<p role="status" className="mt-3 text-sm text-muted-foreground">{notice}</p>}{error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {resultKind==='failed'&&<p className="sr-only">Las comprobaciones fallaron.</p>}
  </article>
}
