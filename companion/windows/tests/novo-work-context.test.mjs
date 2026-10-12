import test from 'node:test';
import assert from 'node:assert/strict';
import { Bridge } from '../src/core/bridge.ts';
import { calls, sent } from './tauri.mjs';

test('current work note bridge uses only explicit Novo work-context commands', async () => {
  calls.length = 0;
  await Bridge.novoWorkContextGet();
  await Bridge.novoWorkContextSave({ projectLabel: 'Novo Companion', focusSummary: 'Finish the account connection' });
  await Bridge.novoWorkContextClear();

  assert.deepEqual(sent('companion_work_context_get'), [{}]);
  assert.deepEqual(sent('companion_work_context_save'), [{ input: { projectLabel: 'Novo Companion', focusSummary: 'Finish the account connection' } }]);
  assert.deepEqual(sent('companion_work_context_clear'), [{}]);
});
