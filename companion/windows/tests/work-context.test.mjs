import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNovoWorkContextInput } from '../src/core/novo-work-context.ts';

test('normalizes only a concise user-entered project and focus summary', () => {
  assert.deepEqual(normalizeNovoWorkContextInput('  Novo Companion  ', '  Finish the account connection  '), {
    projectLabel: 'Novo Companion',
    focusSummary: 'Finish the account connection',
  });
  assert.equal(normalizeNovoWorkContextInput('', '   '), null);
});

test('rejects URLs, local paths, secrets, control characters, and oversized summaries', () => {
  for (const focus of [
    'https://private.example/repo',
    'C:\\Users\\Angel\\private-work',
    'API_KEY=secret-value',
    'Focus\nsecond line',
    'x'.repeat(241),
  ]) {
    assert.equal(normalizeNovoWorkContextInput('Novo', focus), null);
  }
  assert.equal(normalizeNovoWorkContextInput('x'.repeat(101), 'A valid focus'), null);
});
