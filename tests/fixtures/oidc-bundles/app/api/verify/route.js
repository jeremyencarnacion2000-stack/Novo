import {requireCompanionOAuth} from '@/lib/companion/auth';
export const dynamic='force-dynamic';
export async function GET(request){try{const actor=await requireCompanionOAuth(request,['device:connect','ai:chat']);return Response.json({valid:actor.userId==='fixture-owner',scopes:actor.scopes.size});}catch(error){return Response.json({valid:false,code:error.code},{status:error.status||500});}}
