import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import {DelegationControls} from './delegation-controls'
jest.mock('next-auth/react',()=>({useSession:()=>({data:{user:{id:'owner-test'}},status:'authenticated'})}))

const memoryId='9e6dcf91-5016-4d9a-b935-cff946365c6c'
const deviceId='38a62636-07f0-48d2-b8e8-ebd2ec0227b2'
const workspaceId='19f18caf-c7f1-47f9-bd9b-d5111b84f531'
const fetchMock=jest.fn()
const workSnapshot={work:[],delegations:[],devices:[],workspaces:[]}
const response=(body:unknown)=>({ok:true,status:200,json:async()=>body})
beforeAll(()=>{(global as any).IS_REACT_ACT_ENVIRONMENT=true})
beforeEach(()=>{fetchMock.mockReset();global.fetch=fetchMock;fetchMock.mockResolvedValue(response(workSnapshot))})

test('makes execution separate from project following and keeps automatic triggers off until chosen',async()=>{
  render(<DelegationControls memoryId={memoryId} devices={[{id:deviceId,name:'Mi PC',capabilities:['project.diagnose'],lastSeenAt:'2026-10-13T12:00:00Z',canExecute:true}]} workspaces={[{id:workspaceId,memoryId,name:'Novo',deviceId,repository:'angel/novo'}]}/>);fireEvent.click(screen.getByText('Delegar trabajo a Novo'))
  const active=screen.getByRole('checkbox',{name:/Permitir que Novo realice estos trabajos/})
  expect(active).not.toBeChecked()
  expect(screen.getByRole('checkbox',{name:'Falla en comprobaciones'})).not.toBeChecked()
  expect(screen.getByText('Seguir un proyecto solo consulta fuentes. Aquí eliges si Novo puede trabajar en una carpeta y qué puede hacer. La automatización queda apagada hasta que la actives.')).toBeInTheDocument()
  fireEvent.click(active)
  fireEvent.click(screen.getByRole('checkbox',{name:'Falla en comprobaciones'}))
  fireEvent.click(screen.getByRole('button',{name:'Guardar y activar delegación'}))
  await waitFor(()=>expect(fetchMock).toHaveBeenCalledWith('/api/project-assistant/delegations',expect.objectContaining({method:'POST'})))
  expect(await screen.findByText('La delegación quedó activa con estos permisos.')).toBeInTheDocument()
  const body=JSON.parse(fetchMock.mock.calls.find(([url])=>url==='/api/project-assistant/delegations')![1].body as string)
  expect(body).toMatchObject({memoryId,deviceId,workspaceId,enabled:true,capabilities:['project.diagnose'],triggers:['ci_failure']})
  expect(body.version).toBe(0)
})

test('does not offer automatic execution when the selected PC has no execution grant',()=>{
  render(<DelegationControls memoryId={memoryId} devices={[{id:deviceId,name:'PC desconectado',capabilities:[],lastSeenAt:null,canExecute:false}]} workspaces={[]}/>);fireEvent.click(screen.getByText('Delegar trabajo a Novo'))
  expect(screen.getByText(/no tiene permiso de ejecución/)).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Guardar permisos pausados'})).toBeDisabled()
})
