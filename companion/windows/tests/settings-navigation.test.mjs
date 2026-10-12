import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installFakeDom} from './fakedom.mjs';
import {calls,sent} from './tauri.mjs';
installFakeDom();
const {settingsNavigation,settingsSection}=await import('../src/settings/navigation.ts');
const {Bridge}=await import('../src/core/bridge.ts');

test('unified settings expose one selected panel and retain panels when switching',()=>{
  const changes=[];const view=settingsNavigation('account',id=>changes.push(id));
  const account=view.panels.account;account.append(document.createElement('input'));
  assert.equal(account.hidden,false);assert.equal(view.panels.assistant.hidden,true);
  view.nav.children[1].fire('click');
  assert.equal(view.selected,'assistant');assert.equal(account.hidden,true);
  assert.equal(view.panels.assistant.hidden,false);assert.equal(changes.at(-1),'assistant');
  assert.equal(view.nav.children.filter(button=>button.getAttribute('aria-selected')==='true').length,1);
  view.show('account');assert.equal(view.panels.account,account);assert.equal(account.children.length,1);
  assert.equal(view.nav.children[0].tabIndex,0);assert.equal(view.nav.children[1].tabIndex,-1);
});

test('account and chat shortcuts use the unified settings commands',async()=>{
  calls.length=0;await Bridge.openNovo();await Bridge.openSettingsWindow('assistant');
  assert.equal(sent('companion_panel_open').length,1);
  assert.deepEqual(sent('open_settings_window')[0],{section:'assistant'});
  assert.equal(settingsSection('../private'),null);assert.equal(settingsSection('assistant'),'assistant');
});

test('the former account entry uses the same app and native boot creates one settings window',()=>{
  const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
  for(const entry of ['settings.html','companion.html'])assert.match(read(entry),/src\/settings\/main\.ts/);
  const source=read('src-tauri/src/lib.rs');
  assert.doesNotMatch(source,/create_companion_window|WebviewWindowBuilder::new\(app, "companion"/);
  assert.match(source,/fn companion_panel_open[\s\S]*?emit_to\("settings", "settings-navigate", "account"\)/);
});
