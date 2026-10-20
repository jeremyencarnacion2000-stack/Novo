import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRefreshDeveloperContext, shouldStartActivitySync } from '../src/sync-policy.ts';

const ready = {
  isTauri: true,
  syncInFlight: false,
  historyClearRequested: false,
  tokenPresent: true,
  accountState: 'connected',
  queuedEvents: 2,
  online: true,
};

test('does not start a sync while local history deletion is confirmed or in progress', () => {
  assert.equal(shouldStartActivitySync({ ...ready, historyClearRequested: true }), false);
});

test('allows sync only when the device is connected, online, and has queued events', () => {
  assert.equal(shouldStartActivitySync(ready), true);
  assert.equal(shouldStartActivitySync({ ...ready, syncInFlight: true }), false);
  assert.equal(shouldStartActivitySync({ ...ready, tokenPresent: false }), false);
  assert.equal(shouldStartActivitySync({ ...ready, queuedEvents: 0 }), false);
  assert.equal(shouldStartActivitySync({ ...ready, online: false }), false);
  assert.equal(shouldStartActivitySync({ ...ready, isTauri: false }), false);
  for (const accountState of ['offline', 'verifying', 'expired', 'revoked', 'demo']) {
    assert.equal(shouldStartActivitySync({ ...ready, accountState }), false);
  }
});

test('developer provider context is refreshed at most every five minutes unless requested manually', () => {
  const nowMs = 600_000;
  assert.equal(shouldRefreshDeveloperContext({ nowMs, lastAttemptMs: null, inFlight: false }), true);
  assert.equal(shouldRefreshDeveloperContext({ nowMs, lastAttemptMs: 300_001, inFlight: false }), false);
  assert.equal(shouldRefreshDeveloperContext({ nowMs, lastAttemptMs: 300_000, inFlight: false }), true);
  assert.equal(shouldRefreshDeveloperContext({ nowMs, lastAttemptMs: null, inFlight: true, force: true }), false);
  assert.equal(shouldRefreshDeveloperContext({ nowMs, lastAttemptMs: nowMs, inFlight: false, force: true }), true);
});
