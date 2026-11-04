import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizationPollFailure} from '../src/core/authorization-poll.ts';

test('a rejected candidate stops polling before it becomes a misleading missing-authorization error',()=>{
  for(const code of ['expired','unauthorized','revoked','permission_required']){
    assert.match(authorizationPollFailure(code),/Novo rechazó/);
    assert.equal(authorizationPollFailure(code),authorizationPollFailure({code,message:'private provider response'}));
  }
});
test('finished attempts and protected-storage failures have distinct explanations',()=>{
  assert.match(authorizationPollFailure('authorization_not_pending'),/intento ya terminó/);
  assert.match(authorizationPollFailure('credential_store_unavailable'),/guardado protegido/);
  for(const code of ['settings_unavailable','settings_save_failed'])assert.match(authorizationPollFailure(code),/ajustes/);
});
test('temporary failures keep the pending flow and never display raw provider errors',()=>{
  for(const error of ['authorization_unavailable','offline','rate_limited',new Error('private provider body')]){
    assert.equal(authorizationPollFailure(error),null);
  }
});
