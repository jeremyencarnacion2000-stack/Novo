const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
  const fixture=process.cwd();
  const issue=await require(path.join(fixture,'.next/server/pages/api/issue.js'));
  const verify=await require(path.join(fixture,'.next/server/app/api/verify/route.js'));
  for(const scenario of ['valid','missing_session','expired_session','wrong_owner','wrong_grant']){
    let token;
    await issue.default({query:{scenario}},{json(value){token=value.access_token;}});
    assert.equal(typeof token,'string');
    const response=await verify.routeModule.userland.GET(new Request('https://novo.test/api/verify',{headers:{authorization:`Bearer ${token}`}}));
    const result=await response.json();
    assert.equal(response.status,scenario==='valid'?200:401,`${scenario}: unexpected authorization status`);
    assert.equal(result.valid,scenario==='valid');
    if(scenario==='valid')assert.equal(result.scopes,6);
    console.log(`OAuth compiled bundles: ${scenario} passed`);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
