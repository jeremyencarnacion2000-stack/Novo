import {render,screen,waitFor} from '@testing-library/react'
import {useProjectAssistant} from '../use-project-assistant'
let mockOwnerId='owner-test',mockAuthStatus='authenticated'
jest.mock('next-auth/react',()=>({useSession:()=>({data:mockAuthStatus==='authenticated'?{user:{id:mockOwnerId}}:null,status:mockAuthStatus})}))

const work={id:'job-1',memoryId:'memory-1',deviceId:'device-1',workspaceId:'workspace-1',capability:'project.diagnose',objective:'Revisar la falla',phase:'running',revision:3,sequence:2,mode:'manual',reasonCode:null,result:null,decision:null,createdAt:'2026-10-13T12:00:00Z',updatedAt:'2026-10-13T12:00:00Z',startedAt:'2026-10-13T12:00:00Z',finishedAt:null}
const fetchMock=jest.fn()
function Consumer({label}:{label:string}){const state=useProjectAssistant();return <output aria-label={label}>{state.work[0]?.phase??state.status}</output>}
function SessionConsumer(){const state=useProjectAssistant();return <output aria-label="session">{state.error??state.status}</output>}
beforeEach(()=>{mockOwnerId='owner-test';mockAuthStatus='authenticated';fetchMock.mockReset();global.fetch=fetchMock;fetchMock.mockResolvedValue({ok:true,status:200,json:async()=>({work:[work],delegations:[],devices:[],workspaces:[]})})})

test('two surfaces share one canonical owner-scoped subscription and job state',async()=>{
  render(<><Consumer label="chat"/><Consumer label="actividad"/></>)
  await waitFor(()=>expect(screen.getByLabelText('chat')).toHaveTextContent('running'))
  expect(screen.getByLabelText('actividad')).toHaveTextContent('running')
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledWith('/api/project-assistant/work',{cache:'no-store',signal:expect.any(AbortSignal)})
})

test('cancelling uses the persisted revision then refreshes the shared record',async()=>{
  fetchMock.mockResolvedValueOnce({ok:true,status:200,json:async()=>({work:[work],delegations:[],devices:[],workspaces:[]})})
  fetchMock.mockResolvedValueOnce({ok:true,status:200,json:async()=>({cancelled:true})})
  fetchMock.mockResolvedValueOnce({ok:true,status:200,json:async()=>({work:[{...work,phase:'cancelled',revision:4}],delegations:[],devices:[],workspaces:[]})})
  function Controls(){const state=useProjectAssistant();return <button onClick={()=>void state.cancel('job-1',3)}>Cancel job</button>}
  render(<><Consumer label="chat"/><Controls/></>)
  await screen.findByText('running')
  screen.getByRole('button',{name:'Cancel job'}).click()
  await waitFor(()=>expect(screen.getByLabelText('chat')).toHaveTextContent('cancelled'))
  expect(fetchMock).toHaveBeenNthCalledWith(2,'/api/project-assistant/work/job-1',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:3})})
})

test('a stale write conflict reloads canonical work before showing the error',async()=>{
  fetchMock.mockResolvedValueOnce({ok:true,status:200,json:async()=>({work:[work],delegations:[],devices:[],workspaces:[]})})
  fetchMock.mockResolvedValueOnce({ok:false,status:409,json:async()=>({error:'revision_conflict'})})
  fetchMock.mockResolvedValueOnce({ok:true,status:200,json:async()=>({work:[{...work,phase:'completed',revision:4}],delegations:[],devices:[],workspaces:[]})})
  function Controls(){const state=useProjectAssistant();return <><output aria-label="phase">{state.work[0]?.phase}</output><button onClick={()=>void state.cancel('job-1',3).catch(()=>{})}>Cancel job</button></>}
  render(<Controls/>);await screen.findByText('running')
  screen.getByRole('button',{name:'Cancel job'}).click()
  await waitFor(()=>expect(screen.getByLabelText('phase')).toHaveTextContent('completed'))
  expect(fetchMock).toHaveBeenCalledTimes(3)
})

test('cached work never crosses to a different signed-in account',async()=>{
  const userA={...work,objective:'Privado de A'},userB={...work,id:'job-b',objective:'Privado de B'}
  fetchMock.mockResolvedValueOnce({ok:true,status:200,json:async()=>({work:[userA],delegations:[],devices:[],workspaces:[]})})
  fetchMock.mockResolvedValueOnce({ok:true,status:200,json:async()=>({work:[userB],delegations:[],devices:[],workspaces:[]})})
  function Identity(){const state=useProjectAssistant();return <output aria-label="trabajo">{state.work[0]?.objective??'vacío'}</output>}
  const view=render(<Identity/>);expect(await screen.findByText('Privado de A')).toBeInTheDocument()
  mockOwnerId='owner-b';view.rerender(<Identity/>)
  expect(screen.queryByText('Privado de A')).not.toBeInTheDocument()
  expect(await screen.findByText('Privado de B')).toBeInTheDocument()
})

test('authentication loading and sign-out never trigger a private work request',()=>{
  mockAuthStatus='unauthenticated';render(<SessionConsumer/>);expect(screen.getByLabelText('session')).toHaveTextContent('Inicia sesión para ver el trabajo de Novo.')
  expect(fetchMock).not.toHaveBeenCalled()
})
