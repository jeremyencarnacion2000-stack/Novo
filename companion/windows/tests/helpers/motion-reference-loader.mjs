import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export const REFERENCE_SHA = 'a7bd575e90253673e7e08370a78f1261eb53ac2f';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export function installReferenceLoader() {
  const blobs = new Map(['mochi/engine', 'mochi/greeting', 'upload/sequence'].map(path => {
    const source = execFileSync('git', ['show', `${REFERENCE_SHA}:windows/src/${path}.ts`],
      { cwd: repo, encoding: 'utf8', maxBuffer: 1024 * 1024 });
    return [new URL(`../../src/${path}.ts`, import.meta.url).href, source];
  }));
  return registerHooks({
    load(url, context, nextLoad) {
      const result = nextLoad(url, context);
      return blobs.has(url) ? { ...result, format: 'module-typescript', source: blobs.get(url) } : result;
    },
  });
}
