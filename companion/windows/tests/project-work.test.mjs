import test from 'node:test';
import assert from 'node:assert/strict';
import { Bridge } from '../src/core/bridge.ts';
import { runtimeLabel } from '../src/core/project-work.ts';
import { calls, sent } from './tauri.mjs';
test('availability queries do not start work or expose CLI credentials', async () => {
  calls.length=0;
  await Bridge.projectWorkRuntimes();
  assert.deepEqual(sent('project_work_runtimes'),[{}]);
  assert.equal(calls.length,1);
});
test('unsupported sandbox and missing runtime are explicit',()=>{
  assert.match(runtimeLabel({capability:'codex.prepare_fix',available:false,reason:'unsupported_sandbox',version:null}),/aislamiento/i);
  assert.match(runtimeLabel({capability:'claude.prepare_fix',available:false,reason:'runtime_unavailable',version:null}),/disponible/i);
  assert.match(runtimeLabel({capability:'project.diagnose',available:true,reason:null,version:null}),/estado local/i);
});
