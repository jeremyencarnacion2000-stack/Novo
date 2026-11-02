import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './fakedom.mjs';
import { calls, internals, sent } from './tauri.mjs';

installFakeDom();
const { buildPrompt } = await import('../src/views/chat.ts');
const { novoChatSection } = await import('../src/settings/novo-chat.ts');
const { State, DEFAULT_SETTINGS } = await import('../src/core/state.ts');
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const plainInvoke = internals.invoke;
let view;
let answer;
beforeEach(() => {
  calls.length = 0;
  State.settings = { ...DEFAULT_SETTINGS, chatProvider: 'codex' };
  State.chatHistory = [{ id: 1, role: 'assistant', content: 'private Novo account history' }];
  State.view = 'prompt';
  State.droppedFile = null;
  answer = async () => ({ text: 'Local Codex answer' });
  internals.invoke = async (command, args) => {
    const result = await plainInvoke(command, args);
    if (command === 'codex_chat_send') return answer(args);
    if (command === 'novo_account_status') return { state: 'demo', authorization: null, revocationPending: false };
    if (command === 'companion_context_folders_list' || command === 'project_work_runtimes') return [];
    return result;
  };
});
afterEach(async () => {
  view?.dispose?.();
  view = null;
  await flush();
  internals.invoke = plainInvoke;
  State.settings = { ...DEFAULT_SETTINGS };
  State.chatHistory = [];
  State.droppedFile = null;
});

test('actual Companion chat selects Codex without Novo account, API key or account history', async () => {
  State.droppedFile = { name: 'private.txt', path: 'C:\\private\\private.txt' };
  view = buildPrompt(() => {});
  await flush();
  view.sync();
  assert.equal(view.el.dataset.backend, 'codex');
  assert.match(view.el.textContent, /separate from your Novo history/);
  assert.match(view.el.textContent, /no compartido/);
  const input = view.el.querySelector('.chat-input');
  input.value = 'Answer this question';
  view.el.querySelector('.send-btn').fire('click');
  await flush();
  assert.deepEqual(sent('codex_chat_send'), [{ query: 'Answer this question' }]);
  for (const command of ['novo_account_status', 'novo_chat_start', 'chat_send', 'chat_models', 'secret_present']) assert.equal(sent(command).length, 0, command);
  assert.equal(State.chatHistory.length, 2);
  assert.match(view.el.textContent, /Local Codex answer/);
  assert.doesNotMatch(view.el.textContent, /private Novo account history/);
});

test('switching back to Novo cancels local work and ignores late Codex responses', async () => {
  let finish;
  answer = () => new Promise(resolve => { finish = resolve; });
  view = buildPrompt(() => {});
  await flush();
  view.el.querySelector('.chat-input').value = 'Old local question';
  view.el.querySelector('.send-btn').fire('click');
  await flush();
  State.settings.chatProvider = 'anthropic';
  view.sync();
  await flush();
  assert.equal(view.el.dataset.backend, 'novo');
  assert.ok(sent('codex_chat_reset').length >= 2);
  assert.equal(sent('novo_account_status').length, 1);
  finish({ text: 'Late answer must stay out' });
  await flush();
  assert.doesNotMatch(view.el.textContent, /Late answer|Old local question/);
  assert.deepEqual(State.chatHistory, []);
  State.settings.chatProvider = 'codex';
  view.sync();
  await flush();
  assert.equal(view.el.dataset.backend, 'codex');
  assert.doesNotMatch(view.el.textContent, /Late answer|Old local question/);
});

test('Assistant settings exposes an explicit account or ChatGPT plan choice', async () => {
  let saves = 0;
  const settings = { ...DEFAULT_SETTINGS };
  view = novoChatSection(settings, async () => { saves++; });
  await flush();
  const source = view.el.find('SELECT').find(element => element.getAttribute('aria-label') === 'Response source');
  assert.ok(source);
  assert.deepEqual(source.children.map(option => option.textContent), ['Novo account', 'ChatGPT Codex']);
  source.value = 'codex';
  source.fire('change');
  await flush();
  assert.equal(settings.chatProvider, 'codex');
  assert.equal(saves, 1);
  assert.match(view.el.textContent, /separate from your Novo history/);
  source.value = 'novo';
  source.fire('change');
  await flush();
  assert.equal(settings.chatProvider, 'anthropic');
});

test('Codex dictation fills the draft and never submits automatically', async () => {
  const previous = globalThis.SpeechRecognition;
  let recognition;
  globalThis.SpeechRecognition = class {
    constructor() { recognition = this; }
    start() {}
    stop() { this.onend?.(); }
    abort() { this.onend?.(); }
  };
  try {
    view = buildPrompt(() => {});
    await flush();
    const input = view.el.querySelector('.chat-input');
    input.value = 'Ayúdame';
    view.el.querySelector('.novo-voice-button').fire('click');
    recognition.onresult({ results: [{ 0: { transcript: ' con Novo' } }] });
    assert.equal(input.value, 'Ayúdame con Novo');
    assert.equal(sent('codex_chat_send').length, 0);
    assert.equal(recognition.lang, 'es-BO');
  } finally {
    if (previous) globalThis.SpeechRecognition = previous;
    else delete globalThis.SpeechRecognition;
  }
});
