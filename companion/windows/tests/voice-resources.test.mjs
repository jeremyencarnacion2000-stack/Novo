import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { verifyResource } from '../scripts/voice-resources.mjs';

test('speech resources reject a truncated or modified download before use', () => {
  const bytes = Buffer.from('abc');
  const asset = { size: 3, sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' };
  assert.doesNotThrow(() => verifyResource(bytes, asset));
  assert.throws(() => verifyResource(Buffer.from('ab'), asset), /integrity/);
  assert.throws(() => verifyResource(Buffer.from('abd'), asset), /integrity/);
});

test('speech packaging ignores an incompatible archive module inherited from another PowerShell', { skip: process.platform !== 'win32' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'novo-voice-resources-'));
  t.after(async () => {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
    await rm(root, { recursive: true, force: true });
  });
  const cache = join(root, '.tmp', 'voice-download');
  const scripts = join(root, 'scripts');
  const module = join(root, 'modules', 'Microsoft.PowerShell.Archive');
  const input = join(root, 'input', 'Release');
  await Promise.all([cache, scripts, module, input].map(path => mkdir(path, { recursive: true })));
  await copyFile(new URL('../scripts/voice-resources.mjs', import.meta.url), join(scripts, 'voice-resources.mjs'));
  await writeFile(join(input, 'whisper-cli.exe'), 'abc');
  await writeFile(join(root, 'VOICE-LICENSES.txt'), 'license\n');
  await writeFile(join(module, 'Microsoft.PowerShell.Archive.psm1'), "function Expand-Archive { throw 'incompatible inherited archive module' }; Export-ModuleMember -Function Expand-Archive");
  const quote = value => `'${value.replaceAll("'", "''")}'`;
  const archive = join(cache, 'whisper.zip');
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory(${quote(join(root, 'input'))}, ${quote(archive)})`], { windowsHide: true });
  const bytes = await readFile(archive);
  await writeFile(join(root, 'voice-resources.lock.json'), JSON.stringify({
    downloads: [{ name: 'whisper.zip', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), url: 'https://invalid.example/never-fetched' }], files: [],
  }));
  const output = execFileSync(process.execPath, [join(scripts, 'voice-resources.mjs')], {
    env: { ...process.env, PSModulePath: join(root, 'modules') }, windowsHide: true, encoding: 'utf8', stdio: 'pipe',
  });
  assert.deepEqual(JSON.parse(output).map(file => file.name), ['VOICE-LICENSES.txt', 'whisper-cli.exe']);
  assert.equal(await readFile(join(root, 'resources', 'voice', 'whisper-cli.exe'), 'utf8'), 'abc');
});
