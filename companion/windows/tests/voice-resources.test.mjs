import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyResource } from '../scripts/voice-resources.mjs';

test('speech resources reject a truncated or modified download before use', () => {
  const bytes = Buffer.from('abc');
  const asset = { size: 3, sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' };
  assert.doesNotThrow(() => verifyResource(bytes, asset));
  assert.throws(() => verifyResource(Buffer.from('ab'), asset), /integrity/);
  assert.throws(() => verifyResource(Buffer.from('abd'), asset), /integrity/);
});
