import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { allKeys, LANGUAGE_CODES, lookup, setLanguage, t, tn } from '../src/i18n/i18n.ts';

test('all languages and plural templates name Novo without changing caller data', () => {
  try {
    for (const lang of LANGUAGE_CODES) {
      setLanguage(lang);
      assert.equal(t('Coucou {name}', { name: 'Coucou-report.txt' }), 'Novo Coucou-report.txt');
      for (const count of [0, 1, 2, 3, 11, 21]) {
        assert.equal(tn('Mochi {count} file {name}', 'Mochi {count} files {name}', count, { name: 'Coucou-report.txt' }), `Novo ${count} ${count === 1 ? 'file' : 'files'} Coucou-report.txt`);
      }
      assert.equal(t('coucou-hook.exe coucou_agent'), 'coucou-hook.exe coucou_agent');
      for (const key of allKeys()) if (/\b(Coucou|Mochi)\b/.test(key)) {
        const translated = t(key, { name: 'Example', count: 2 });
        assert.doesNotMatch(translated, /\b(Coucou|Mochi)\b/, `${lang}: ${key}`);
        const forms = lookup(key);
        if (typeof forms === 'object') for (const n of [0, 1, 2, 3, 11, 21]) assert.doesNotMatch(tn(key, key, n), /\b(Coucou|Mochi)\b/);
      }
    }
  } finally { setLanguage('en'); }
});

test('the local state gallery exists but is isolated from the installed application', () => {
  const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  assert.ok(existsSync(new URL('../design/novo-states.html', import.meta.url)), 'the local visual acceptance gallery must exist');
  assert.doesNotMatch(read('vite.config.ts'), /novo-states/);
  const source = read('src/dev/novo-state-gallery.ts');
  assert.doesNotMatch(source, /\b(fetch|Bridge|beginDeviceAuthorization|loadIntegrationTasks)\b/);
  assert.match(source, /Object\.keys\(BOT_STATES\)/);
  for (const emote of ['love', 'surprised', 'proud', 'wink', 'yawn', 'happy', 'annoyed']) assert.ok(source.includes('"' + emote + '"'));
  assert.match(source, /\[20, 44, 58, 66\]/);
  assert.match(source, /visibilitychange/);
  assert.match(read('design/novo-states.html'), /value="normal"/);
  assert.match(read('design/novo-states.html'), /value="reduced"/);
});
