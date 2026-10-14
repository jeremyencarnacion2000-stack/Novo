'use client'

import {useCallback,useSyncExternalStore} from 'react'
import {useSession} from 'next-auth/react'

export type ProjectWorkRecord={
  id:string;memoryId:string;deviceId:string;workspaceId:string;capability:string;objective:string
  phase:string;revision:number;sequence:number;mode:string;reasonCode:string|null;result:unknown;decision:unknown
  createdAt:string;updatedAt:string;startedAt:string|null;finishedAt:string|null;resultStale?:boolean
}
export type ProjectWorkDelegation={id:string;memoryId:string;deviceId:string;workspaceId:string;enabled:boolean;version:number;capabilities:string[];triggers:string[];dailyLimit:number;timezone:string;verification:unknown[];timeoutSeconds:number}
export type ProjectWorkDevice={id:string;name:string;capabilities:string[];lastSeenAt:string|null;canExecute:boolean}
export type ProjectWorkspace={id:string;memoryId:string;name:string;deviceId:string;repository:string|null}
export type ProjectAssistantSnapshot={work:ProjectWorkRecord[];delegations:ProjectWorkDelegation[];devices:ProjectWorkDevice[];workspaces:ProjectWorkspace[];status:'loading'|'ready'|'error';error:string|null}

const empty:ProjectAssistantSnapshot={work:[],delegations:[],devices:[],workspaces:[],status:'loading',error:null}
const url='/api/project-assistant/work'
const successDelay=20_000
const maximumFailureDelay=90_000
type Listener=()=>void
export class ProjectAssistantMutationError extends Error {
  constructor(readonly code:string,message:string){super(message);this.name='ProjectAssistantMutationError'}
}
type Store={snapshot:ProjectAssistantSnapshot;listeners:Set<Listener>;controller:AbortController|null;timer:ReturnType<typeof setTimeout>|null;inFlight:Promise<void>|null;failures:number;generation:number;visibility:()=>void}
const stores=new Map<string,Store>()

