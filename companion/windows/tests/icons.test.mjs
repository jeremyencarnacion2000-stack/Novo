import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

test('PNG and ICO deliver transparent Novo icons, not the upstream character', () => {
  for (const [name, size] of [['32x32.png', 32], ['128x128.png', 128], ['128x128@2x.png', 256], ['icon.png', 512]]) {
    const png = readFileSync(new URL(`../src-tauri/icons/${name}`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
    let at = 8; const compressed = [];
    while (at < png.length) { const n = png.readUInt32BE(at), type = png.toString('ascii', at + 4, at + 8); if (type === 'IDAT') compressed.push(png.subarray(at + 8, at + 8 + n)); at += n + 12; }
    const raw = inflateSync(Buffer.concat(compressed)); const colors = new Set(); let transparent = 0;
    for (let y = 0; y < size; y++) { assert.equal(raw[y * (size * 4 + 1)], 0); for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      if (raw[i + 3] === 0) transparent++;
      else colors.add(raw.subarray(i, i + 3).toString('hex'));
    }}
    assert.ok(transparent > size);
    assert.ok(colors.has('fff3df'), `${name} must contain Novo's cream face`);
    assert.ok(colors.has('17181c'), `${name} must contain black eyes`);
  }
  const ico = readFileSync(new URL('../src-tauri/icons/icon.ico', import.meta.url));
  assert.equal(ico.readUInt16LE(2), 1); assert.equal(ico.readUInt16LE(4), 7);
  assert.deepEqual(Array.from({ length: 7 }, (_, i) => ico[6 + i * 16] || 256), [16, 24, 32, 48, 64, 128, 256]);
});
