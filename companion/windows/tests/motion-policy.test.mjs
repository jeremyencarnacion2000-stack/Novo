import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRecordingCanvas, RecordingPath } from './helpers/recording-canvas.mjs';

test('reduced motion is a non-mutating presentation policy, never a new state engine', async () => {
  const url = new URL('../src/core/motion-policy.ts', import.meta.url);
  assert.ok(existsSync(url), 'the presentation motion policy must exist');
  const { presentationPose, motionPreference } = await import(url.href);
  const pose = { sx: 1.1, sy: .8, tilt: .17, x: 320, y: 90, morph: .4, hands: 1, mouth: .2 };
  assert.equal(presentationPose(pose, 'normal'), pose);
  assert.deepEqual(presentationPose(pose, 'reduced'), { ...pose, sx: 1, sy: 1, tilt: 0 });
  assert.equal(pose.sy, .8); assert.equal(motionPreference(), 'normal');
  let matches = true, calls = 0;
  globalThis.matchMedia = () => { calls++; return { get matches() { return matches; } }; };
  try { assert.equal(motionPreference(), 'reduced'); matches = false; assert.equal(motionPreference(), 'normal'); assert.equal(calls, 1); }
  finally { delete globalThis.matchMedia; }
});

test('reduced-motion badges stay anchored to the presented body, without changing state', async () => {
  const { BotEngine, BOT_STATES } = await import('../src/mochi/engine.ts');
  globalThis.Path2D = RecordingPath;
  const bot = new BotEngine(); bot.badge = BOT_STATES.thinking.badge; bot.badgeS = 1;
  bot.sx = 1.2; bot.sy = .7;
  const { ctx, commands } = createRecordingCanvas();
  bot.draw(ctx, 66, 66, 'reduced');
  const translates = commands.filter(c => c.op === 'translate');
  const R = 66 * .3, cx = 33 + bot.ox * R, cy = 33 + bot.particleOverhang / 2 + bot.oy * R + R * .06;
  assert.deepEqual(translates.at(-1).args, [cx - R * .72, cy - R * .72]);
  assert.equal(bot.sx, 1.2); assert.equal(bot.sy, .7);
});

test('switching presentation mid-emote preserves engine poses and the 1.8 second expiry', async () => {
  const { BotEngine } = await import('../src/mochi/engine.ts');
  globalThis.Path2D = RecordingPath;
  const saved = { performance, random: Math.random }; let ms = 0;
  globalThis.performance = { now: () => ms }; Math.random = () => .425;
  const a = new BotEngine(), b = new BotEngine(); a.triggerEmote('love'); b.triggerEmote('love');
  const { ctx, commands } = createRecordingCanvas();
  try {
    for (let i = 0; i < 121; i++) {
      ms = i * 1000 / 60;
      if (i === 30) { a.squash(); b.squash(); }
      a.update(1 / 60); b.update(1 / 60);
      commands.length = 0; a.draw(ctx, 66, 66, i >= 30 && i < 90 ? 'reduced' : 'normal');
      for (const field of ['sx', 'sy', 'tilt', 'yaw', 'roll', 'morph', 'eyeOverride', 'eyeOverrideUntil', 'badgeS']) assert.equal(a[field], b[field]);
      if (i === 45) { assert.notEqual(a.sy, 1); assert.deepEqual(commands.find(c => c.op === 'scale').args, [1, 1]); }
      if (i === 100) assert.equal(a.eyeOverride, 'heart');
      if (i === 110) assert.equal(a.eyeOverride, null);
    }
  } finally { globalThis.performance = saved.performance; Math.random = saved.random; }
});
