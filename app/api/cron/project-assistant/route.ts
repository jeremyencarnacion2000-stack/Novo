import {NextRequest,NextResponse} from 'next/server'
import {refreshProjectAssistantBatch} from '@/lib/project-assistant/refresh'
export const dynamic='force-dynamic'
export const maxDuration=300
export async function GET(request:NextRequest){
  const secret=process.env.CRON_SECRET
  if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401})
  try{return NextResponse.json({success:true,...await refreshProjectAssistantBatch()})}catch{return NextResponse.json({error:'Refresh unavailable'},{status:503})}
}
