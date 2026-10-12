// The launch greeting (src/mochi/greeting.ts): Mochi must never be cut off by
// the island while it grows, while he bounces and waves, or while it shrinks
// back to the compact island.

import { test } from "node:test";
import assert from "node:assert/strict";
import { GREETING_END, GREETING_W, greetingPose, mochiBounds } from "../src/mochi/greeting.ts";
import { Tracked } from "../src/core/anim.ts";
import { COMPACT_W, NOTCH_H, NOTCH_W, VIEW_LAYOUTS } from "../src/core/layout.ts";
import { getNovoGeometry } from "../src/mochi/novo-geometry.ts";
import { createRecordingCanvas, RecordingPath } from "./helpers/recording-canvas.mjs";
import { presentationPose } from "../src/core/motion-policy.ts";

const FRAME = 1 / 60;
const SLACK = 0.5; // anti-aliasing

/** Mochi's box against the island's, which is centred in the 640 px greeting canvas. */
function assertInside(t, tc, w, h, preference = 'normal') {
  const pose = presentationPose(greetingPose(t, tc), preference);
  const b = mochiBounds(pose);
  if (!b) return;
  const hh = pose.hb / 2;
  const geometry = getNovoGeometry(hh * 1.34, hh, "main");
  if (geometry) {
    assert.ok(pose.x + geometry.bounds.left * pose.sx >= b.left);
    assert.ok(pose.x + geometry.bounds.right * pose.sx <= b.right);
    assert.ok(pose.y + geometry.bounds.bottom * pose.sy <= b.bottom);
  }
  const left = GREETING_W / 2 - w / 2;
  const right = GREETING_W / 2 + w / 2;
  const at = `t=${t.toFixed(3)} tc=${tc}`;
  // No check on the top: he drops in from the edge of the screen, like out of
  // the notch on a Mac, so his head is meant to come out of it.
  assert.ok(b.bottom <= h + SLACK, `${at}: bottom ${b.bottom.toFixed(1)} below the island (${h.toFixed(1)})`);
  assert.ok(b.left >= left - SLACK, `${at}: left ${b.left.toFixed(1)} outside ${left.toFixed(1)}`);
  assert.ok(b.right <= right + SLACK, `${at}: right ${b.right.toFixed(1)} outside ${right.toFixed(1)}`);
}

/** Runs the island geometry the way Island does: spring open, then the 340 ms close curve. */
function run(tc, preference = 'normal') {
  const width = new Tracked(NOTCH_W);
  const height = new Tracked(0);
  width.springTo(GREETING_W);
  height.springTo(VIEW_LAYOUTS.greeting.height);
  let collapsed = false;
  const stop = Number.isFinite(tc) ? tc + 0.6 : GREETING_END + 0.5;
  for (let t = 0; t <= stop; t += FRAME) {
    const now = t * 1000;
    if (!collapsed && t >= tc) {
      collapsed = true;
      width.curveTowards(COMPACT_W, 340, now);
      height.curveTowards(NOTCH_H, 340, now);
    }
    width.step(FRAME, now);
    height.step(FRAME, now);
    assertInside(t, tc, width.value, height.value, preference);
  }
}

test("Mochi stays inside the island for the whole greeting", () => {
  run(Number.POSITIVE_INFINITY);
});

test("Mochi stays inside the island when the greeting is cut short", () => {
  for (let tc = 0.3; tc < GREETING_END + 0.4; tc += 0.1) run(tc);
});

test("reduced-motion greeting retains the same safe bounds, including interruptions", () => {
  run(Number.POSITIVE_INFINITY, 'reduced');
  for (let tc = .3; tc < GREETING_END + .4; tc += .1) run(tc, 'reduced');
});

test("he slides to the side to wave, then comes back to the middle", () => {
  const atWave = greetingPose(2.0);
  assert.ok(atWave.x < 290, `waving at x=${atWave.x}`);
  assert.ok(atWave.handL > 0.9 && atWave.handR > 0.9, "both hands out");
  assert.ok(atWave.wave >= 0, "waving");
  const back = greetingPose(3.6);
  assert.equal(back.x, 320);
  assert.equal(back.handL, 0);
});

test("he lands where the compact island's Mochi sits", () => {
  const end = greetingPose(10, 5);
  assert.equal(end.y, NOTCH_H / 2);
  assert.equal(end.x, GREETING_W / 2 - COMPACT_W / 2 + 40);
  assert.equal(end.minis, 1);
});

test("greeting and its four landing miniatures share Novo's cream face", async () => {
  const saved = globalThis.performance;
  let ms = 0; globalThis.performance = { now: () => ms }; globalThis.Path2D = RecordingPath;
  const { Greeting } = await import('../src/mochi/greeting.ts');
  const greeting = new Greeting();
  try {
    greeting.start(); ms = 300; greeting.interrupt(); ms = 1000;
    const { ctx, commands } = createRecordingCanvas(); greeting.draw(ctx);
    assert.equal(commands.filter(c => c.op === 'fillStyle' && c.args[0] === '#fff3df').length, 5);
  } finally { greeting.leave(); globalThis.performance = saved; }
});
