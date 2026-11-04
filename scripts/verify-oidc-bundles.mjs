import assert from 'node:assert/strict';
import {cpSync,mkdirSync,mkdtempSync,realpathSync,rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=realpathSync(fileURLToPath(new URL('../',import.meta.url)));
mkdirSync(path.join(root,'.tmp'),{recursive:true});
const scratch=realpathSync(path.join(root,'.tmp'));
assert(scratch.startsWith(root+path.sep),'Test scratch directory must stay in this checkout');
const fixture=mkdtempSync(path.join(scratch,'oidc-bundle-'));
try{
  cpSync(path.join(root,'tests/fixtures/oidc-bundles'),fixture,{recursive:true});
  const env={...process.env,NEXTAUTH_URL:'https://novo.test',NEXTAUTH_SECRET:'fixture-only',OIDC_JWKS_JSON:'',
    DATABASE_URL:'postgresql://fixture.invalid/fixture',NOVO_OIDC_TEST_STORE:path.join(fixture,'fixture-records.json')};
  for(const [args,cwd] of [
    [['--max-old-space-size=3072',path.join(root,'node_modules/next/dist/bin/next'),'build','--webpack',fixture],root],
    [[path.join(fixture,'probe.cjs')],fixture],
  ]){
    const child=spawnSync(process.execPath,args,{cwd,env,stdio:'inherit',timeout:180000});
    if(child.error)throw child.error;
    assert.equal(child.status,0,'Compiled OAuth session regression failed');
  }
}finally{
  assert.equal(path.dirname(realpathSync(fixture)),scratch,'Cleanup target escaped the test directory');
  rmSync(fixture,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
