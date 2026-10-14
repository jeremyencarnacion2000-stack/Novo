import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import {SettingsProjectAssistant} from '../settings-project-assistant'
jest.mock('next-auth/react',()=>({useSession:()=>({data:{user:{id:'owner-test'}},status:'authenticated'})}))
const memory={id:'m1',title:'Novo',trackingMode:'on',tracked:true,revision:2,correction:null,taskCount:2,blockerCount:1,nextStep:'Revisar el bloqueo detectado',updatedAt:'2026-10-12T18:00:00Z',sources:[{kind:'github',sourceKey:'owner/novo',repository:'owner/novo',observedAt:'2026-10-12T18:00:00Z',fresh:false,available:true}]}
const response=(body:unknown,status=200)=>({ok:status===200,status,json:async()=>body})
const fetchMock=jest.fn()
beforeEach(()=>{fetchMock.mockReset();global.fetch=fetchMock;fetchMock.mockImplementation((url:string)=>Promise.resolve(url==='/api/project-assistant/work'?response({work:[],delegations:[],devices:[],workspaces:[]}):response({memories:[memory],refresh:{background:'unavailable',intervalMinutes:15}})))})
test('loads actual following/freshness and keeps configuration reachable in a vertical layout',async()=>{
  render(<SettingsProjectAssistant/>);expect(screen.getByText('Cargando seguimiento…')).toBeInTheDocument()
  await screen.findByText('Novo');expect(screen.getByText(/Última evidencia guardada/)).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Pausar seguimiento de Novo'})).toBeInTheDocument()
  fireEvent.click(screen.getByText('Revisar memoria'))
  expect(screen.getByLabelText('Corrección para Novo')).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Olvidar memoria de Novo'})).toBeInTheDocument()
})
test('a correction conflict preserves the draft and offers reload',async()=>{
  render(<SettingsProjectAssistant/>);await screen.findByText('Novo')
  fireEvent.click(screen.getByText('Revisar memoria'))
  fireEvent.change(screen.getByLabelText('Corrección para Novo'),{target:{value:'Mi proyecto principal'}})
  fetchMock.mockResolvedValueOnce(response({error:'revision_conflict'},409))
  fireEvent.click(screen.getByRole('button',{name:'Guardar corrección'}))
  await screen.findByText('La información cambió. Recarga el seguimiento y revisa tu corrección antes de guardarla.')
  expect(screen.getByLabelText('Corrección para Novo')).toHaveValue('Mi proyecto principal')
  expect(fetchMock).toHaveBeenLastCalledWith('/api/project-assistant/m1',expect.objectContaining({method:'PUT',body:JSON.stringify({revision:2,correction:'Mi proyecto principal'})}))
})
test.each([401,503])('auth and service errors have a recovery action (%s)',async(status)=>{
  fetchMock.mockResolvedValue(response({},status));render(<SettingsProjectAssistant/>);
  await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Volver a cargar'})).toBeInTheDocument()
})
test('empty state explains how to start without inventing projects',async()=>{
  fetchMock.mockResolvedValue(response({memories:[],refresh:{background:'unavailable',intervalMinutes:15}}));render(<SettingsProjectAssistant/>);
  await screen.findByText('Actualiza las fuentes para empezar a seguir tus proyectos.')
})
