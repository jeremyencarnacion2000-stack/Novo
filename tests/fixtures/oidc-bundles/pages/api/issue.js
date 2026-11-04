import {getOidcProvider} from '@/lib/mcp/oidc-provider';
export default async function handler(request,response){
  const scenario=request.query.scenario;
  const provider=getOidcProvider(),scope='device:connect ai:chat tasks:read tasks:write device:desktop:read device:desktop:control';
  const grant=new provider.Grant({accountId:'fixture-owner',clientId:'fixture-client'});
  grant.addOIDCScope(scope);
  const grantId=await grant.save();
  const session=new provider.Session({accountId:scenario==='wrong_owner'?'fixture-other':'fixture-owner'});
  session.grantIdFor('fixture-client',scenario==='wrong_grant'?'fixture-other-grant':grantId);
  await session.save(scenario==='expired_session'?-60:3600);
  const token=new provider.AccessToken({accountId:'fixture-owner',clientId:'fixture-client',grantId,scope,expiresWithSession:true,sessionUid:scenario==='missing_session'?'fixture-missing-session':session.uid});
  token.setAudience('https://novo.test/api/mcp');
  response.json({access_token:await token.save()});
}
