import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRecordingCanvas, RecordingPath } from './helpers/recording-canvas.mjs';
globalThis.Path2D = RecordingPath;

test('Novo geometry fits the original motion envelope at every detail and size', async () => {
  const url = new URL('../src/mochi/novo-geometry.ts', import.meta.url);
  assert.ok(existsSync(url), 'the shared Novo geometry must exist');
  const { getNovoGeometry, NOVO_PALETTE } = await import(url.href);
  assert.equal(NOVO_PALETTE.eye, '#17181c');
  for (const detail of ['main', 'mini', 'icon']) for (const size of [20, 44, 58, 66]) {
    const rx = size * .57, ry = size * .44, g = getNovoGeometry(rx, ry, detail);
    assert.equal(g.antennae.length, 2);
    assert.ok(g.face.rx > 0 && g.face.ry > 0);
    assert.ok(g.bounds.left >= -rx && g.bounds.right <= rx);
    assert.ok(g.bounds.top >= -ry && g.bounds.bottom <= ry);
    for (const p of [...g.shell, ...g.antennae.flat()]) assert.ok(Math.abs(p.x) <= rx && Math.abs(p.y) <= ry);
    assert.ok(g.emblem || detail === 'mini');
  }
  for (const size of [NaN, Infinity, 0, -.1, .49]) assert.equal(getNovoGeometry(size, 10, 'main'), null);
});

test('all 13 eye expressions stay semantically distinct and finite', async () => {
  const { drawNovoEye } = await import('../src/mochi/novo-art.ts');
  const draw = (shape, side = 1, open = 1) => {
    const { ctx, commands } = createRecordingCanvas();
    drawNovoEye(ctx, shape, 3.25, 4.75, side, open, .4);
    assert.equal(commands.filter(c => c.op === 'save').length, commands.filter(c => c.op === 'restore').length);
    for (const c of commands) for (const v of c.args) if (typeof v === 'number') assert.ok(Number.isFinite(v));
    return commands;
  };
  for (const s of ['pill', 'wide', 'dot', 'line', 'flat', 'happy', 'closed', 'spiral', 'heart', 'star', 'tired', 'wink', 'cup']) draw(s, 1, 0);
  assert.equal(draw('heart').filter(c => c.op === 'bezierCurveTo').length, 2);
  assert.equal(draw('star').filter(c => c.op === 'lineTo').length, 10);
  assert.ok(draw('spiral').filter(c => c.op === 'lineTo').length > 50);
  assert.notDeepEqual(draw('wink', -1), draw('wink', 1));
  assert.notDeepEqual(draw('tired'), draw('flat'));
});

test('custom-color miniatures keep a cream face under black eyes', async () => {
  const { BotEngine } = await import('../src/mochi/engine.ts');
  const bot = new BotEngine(); bot.isMini = true; bot.bodyColor = [1, .1, .2];
  const { ctx, commands } = createRecordingCanvas();
  bot.draw(ctx, 20, 20);
  assert.ok(commands.some(c => c.op === 'fillStyle' && c.args[0] === '#fff3df'));
  assert.ok(commands.some(c => c.op === 'fillStyle' && c.args[0] === '#17181c'));
  assert.equal(commands.filter(c => c.op === 'save').length, commands.filter(c => c.op === 'restore').length);
});

test('invalid feature dimensions never reach Canvas', async () => {
  const art = await import('../src/mochi/novo-art.ts');
  assert.equal(typeof art.drawNovoFeatures, 'function');
  const { ctx, commands } = createRecordingCanvas();
  for (const rx of [0, NaN, Infinity, -1]) art.drawNovoFeatures(ctx, rx, 10, { detail: 'main', morph: 0, faceX: 0, faceY: 0 });
  assert.equal(commands.length, 0);
});

test('chest details are behind the face, within the existing body clip', async () => {
  const { drawNovoFeatures } = await import('../src/mochi/novo-art.ts');
  for (const detail of ['main', 'icon']) for (const size of [20, 44, 58, 66]) {
    for (const morph of [0, .5]) for (const faceY of [-size * .3, size * .3]) {
      const { ctx, commands } = createRecordingCanvas();
      drawNovoFeatures(ctx, size * .57, size * .44, {detail, morph, faceX: size * .12, faceY});
      const clip = commands.findIndex(c => c.op === 'clip');
      const emblem = commands.findIndex(c => c.op === 'fillStyle' && c.args[0] === '#34d399');
      const face = commands.findIndex(c => c.op === 'fillStyle' && c.args[0] === '#fff3df');
      assert.ok(emblem > clip, `${detail}/${size}: chest must stay in the shell mask`);
      assert.ok(emblem < face, `${detail}/${size}: face must occlude the chest`);
      assert.equal(commands.filter(c => c.op === 'save').length, commands.filter(c => c.op === 'restore').length);
    }
  }
});

test('morph fades the chest without changing the face opacity', async () => {
  const { drawNovoFeatures } = await import('../src/mochi/novo-art.ts');
  const { ctx } = createRecordingCanvas(), fills = [];
  ctx.globalAlpha = .8;
  const observer = new Proxy(ctx, { get(target, key) {
    if (key === 'fill') return (...args) => { fills.push({ink:target.fillStyle, alpha:target.globalAlpha}); target.fill(...args); };
    return target[key];
  }});
  drawNovoFeatures(observer, 28, 24, {detail:'main', morph:.5, faceX:0, faceY:3});
  assert.equal(fills.find(f => f.ink === '#fff3df').alpha, .8);
  assert.equal(fills.find(f => f.ink === '#34d399').alpha, .4);
  assert.equal(ctx.globalAlpha, .8);
});

test('a complete morph omits chest decoration and retains the original face', async () => {
  const { drawNovoFeatures } = await import('../src/mochi/novo-art.ts');
  const { ctx, commands } = createRecordingCanvas();
  drawNovoFeatures(ctx, 28, 24, {detail:'main', morph:1, faceX:-4, faceY:6});
  assert.ok(commands.some(c => c.op === 'fillStyle' && c.args[0] === '#fff3df'));
  assert.ok(!commands.some(c => c.op === 'fillStyle' && ['#34d399', '#f5a524'].includes(c.args[0])));
  assert.equal(commands.filter(c => c.op === 'save').length, commands.filter(c => c.op === 'restore').length);
});
