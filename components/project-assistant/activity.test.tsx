import {render,screen} from '@testing-library/react'
import {ProjectAssistantActivity,ProjectWorkLink} from './activity'
jest.mock('next-auth/react',()=>({useSession:()=>({data:{user:{id:'owner-test'}},status:'authenticated'})}))

const fetchMock=jest.fn()
beforeEach(()=>{fetchMock.mockReset();global.fetch=fetchMock;fetchMock.mockResolvedValue({ok:true,status:200,json:async()=>({work:[{id:'job-1',memoryId:'memory-1',deviceId:'device-1',workspaceId:'workspace-1',capability:'project.diagnose',objective:'Revisar Novo',phase:'waiting_device',revision:1,sequence:1,mode:'manual',reasonCode:null,result:null,decision:null,createdAt:'2026-10-14T12:00:00Z',updatedAt:'2026-10-14T12:00:00Z',startedAt:null,finishedAt:null}],delegations:[],devices:[],workspaces:[]})})})

test('chat can open the one shared activity surface and shows the pending count',async()=>{
  render(<ProjectWorkLink/>);const link=await screen.findByRole('link',{name:'Trabajos de Novo: 1 pendientes'})
  expect(link).toHaveAttribute('href','/activity')
})

test('activity surfaces the same persisted job with its actual status',async()=>{
  render(<ProjectAssistantActivity/>);expect(await screen.findByText('Revisar Novo')).toBeInTheDocument()
  expect(screen.getByLabelText('Estado: Esperando tu PC')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith('/api/project-assistant/work',expect.objectContaining({cache:'no-store'}))
})
