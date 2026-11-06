import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './fakedom.mjs';
import { sent, calls, emit } from './tauri.mjs';
installFakeDom();
const { buildReplySpeech }=await import('../src/views/reply-speech.ts');
const { State, DEFAULT_SETTINGS }=await import('../src/core/state.ts');
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
let view;
afterEach(()=>{view?.dispose();view=null;});
test('opening history stays silent; the read button uses only the current reply',async()=>{
  calls.length=0;State.settings={...DEFAULT_SETTINGS};State.view='prompt';let before=0;
  view=buildReplySpeech(()=>before++);view.update('account/a','**Hola**');
  view.readReply();await flush();assert.equal(sent('voice_speak').length,0);
  view.el.fire('click');await flush();
  assert.equal(sent('voice_speak').length,1);assert.equal(sent('voice_speak')[0].text,'Hola');assert.equal(before,1);
  const id=sent('voice_speak')[0].requestId;
  view.update('account/b','Respuesta privada de B');await flush();
  assert.ok(sent('voice_stop').some(args=>args.requestId===id));
  emit('novo-speech-state',{requestId:id,state:'speaking'});
  assert.equal(view.el.getAttribute('aria-label'),'Read latest reply');
});
test('automatic speech is opt-in, stops when disabled and stays silent outside chat',async()=>{
  calls.length=0;State.settings={...DEFAULT_SETTINGS,voiceSpokenReplies:true};State.view='prompt';
  view=buildReplySpeech(()=>{});view.update('codex/a','Respuesta');
  await flush();assert.equal(sent('voice_speak').length,0);
  view.readReply();await flush();assert.equal(sent('voice_speak').length,1);
  State.settings.voiceSpokenReplies=false;view.settingsChanged();await flush();
  assert.equal(sent('voice_stop').length,1);
  State.settings.voiceSpokenReplies=true;State.view='overview';
  view.readReply();await flush();assert.equal(sent('voice_speak').length,1);
});
test('a dictated reply can be spoken even when automatic replies are off',async()=>{
  calls.length=0;State.settings={...DEFAULT_SETTINGS,voiceSpokenReplies:false};State.view='prompt';
  view=buildReplySpeech(()=>{});view.update('account/a','Listo');
  view.readReply(true);await flush();assert.equal(sent('voice_speak').at(-1).text,'Listo');
});

test('saving an unrelated setting preserves manually requested speech and its stop button',async()=>{
  calls.length=0;State.settings={...DEFAULT_SETTINGS,voiceSpokenReplies:false};State.view='prompt';
  view=buildReplySpeech(()=>{});view.update('account/a','Listo, puse Codex al frente.');
  view.el.fire('click');await flush();
  const id=sent('voice_speak').at(-1).requestId;
  emit('novo-speech-state',{requestId:id,state:'speaking'});
  State.settings={...State.settings,voiceInputLanguage:'es'};view.settingsChanged();await flush();
  assert.equal(view.el.getAttribute('aria-label'),'Stop speaking');
  assert.equal(sent('voice_stop').length,0);
  view.el.fire('click');await flush();
  assert.equal(sent('voice_stop').at(-1).requestId,id);
  assert.equal(view.el.getAttribute('aria-label'),'Read latest reply');
});
