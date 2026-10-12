import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRecordingCanvas, RecordingPath } from './helpers/recording-canvas.mjs';
globalThis.Path2D = RecordingPath;
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/coucou-a7bd575-motion.json', import.meta.url), 'utf8')).scenarios;

test('upload retains Novo identity through hover, mailbox, chewing and return', async () => {
  const { UploadCanvas } = await import('../src/upload/canvas.ts');
  const { ctx, commands } = createRecordingCanvas(); const buttons = [];
  const saved = globalThis.document;
  globalThis.document = { createElement: tag => {
    const el = { style: {}, append() {}, addEventListener(event, fn) { this.click = fn; }, getContext: () => ctx };
    if (tag === 'button') buttons.push(el); return el;
  } };
  let ask = 0, cancel = 0;
  try {
    const canvas = new UploadCanvas({ ask: () => ask++, cancel: () => cancel++ });
    const render = pose => {
      const { mouthRectX, mouthRectY, mouthRectW, mouthRectH, ...f } = pose;
      f.mouthRect = { x: mouthRectX, y: mouthRectY, w: mouthRectW, h: mouthRectH };
      commands.length = 0; canvas.draw(f, f.t);
      assert.ok(commands.some(c => c.op === 'fillStyle' && c.args[0] === '#fff3df'), `cream face at t=${f.t}`);
      assert.ok(commands.some(c => c.op === 'fillStyle' && c.args[0] === '#17181c'));
      if (f.suck > 0 && f.fileVisible) assert.ok(commands.some(c => c.op === 'rect' && c.args[2] === 640 && Math.abs(c.args[3] - (f.mouthRect.y + f.mouthRect.h / 2)) < 1e-9));
      if (f.mouth * f.d / 2 / 1.04 * Math.min(f.morph, 1) > .3) assert.ok(commands.some(c => c.op === 'addColorStop' && c.args[1] === '#030304'));
      assert.equal(commands.filter(c => c.op === 'save').length, commands.filter(c => c.op === 'restore').length);
    };
    for (const index of [0, 24, 30, 42, 52, 63, 80, 101, 180, 360]) render(fixtures['upload-drop'][index].pose);
    render(fixtures['upload-hover-long'][1800].pose);
    buttons[0].click(); buttons[1].click(); assert.equal(ask, 1); assert.equal(cancel, 1);
  } finally { globalThis.document = saved; }
});
