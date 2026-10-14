'use client'

import Link from 'next/link'
import {ListTodo} from 'lucide-react'
import {useProjectAssistant} from '@/hooks/use-project-assistant'
import {Button} from '@/components/ui/button'
import {ProjectWorkCard} from './work-card'

export function ProjectWorkLink(){
  const assistant=useProjectAssistant()
  const active=assistant.work.filter(work=>['pending','waiting_device','running','awaiting_confirmation','uncertain'].includes(work.phase)).length
  return <Link href="/activity" aria-label={active?`Trabajos de Novo: ${active} pendientes`:'Ver trabajos de Novo'} title="Ver actividad de Novo" className="relative inline-flex size-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white">
    <ListTodo className="size-4" aria-hidden="true"/>{active>0&&<span aria-hidden="true" className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-4 text-primary-foreground">{active>9?'9+':active}</span>}
  </Link>
}

export function ProjectAssistantActivity(){
  const assistant=useProjectAssistant()
  return <section aria-label="Trabajos de Novo" className="mt-8 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Trabajos de Novo</h2><p className="mt-1 text-sm text-muted-foreground">El mismo estado aparece en los ajustes y se recupera al volver a abrir Novo.</p></div><Button variant="outline" onClick={()=>void assistant.refresh()}>Actualizar</Button></div>
    {assistant.status==='loading'&&<p role="status" className="text-sm text-muted-foreground">Cargando trabajos…</p>}
    {assistant.status==='error'&&<div role="alert" className="space-y-2 rounded-2xl border border-border p-4"><p className="text-sm text-destructive">{assistant.error}</p><Button variant="outline" size="sm" onClick={()=>void assistant.refresh()}>Reintentar</Button></div>}
    {assistant.status==='ready'&&!assistant.work.length&&<div className="rounded-2xl border border-dashed border-border p-5"><p className="text-sm">Todavía no hay trabajos de Novo.</p><Link href="/settings" className="mt-2 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline">Revisar permisos en Ajustes</Link></div>}
    <ul className="space-y-3">{assistant.work.map(work=><li key={work.id}><ProjectWorkCard work={work} devices={assistant.devices}/></li>)}</ul>
  </section>
}
