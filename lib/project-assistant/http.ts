import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import {ProjectAssistantError} from './contracts'

export const projectAssistantJson=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}})
export function projectAssistantErrorResponse(error:unknown) {
  return error instanceof ProjectAssistantError?projectAssistantJson({error:error.code},error.status):projectAssistantJson({error:'project_assistant_unavailable'},503)
}
export async function requireProjectAssistantSession() {
  const session=await getServerSession(authOptions)
  if(!session?.user?.id)throw new ProjectAssistantError(401,'unauthorized')
  return session.user.id
}
export async function readProjectAssistantJson(request:Request,limit=32_768):Promise<unknown> {
  if(Number(request.headers.get('Content-Length'))>limit)throw new ProjectAssistantError(413,'payload_too_large')
  if(!request.body)throw new ProjectAssistantError(400,'invalid_request')
  const reader=request.body.getReader(),chunks:Uint8Array[]=[]
  let size=0
  try{
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new ProjectAssistantError(413,'payload_too_large')}chunks.push(value)}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
    try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new ProjectAssistantError(400,'invalid_request')}
  }finally{reader.releaseLock()}
}
