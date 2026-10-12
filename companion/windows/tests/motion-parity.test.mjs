import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const helper = new URL('./helpers/motion-sampler.mjs', import.meta.url);
const fixture = new URL('./fixtures/coucou-a7bd575-motion.json', import.meta.url);

test('normal motion matches the frozen Coucou reference, not a regenerated working snapshot', async () => {
  assert.ok(existsSync(helper), 'the isolated motion sampler must exist');
  assert.ok(existsSync(fixture), 'the upstream motion fixture must exist');
  const { sampleMotion, STATES, EMOTES, SCENARIOS } = await import(helper.href);
  assert.equal(STATES.length, 11);
  assert.equal(EMOTES.length, 7);
  const reference = JSON.parse(readFileSync(fixture, 'utf8'));
  assert.equal(reference.source, 'a7bd575e90253673e7e08370a78f1261eb53ac2f');
  assert.deepEqual(Object.keys(reference.scenarios), SCENARIOS);
  for (const scenario of SCENARIOS) {
    const actual = await sampleMotion('working', scenario);
    const expected = reference.scenarios[scenario];
    assert.equal(actual.length, expected.length, scenario);
    for (let i = 0; i < actual.length; i++) {
      assert.equal(actual[i].frame, expected[i].frame);
      assert.deepEqual(Object.keys(actual[i].pose), Object.keys(expected[i].pose), scenario);
      for (const [key, value] of Object.entries(expected[i].pose)) {
        const observed = actual[i].pose[key];
        if (typeof value === 'number') {
          assert.ok(Number.isFinite(observed) && Math.abs(observed - value) <= 1e-9,
            `${scenario}: frame ${i}, ${key}: ${observed} != ${value}`);
        } else assert.equal(observed, value, `${scenario}: frame ${i}, ${key}`);
      }
    }
  }
});
