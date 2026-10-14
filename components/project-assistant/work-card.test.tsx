import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import {ProjectWorkCard} from './work-card'
import {useProjectAssistant} from '@/hooks/use-project-assistant'
jest.mock('next-auth/react',()=>({useSession:()=>({data:{user:{id:'owner-test'}},status:'authenticated'})}))

const work:any={id:'8a52e7c9-6c5f-4747-80e9-1c83b2fb6d65',memoryId:'memory-1',deviceId:'device-1',workspaceId:'workspace-1',capability:'project.diagnose',objective:'Diagnosticar despliegue',phase:'completed',revision:4,sequence:2,mode:'manual',reasonCode:'diagnosis_ready',result:{summary:'El proyecto está listo.',artifactId:'beea1d70-c68a-43f5-b261-9ce6ea94248b',baseCommit:'a'.repeat(40),changedPaths:['app/page.tsx','lib/check.ts'],verification:{status:'passed',checks:[{script:'lint',exitCode:0}]}},decision:null,createdAt:'2026-10-13T12:00:00Z',updatedAt:'2026-10-13T12:00:00Z',startedAt:'2026-10-13T12:00:00Z',finishedAt:'2026-10-13T12:01:00Z'}
const pending={version:1,state:'pending',requestId:'4c5ef56b-c9b1-45c5-8ad2-d625930e5b43',fingerprint:'f'.repeat(64),operation:{kind:'task.create',title:'Diagnosticar despliegue',category:'Work',priority:'medium'},proposedAt:'2026-10-13T12:00:00Z',expiresAt:'2026-10-14T12:00:00Z'}
const response=(body:unknown)=>({ok:true,status:200,json:async()=>body})
const fetchMock=jest.fn()
function WorkHarness(){const state=useProjectAssistant();return <ProjectWorkCard work={state.work[0]??work} devices={state.devices}/>}
beforeEach(()=>{fetchMock.mockReset();global.fetch=fetchMock;fetchMock.mockResolvedValue(response({work:[work],delegations:[],devices:[],workspaces:[]}))})

test('a prepared typed action waits for review and sends exact arguments only after confirmation',async()=>{
  fetchMock.mockResolvedValueOnce(response({work:[work],delegations:[],devices:[],workspaces:[]}))
  fetchMock.mockResolvedValueOnce(response({work:{...work,phase:'awaiting_confirmation',revision:5,decision:pending}}))
  fetchMock.mockResolvedValueOnce(response({work:[{...work,phase:'awaiting_confirmation',revision:5,decision:pending}],delegations:[],devices:[],workspaces:[]}))
  fetchMock.mockResolvedValueOnce(response({work:{...work,revision:6,decision:{...pending,state:'applied',decision:'confirm'}}}))
  fetchMock.mockResolvedValueOnce(response({work:[{...work,revision:6,decision:{...pending,state:'applied',decision:'confirm'}}],delegations:[],devices:[],workspaces:[]}))
  render(<WorkHarness/>);await screen.findByText('El proyecto está listo.')
  fireEvent.click(screen.getByText('Preparar una acción en Novo'))
  expect(screen.queryByRole('button',{name:'Confirmar y guardar'})).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Preparar para revisar'}))
  await screen.findByRole('region',{name:'Acción pendiente de aprobación'})
  expect(fetchMock).toHaveBeenNthCalledWith(2,`/api/project-assistant/work/${work.id}/decision`,expect.objectContaining({method:'POST'}))
  fireEvent.click(screen.getByRole('button',{name:'Confirmar y guardar'}))
  await waitFor(()=>expect(fetchMock).toHaveBeenNthCalledWith(4,`/api/project-assistant/work/${work.id}/decision`,expect.objectContaining({method:'PATCH',body:JSON.stringify({revision:5,requestId:pending.requestId,fingerprint:pending.fingerprint,decision:'confirm'})})))
})

test('shows which PC is expected and keeps cancel available only while active',async()=>{
  const activeWork={...work,phase:'waiting_device'}
  render(<ProjectWorkCard work={activeWork} devices={[{id:activeWork.deviceId,name:'Mi PC',capabilities:['project.diagnose'],lastSeenAt:null,canExecute:true}]}/>);
  expect(await screen.findByText(/Lo ejecuta Mi PC/)).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Cancelar'})).toBeInTheDocument()
})

test('keeps the verified file list and local artifact reference available in persisted history',async()=>{
  render(<ProjectWorkCard work={work} devices={[{id:work.deviceId,name:'PC de trabajo',capabilities:['project.diagnose'],lastSeenAt:null,canExecute:true}]}/>);
  fireEvent.click(screen.getByText('Ver archivos y comprobaciones'))
  expect(screen.getByText('app/page.tsx')).toBeInTheDocument()
  expect(screen.getByText('Comprobaciones: correctas')).toBeInTheDocument()
  expect(screen.getByText(/Referencia del artefacto local en PC de trabajo/)).toBeInTheDocument()
  expect(screen.getByText('a'.repeat(12))).toBeInTheDocument()
})