function store(ownerKey='anonymous'){
  let current=stores.get(ownerKey)
  if(!current){current={snapshot:empty,listeners:new Set(),controller:null,timer:null,inFlight:null,failures:0,generation:0,visibility:()=>{}};stores.set(ownerKey,current)}
  return current
}
function publish(current:Store,snapshot:ProjectAssistantSnapshot){current.snapshot=snapshot;for(const listener of current.listeners)listener()}
function clearTimer(current:Store){if(current.timer)clearTimeout(current.timer);current.timer=null}
function schedule(current:Store,delay:number){
  clearTimer(current)
  if(!current.listeners.size||typeof document!=='undefined'&&document.visibilityState==='hidden')return
  current.timer=setTimeout(()=>{current.timer=null;void load(current)},delay)
}
function subscribe(current:Store,listener:Listener,authenticated:boolean){
  current.listeners.add(listener)
  if(current.listeners.size===1&&authenticated){
    current.visibility=()=>{if(typeof document==='undefined')return;if(document.visibilityState==='hidden')clearTimer(current);else void load(current)}
    if(typeof document!=='undefined')document.addEventListener('visibilitychange',current.visibility)
    void load(current)
  }
  return()=>{
    current.listeners.delete(listener)
    if(!current.listeners.size){clearTimer(current);current.generation++;current.controller?.abort();current.controller=null;current.inFlight=null;if(typeof document!=='undefined')document.removeEventListener('visibilitychange',current.visibility)}
  }
}
async function load(current=store()):Promise<void>{
  if(current.inFlight&&current.controller?.signal.aborted){current.inFlight=null;current.controller=null}
  if(current.inFlight)return current.inFlight
  const controller=new AbortController(),generation=++current.generation;current.controller=controller
  if(current.snapshot.work.length===0&&current.snapshot.status!=='error')publish(current,{...current.snapshot,status:'loading',error:null})
  current.inFlight=(async()=>{
    try{
      const response=await fetch(url,{cache:'no-store',signal:controller.signal})
      if(!response.ok)throw new Error(response.status===401?'Inicia sesión para ver el trabajo de Novo.':'No se pudo cargar el trabajo de Novo.')
      const value=await response.json() as Partial<ProjectAssistantSnapshot>
      for(const key of ['work','delegations','devices','workspaces'] as const)if(!Array.isArray(value[key]))throw new Error('La respuesta del trabajo de Novo no es válida.')
      current.failures=0
      publish(current,{work:value.work!,delegations:value.delegations!,devices:value.devices!,workspaces:value.workspaces!,status:'ready',error:null})
    }catch(error){
      if(controller.signal.aborted)return
      current.failures++
      publish(current,{...current.snapshot,status:'error',error:error instanceof Error?error.message:'No se pudo cargar el trabajo de Novo.'})
    }finally{
      if(current.generation!==generation)return
      if(current.controller===controller)current.controller=null
      current.inFlight=null
      if(current.listeners.size){const delay=current.failures?Math.min(maximumFailureDelay,successDelay*2**Math.min(current.failures,3)):successDelay;schedule(current,delay)}
    }
  })()
  return current.inFlight
}
function requestId(){
  const cryptographic=(globalThis as any).crypto as Crypto|undefined
  if(!cryptographic)throw new Error('No se pudo generar una solicitud segura.')
  if(typeof (cryptographic as any).randomUUID==='function')return (cryptographic as any).randomUUID() as string
  const bytes=new Uint8Array(16);cryptographic.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128
  return [...bytes].map((byte,index)=>`${[4,6,8,10].includes(index)?'-':''}${byte.toString(16).padStart(2,'0')}`).join('')
}
async function mutate(current:Store,path:string,init:RequestInit){
  const response=await fetch(path,{...init,headers:{'Content-Type':'application/json',...init.headers}})
  if(!response.ok){
    let code=''
    try{const payload=await response.json() as {error?:unknown};if(typeof payload.error==='string')code=payload.error}catch{}
    if(response.status===409){const olderRequest=current.inFlight;if(olderRequest)await olderRequest;await load(current)}
    const message=code==='result_stale'?'Este resultado quedó desactualizado. Solicita uno nuevo para revisar una acción vigente.':response.status===401?'Inicia sesión para guardar cambios.':response.status===409?'El trabajo cambió. Actualizamos el estado; revisa la nueva versión antes de intentarlo.':'No se pudo guardar el cambio.'
    throw new ProjectAssistantMutationError(code||String(response.status),message)
  }
  const olderRequest=current.inFlight
  if(olderRequest)await olderRequest
  await load(current)
}

export function useProjectAssistant(){
  const {data:session,status:authStatus}=useSession()
  const ownerId=authStatus==='authenticated'?session?.user?.id:undefined
  const current=store(ownerId??'anonymous'),authenticated=Boolean(ownerId)
  const subscribeCurrent=useCallback((listener:Listener)=>subscribe(current,listener,authenticated),[current,authenticated])
  const storedSnapshot=useSyncExternalStore(subscribeCurrent,()=>current.snapshot,()=>empty)
  const snapshot=authStatus==='loading'?empty:authStatus==='unauthenticated'||!ownerId?{...empty,status:'error' as const,error:'Inicia sesión para ver el trabajo de Novo.'}:storedSnapshot
  return {
    ...snapshot,
    refresh:()=>load(current),
    cancel:async(id:string,revision:number)=>mutate(current,`${url}/${encodeURIComponent(id)}`,{method:'DELETE',body:JSON.stringify({revision})}),
    prepareAction:async(id:string,revision:number,operation:unknown)=>mutate(current,`${url}/${encodeURIComponent(id)}/decision`,{method:'POST',body:JSON.stringify({revision,requestId:requestId(),operation})}),
    decideAction:async(id:string,input:{revision:number;requestId:string;fingerprint:string;decision:'confirm'|'deny'})=>mutate(current,`${url}/${encodeURIComponent(id)}/decision`,{method:'PATCH',body:JSON.stringify(input)}),
    saveDelegation:async(input:unknown)=>mutate(current,'/api/project-assistant/delegations',{method:'POST',body:JSON.stringify(input)}),
    enqueue:async(input:{memoryId:string;capability:string;objective:string})=>mutate(current,url,{method:'POST',body:JSON.stringify({...input,requestId:requestId()})}),
  }
}
