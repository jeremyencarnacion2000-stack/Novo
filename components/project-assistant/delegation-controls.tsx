'use client'

import {useState,type FormEvent} from 'react'
import {Button} from '@/components/ui/button'
import {useProjectAssistant,type ProjectWorkDelegation,type ProjectWorkDevice,type ProjectWorkspace} from '@/hooks/use-project-assistant'
import {ProjectWorkCard} from './work-card'

const capabilities=['project.diagnose','codex.prepare_fix','claude.prepare_fix'] as const
const triggers=[['ci_failure','Falla en comprobaciones'],['deployment_failure','Falla en una publicación'],['task_blocker','Bloqueo de proyecto']] as const
const capabilityLabels:Record<string,string>={'project.diagnose':'Revisar el estado del proyecto','codex.prepare_fix':'Preparar una propuesta con Codex','claude.prepare_fix':'Preparar una propuesta con Claude'}

export function DelegationControls({memoryId,delegation,devices,workspaces}:{memoryId:string;delegation?:ProjectWorkDelegation;devices:ProjectWorkDevice[];workspaces:ProjectWorkspace[]}){
  const assistant=useProjectAssistant()
  const readyDevice=devices.find(device=>device.id===delegation?.deviceId)??devices.find(device=>device.canExecute)??devices[0]
  const readyWorkspace=workspaces.find(workspace=>workspace.id===delegation?.workspaceId&&workspace.deviceId===readyDevice?.id)??workspaces.find(workspace=>workspace.memoryId===memoryId&&workspace.deviceId===readyDevice?.id)
  const [deviceId,setDeviceId]=useState(delegation?.deviceId??readyDevice?.id??'')
  const [workspaceId,setWorkspaceId]=useState(delegation?.workspaceId??readyWorkspace?.id??'')
  const [selectedCapabilities,setSelectedCapabilities]=useState<string[]>(delegation?.capabilities??(readyDevice?.capabilities.includes('project.diagnose')?['project.diagnose']:[]))
  const [enabled,setEnabled]=useState(delegation?.enabled??false)
  const [selectedTriggers,setSelectedTriggers]=useState<string[]>(delegation?.triggers??[])
  const [dailyLimit,setDailyLimit]=useState(delegation?.dailyLimit??3)
  const [timezone,setTimezone]=useState(delegation?.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone??'UTC')
  const [verificationText,setVerificationText]=useState((delegation?.verification??[]).map(value=>(value as {script?:string}).script??'').join('\n'))
  const [objective,setObjective]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const device=devices.find(item=>item.id===deviceId)
  const scopedWorkspaces=workspaces.filter(item=>item.memoryId===memoryId&&item.deviceId===deviceId)
  const selectedVerification=[...new Set(verificationText.split(/\r?\n/).map(value=>value.trim()).filter(Boolean))].slice(0,4)
  const validVerification=selectedVerification.every(value=>/^[a-z0-9_.:-]{1,80}$/i.test(value))
  const missingRuntime=selectedCapabilities.filter(capability=>!device?.capabilities.includes(capability))
  const canEnable=Boolean(device?.canExecute&&scopedWorkspaces.some(item=>item.id===workspaceId)&&selectedCapabilities.length&&missingRuntime.length===0&&(!selectedCapabilities.some(capability=>capability.endsWith('prepare_fix'))||selectedVerification.length>0&&validVerification))
  const canSave=Boolean(delegation&&!enabled&&deviceId&&workspaceId&&selectedCapabilities.length)||Boolean(device?.canExecute&&scopedWorkspaces.some(item=>item.id===workspaceId)&&selectedCapabilities.length&&validVerification&&(!enabled||canEnable))
  const jobs=assistant.work.filter(work=>work.memoryId===memoryId)
  const selectedCapability=selectedCapabilities.find(capability=>device?.capabilities.includes(capability))??''

  function toggle(values:string[],set:(next:string[])=>void,value:string){set(values.includes(value)?values.filter(item=>item!==value):[...values,value])}
  async function save(event:FormEvent){
    event.preventDefault();setBusy(true);setError('');setNotice('')
    try{
      await assistant.saveDelegation({memoryId,deviceId,workspaceId,capabilities:selectedCapabilities,enabled,version:delegation?.version??0,dailyLimit,timezone,triggers:selectedTriggers,verification:selectedVerification.map(script=>({kind:'npm_script',script})),timeoutSeconds:delegation?.timeoutSeconds??600})
      setNotice(enabled?'La delegación quedó activa con estos permisos.':'La delegación quedó pausada. El seguimiento del proyecto continúa.')
    }catch(failure){setError(failure instanceof Error?failure.message:'No se pudieron guardar los permisos.')}
    finally{setBusy(false)}
  }
  async function enqueue(event:FormEvent){
    event.preventDefault();if(!selectedCapability)return
    setBusy(true);setError('');setNotice('')
    try{await assistant.enqueue({memoryId,capability:selectedCapability,objective});setObjective('');setNotice('Solicitud guardada. Novo Companion la recibirá cuando este PC esté conectado.')}
    catch(failure){setError(failure instanceof Error?failure.message:'No se pudo enviar la solicitud.')}
    finally{setBusy(false)}
  }

  return <details className="mt-4 rounded-xl border border-border/70 px-3">
    <summary className="w-fit cursor-pointer py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Delegar trabajo a Novo</summary>
    <div className="space-y-4 pb-4">
      <p className="text-sm text-muted-foreground">Seguir un proyecto solo consulta fuentes. Aquí eliges si Novo puede trabajar en una carpeta y qué puede hacer. La automatización queda apagada hasta que la actives.</p>
      {assistant.status==='loading'&&<p role="status" className="text-sm text-muted-foreground">Cargando PCs, carpetas y tareas…</p>}
      {assistant.status==='error'&&<div role="alert" className="space-y-2"><p className="text-sm text-destructive">{assistant.error}</p><Button variant="outline" size="sm" onClick={()=>void assistant.refresh()}>Volver a cargar</Button></div>}
      <form onSubmit={event=>void save(event)} className="space-y-4">
        <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 text-sm font-semibold">PC y carpeta autorizados</legend>
          <label className="text-sm">Este PC<select value={deviceId} onChange={event=>{setDeviceId(event.target.value);setWorkspaceId('')}} className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3" disabled={!devices.length}><option value="">Elige un PC conectado</option>{devices.map(item=><option key={item.id} value={item.id}>{item.name}{item.canExecute?' · conectado':' · sin permiso de ejecución'}</option>)}</select></label>
          <label className="text-sm">Carpeta de trabajo<select value={workspaceId} onChange={event=>setWorkspaceId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3" disabled={!scopedWorkspaces.length}><option value="">Elige una carpeta autorizada</option>{scopedWorkspaces.map(item=><option key={item.id} value={item.id}>{item.name}{item.repository?` · ${item.repository}`:''}</option>)}</select></label>
        </fieldset>
        {!devices.length&&<p className="text-sm text-muted-foreground">Conecta Novo Companion y activa el permiso «Ejecutar trabajo local» para que este PC aparezca aquí.</p>}
        {device&&!device.canExecute&&<p className="text-sm text-muted-foreground">Este dispositivo no tiene permiso de ejecución. Puedes pausarlo aquí mientras actualizas Companion.</p>}
        {device?.canExecute&&!scopedWorkspaces.length&&<p className="text-sm text-muted-foreground">Selecciona una carpeta en el Companion para este proyecto.</p>}
        {device?.canExecute&&scopedWorkspaces.length>0&&<fieldset className="space-y-2"><legend className="mb-1 text-sm font-semibold">Permisos de ejecución</legend>{capabilities.map(capability=>{
          const available=device.capabilities.includes(capability)
          return <label key={capability} className={`flex items-start gap-2 rounded-lg border border-border/70 p-3 text-sm ${available?'':'opacity-60'}`}><input type="checkbox" checked={selectedCapabilities.includes(capability)} disabled={!available&&!selectedCapabilities.includes(capability)} onChange={()=>toggle(selectedCapabilities,setSelectedCapabilities,capability)} className="mt-0.5"/><span>{capabilityLabels[capability]}{!available&&<span className="block text-xs text-muted-foreground">No disponible en este PC ahora; Novo no intentará ejecutarlo.</span>}</span></label>
        })}</fieldset>}
        {selectedCapabilities.some(capability=>capability.endsWith('prepare_fix'))&&<label className="block text-sm">Comprobaciones requeridas, una por línea<input aria-label="Comprobaciones requeridas" value={verificationText} onChange={event=>setVerificationText(event.target.value)} placeholder={'test\nlint'} className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3"/><span className="mt-1 block text-xs text-muted-foreground">Son nombres de scripts de npm; Novo solo aceptará una propuesta si todos pasan.</span></label>}
        <fieldset className="space-y-2"><legend className="mb-1 text-sm font-semibold">Cuándo puede adelantarse</legend>{triggers.map(([value,label])=><label key={value} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedTriggers.includes(value)} onChange={()=>toggle(selectedTriggers,setSelectedTriggers,value)} />{label}</label>)}<p className="text-xs text-muted-foreground">Sin selección, Novo solo actuará cuando tú se lo pidas.</p></fieldset>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Máximo de trabajos automáticos por día<input type="number" min={1} max={10} value={dailyLimit} onChange={event=>setDailyLimit(Math.max(1,Math.min(10,Number(event.target.value)||1)))} className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3"/></label><label className="text-sm">Tu zona horaria<input value={timezone} onChange={event=>setTimezone(event.target.value)} maxLength={80} className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3"/></label></div>
        <label className="flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-sm"><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)} className="mt-0.5"/><span><span className="font-medium">Permitir que Novo realice estos trabajos</span><span className="block text-xs text-muted-foreground">Puedes pausarlo aquí. Cada tarea o cambio interno importante necesita su propia revisión.</span></span></label>
        <Button type="submit" variant={enabled?'default':'outline'} disabled={busy||!canSave}>{busy?'Guardando…':enabled?'Guardar y activar delegación':'Guardar permisos pausados'}</Button>
      </form>
      {enabled&&!canEnable&&<p role="alert" className="text-sm text-destructive">Para activar, elige un PC y carpeta disponibles, un permiso compatible y, para propuestas de código, al menos una comprobación.</p>}
      {notice&&<p role="status" className="text-sm text-muted-foreground">{notice}</p>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      {delegation?.enabled&&<form onSubmit={event=>void enqueue(event)} className="space-y-2 border-t border-border pt-4"><label htmlFor={`novo-work-objective-${memoryId}`} className="block text-sm font-semibold">Pedir un trabajo</label><textarea id={`novo-work-objective-${memoryId}`} value={objective} onChange={event=>setObjective(event.target.value)} required maxLength={480} rows={2} placeholder="Ej.: revisa por qué fallan las comprobaciones" className="w-full rounded-xl border border-input bg-background p-3 text-sm"/><p className="text-xs text-muted-foreground">Se limita a los permisos, el PC y la carpeta elegidos arriba.</p><Button type="submit" size="sm" disabled={busy||!objective.trim()||!selectedCapability}>Enviar al Companion</Button></form>}
      {jobs.length>0&&<div className="space-y-3 border-t border-border pt-4"><h4 className="text-sm font-semibold">Actividad de Novo</h4>{jobs.map(work=><ProjectWorkCard key={work.id} work={work} devices={devices}/>)}</div>}
    </div>
  </details>
}
