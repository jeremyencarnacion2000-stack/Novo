import test from 'node:test';
import assert from 'node:assert/strict';
import { replayStartup } from './helpers/startup-fixture.mjs';

test('startup frames are finite with clean/existing preferences, DPI and both homes', async () => {
  for (const dpiScale of [1, 1.25, 1.5, 2]) for (const existing of [false, true]) {
    for (const onDesktop of [false, true]) for (const bootOrder of ['immediate', 'delayed', 'interrupted']) {
      const result = await replayStartup({
        prefs: {onDesktop, existing}, bootOrder, dpiScale,
        framesMs: [0, 16, 32, 80, 250, 500, 1500, 3000, 4700, 5400],
      });
      assert.equal(result.ready, true);
      assert.ok(result.frames.every(f => f.numericArguments.every(Number.isFinite)));
      assert.ok(result.frames.every(f => f.mainCharacterRegistered));
      assert.ok(result.frames.some(f => f.surfaces.some(s => s.operations > 0)), 'real renderer must run');
      const final = result.frames.at(-1);
      assert.ok(final.miniatures > 0, 'declared pills must have real miniatures');
      assert.equal(final.home, onDesktop ? 'desktop' : 'island');
      if (!onDesktop) assert.ok(final.surfaces.some(s => s.id === 'bot-canvas' && s.operations > 0));
    }
  }
});
