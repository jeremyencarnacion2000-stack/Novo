import test from 'node:test';
import assert from 'node:assert/strict';
import {requestCompanionAuthorization} from '../src/core/authorization-start.ts';

const details={origin:'https://novo.test',deviceName:'My PC'};
test('browser authorization explicitly permits replacing this PCs old binding even without a local credential',async()=>{
  const events=[];
  const result=await requestCompanionAuthorization(details,message=>{
    events.push('confirm');
    assert.match(message,/cuenta que elijas/);
    assert.match(message,/acceso anterior/);
    assert.match(message,/trabajos/);
    return true;
  },async options=>{events.push('start');assert.deepEqual(options,{...details,reconnect:true});return {userCode:'fixture'};});
  assert.deepEqual(events,['confirm','start']);
  assert.deepEqual(result,{userCode:'fixture'});
});
test('declining the connection confirmation creates no authorization or replacement',async()=>{
  let calls=0;
  const result=await requestCompanionAuthorization(details,()=>false,async()=>{calls++;return {};});
  assert.equal(result,null);
  assert.equal(calls,0);
});
test('a failed start remains an error and does not retry or claim success',async()=>{
  let calls=0;
  await assert.rejects(requestCompanionAuthorization(details,()=>true,async()=>{calls++;throw new Error('offline');}),/offline/);
  assert.equal(calls,1);
});
