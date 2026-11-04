import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function verifyResource(bytes, asset) {
  if ((asset.size !== undefined && bytes.length !== asset.size) || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error('Speech resource integrity check failed');
}
async function download(asset, file) {
  try { verifyResource(await readFile(file), asset); return; } catch { /* verify again after fetching */ }
  const response = await fetch(asset.url, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok) throw new Error(`Speech resource download failed (${response.status})`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 45 * 1024 * 1024) throw new Error('Speech resource exceeds download limit');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks); verifyResource(bytes, asset); await writeFile(file, bytes);
}
export async function prepareVoiceResources() {
  const lock = JSON.parse(await readFile(join(root, 'voice-resources.lock.json'), 'utf8'));
  const dest = join(root, 'resources', 'voice'); const cache = join(root, '.tmp', 'voice-download');
  await mkdir(dest, { recursive: true }); await mkdir(cache, { recursive: true });
  for (const asset of lock.downloads) await download(asset, join(cache, asset.name));
  const quote = value => `'${value.replaceAll("'", "''")}'`;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath ${quote(join(cache, 'whisper.zip'))} -DestinationPath ${quote(join(cache, 'extracted'))} -Force`], { windowsHide: true, stdio: 'pipe' });
  const extracted = await readdir(join(cache, 'extracted'), { recursive: true });
  const binaries = extracted.filter(name => /(^|[\\/])(whisper-cli\.exe|whisper\.dll|ggml(?:-base|-cpu-[a-z0-9]+)?\.dll)$/.test(name));
  for (const name of binaries) await copyFile(join(cache, 'extracted', name), join(dest, name.split(/[\\/]/).pop()));
  for (const asset of lock.downloads.filter(asset => asset.name !== 'whisper.zip')) await copyFile(join(cache, asset.name), join(dest, asset.name));
  await copyFile(join(root, 'VOICE-LICENSES.txt'), join(dest, 'VOICE-LICENSES.txt'));
  const files = [];
  for (const name of (await readdir(dest)).sort()) {
    if (!(await stat(join(dest, name))).isFile()) throw new Error('Unexpected speech resource');
    const bytes = await readFile(join(dest, name));
    const file = { name, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    if (lock.files.length) {
      const pinned = lock.files.find(item => item.name === name);
      if (!pinned) throw new Error('Unexpected speech resource');
      verifyResource(bytes, pinned);
    }
    files.push(file);
  }
  if (lock.files.length && files.length !== lock.files.length) throw new Error('Missing speech resource');
  return files;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await prepareVoiceResources(), null, 2));
