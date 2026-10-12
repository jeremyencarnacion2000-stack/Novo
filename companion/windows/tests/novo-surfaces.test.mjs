import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordingCanvas, RecordingPath } from './helpers/recording-canvas.mjs';
import { drawWardrobeIcon } from '../src/mochi/outfits.ts';
import { OUTFIT_SELECTIONS } from '../src/mochi/wardrobe.ts';
import { getNovoGeometry, NOVO_PALETTE } from '../src/mochi/novo-geometry.ts';
import { renderShareImage, SHARE_W, SHARE_H } from '../src/recap/share.ts';
import { language, setLanguage } from '../src/i18n/i18n.ts';

globalThis.Path2D = RecordingPath;

test('every wardrobe character uses Novo geometry and identity while retaining accessory choices', () => {
  const rx = 10 * 1.14, ry = 10 * .88;
  const geometry = getNovoGeometry(rx, ry, 'icon');
  const shell = geometry.shell.map((p, i) => ({ op: i ? 'lineTo' : 'moveTo', args: [p.x, p.y] }));
  shell.push({ op: 'closePath', args: [] });
  for (const selection of OUTFIT_SELECTIONS) {
    const { ctx, commands } = createRecordingCanvas();
    drawWardrobeIcon(ctx, 32, selection, 'witchHat', 'AUTO');
    const fills = commands.filter(c => c.op === 'fillStyle').map(c => c.args[0]);
    assert.equal(commands.filter(c => c.op === 'save').length, commands.filter(c => c.op === 'restore').length, selection);
    if (selection === 'none') {
      assert.ok(!fills.includes(NOVO_PALETTE.face), 'none retains the crossed-out circle');
      continue;
    }
    assert.ok(fills.includes(NOVO_PALETTE.face), `${selection}: cream face`);
    assert.ok(fills.includes(NOVO_PALETTE.eye), `${selection}: black eyes`);
    assert.ok(fills.includes(NOVO_PALETTE.emblem), `${selection}: emerald chest`);
    assert.ok(commands.some(c => c.op === 'fill' && c.args[0] instanceof RecordingPath &&
      JSON.stringify(c.args[0].commands) === JSON.stringify(shell)), `${selection}: shared Novo shell`);
    for (const antenna of geometry.antennae) {
      assert.ok(commands.some(c => c.op === 'moveTo' && c.args[0] === antenna[0].x && c.args[1] === antenna[0].y), `${selection}: antenna`);
    }
    if (selection !== 'pumpkin') {
      assert.ok(commands.some(c => c.op === 'addColorStop' && c.args[1] === NOVO_PALETTE.shell), `${selection}: graphite body`);
    }
    assert.equal(commands.some(c => c.op === 'fillText' && c.args[0] === 'AUTO'), selection === 'auto');
    for (const c of commands) for (const v of c.args) if (typeof v === 'number') assert.ok(Number.isFinite(v), selection);
  }
});

test('recap image renders Novo branding without rewriting a project name or bypassing project privacy', t => {
  const oldDocument = globalThis.document, oldLanguage = language();
  t.after(() => { globalThis.document = oldDocument; setLanguage(oldLanguage); });
  setLanguage('en');
  const summary = {
    weekStart: new Date(2026, 9, 5), weekEnd: new Date(2026, 9, 11, 23, 59, 59),
    totalMinutes: 90, sessionCount: 2, filesChanged: 3, linesAdded: 4, linesRemoved: 1,
    commandsRun: 5, questions: 0, permissionsAllowed: 1, permissionsDenied: 0,
    topAgent: 'Codex', topProject: 'Coucou-report.txt', busiestDay: 'Monday', longestSessionMinutes: 60,
  };
  for (const hideProjects of [false, true]) {
    const { ctx, commands } = createRecordingCanvas();
    const canvas = { width: 0, height: 0, getContext: () => ctx };
    globalThis.document = { createElement: tag => { assert.equal(tag, 'canvas'); return canvas; } };
    assert.equal(renderShareImage(summary, hideProjects), canvas);
    assert.equal(canvas.width, SHARE_W); assert.equal(canvas.height, SHARE_H);
    const texts = commands.filter(c => c.op === 'fillText').map(c => c.args[0]);
    assert.ok(texts.includes('Novo'), 'Novo heading is actually drawn');
    assert.ok(texts.includes('Novo · productivitynovo.vercel.app'), 'Novo footer is actually drawn');
    assert.ok(!texts.includes('Coucou'), 'old heading is absent');
    assert.ok(!texts.some(value => value.includes('github.com/Louis-CFM/coucou')), 'upstream attribution stays in legal notice, not branding');
    assert.equal(texts.includes(summary.topProject), !hideProjects, 'project names are neither rewritten nor exposed when hidden');
    assert.equal(commands.filter(c => c.op === 'save').length, commands.filter(c => c.op === 'restore').length);
  }
});
