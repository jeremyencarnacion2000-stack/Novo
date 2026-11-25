import { test } from "node:test";
import assert from "node:assert/strict";
import { installFakeDom } from "./fakedom.mjs";
import { calls, emit, internals } from "./tauri.mjs";

installFakeDom();
const { buildPrompt } = await import("../src/views/chat.ts");
const { State, DEFAULT_SETTINGS } = await import("../src/core/state.ts");
const { Sound } = await import("../src/core/sound.ts");
const { NOVO_WAKE_EVENT, registerVoiceWake } = await import("../src/island/voice-wake.ts");

test('saying Novo opens the draft without sounding ready before native capture starts', async (testContext) => {
  const original = internals.invoke;
  const previous = { settings: State.settings, mode: State.mode, view: State.view };
  const chime = testContext.mock.method(Sound, 'play', () => {});
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));
  calls.length = 0;
  State.settings = { ...DEFAULT_SETTINGS, voiceWakeEnabled: true, voiceInputMode: 'local' };
  State.mode = 'compact';
  State.view = 'overview';
  internals.invoke = async (cmd, args) => {
    const result = await original(cmd, args);
    return cmd === 'voice_wake_wait' ? true : result;
  };
  const view = buildPrompt(() => {});
  const input = view.el.querySelector('.chat-input');
  input.value = '';
  try {
    registerVoiceWake(() => {
      State.mode = 'expanded';
      State.view = 'prompt';
      State.notify();
    });
    await flush();
    assert.equal(State.view, 'prompt');
    assert.equal(chime.mock.callCount(), 0, 'ready cue must wait for the capture event');
    const request = calls.find(([name]) => name === 'voice_input_start');
    assert.ok(request, 'start preparing capture without a fixed delay');
    const requestId = request[1].requestId;
    for (let i = 0; i < 2; i++) emit('novo-voice-input', { requestId, state: 'listening' });
    assert.deepEqual(chime.mock.calls.map(call => call.arguments), [['voice-ready']]);
    State.mode = 'compact';
    State.notify();
    await flush();
    assert.equal(calls.filter(([name]) => name === 'voice_wake_wait').length, 1, 'folding must not open the wake detector during dictation');
    State.mode = 'expanded';
    emit('novo-voice-input', { requestId, state: 'finished', text: 'Abre Codex' });
    assert.equal(input.value, 'Abre Codex');
    assert.equal(calls.some(([name]) => name === 'novo_chat_start' || name === 'desktop_app_open'), false);
  } finally {
    window.dispatchEvent(new Event('beforeunload'));
    view.dispose();
    internals.invoke = original;
    Object.assign(State, previous);
  }
});

test('Novo uses native local dictation without granting cloud consent', async () => {
  calls.length=0;State.settings.voiceInputMode='local';State.settings.voiceCloudConsent=false;
  const view=buildPrompt(()=>{});
  await new Promise(resolve=>setTimeout(resolve,0));
  try {
    const input=view.el.querySelector('.chat-input');input.value='Revisar';
    view.el.querySelector('.novo-voice-button').fire('click');
    await new Promise(resolve=>setTimeout(resolve,0));
    const call=calls.find(([name])=>name==='voice_input_start');assert.ok(call);
    emit('novo-voice-input',{requestId:call[1].requestId,state:'processing'});
    assert.match(view.el.querySelector('.novo-voice-status').textContent,/Transcribing/);
    emit('novo-voice-input',{requestId:call[1].requestId,state:'finished',text:'los proyectos'});
    assert.equal(input.value,'Revisar los proyectos');
    assert.equal(calls.some(([name])=>name==='novo_chat_start'),false);
  } finally {view.dispose();State.settings.voiceInputMode='cloud';}
});

test('wake-only repetitions leave the draft intact while manual negation and full phrases are kept', async () => {
  const originalSettings = State.settings;
  const originalView = State.view;
  State.settings = { ...DEFAULT_SETTINGS, voiceWakeEnabled: true, voiceInputMode: 'local' };
  State.view = 'prompt';
  calls.length = 0;
  const view = buildPrompt(() => {});
  const input = view.el.querySelector('.chat-input');
  input.value = 'Borrador';
  const finishDictation = async (text, source) => {
    if (source === 'wake') window.dispatchEvent(new Event(NOVO_WAKE_EVENT));
    else view.el.querySelector('.novo-voice-button').fire('click');
    await new Promise(resolve => setTimeout(resolve, 0));
    const requestId = calls.findLast(([name]) => name === 'voice_input_start')?.[1].requestId;
    assert.ok(requestId);
    emit('novo-voice-input', { requestId, state: 'listening' });
    emit('novo-voice-input', { requestId, state: 'finished', text });
  };
  try {
    await finishDictation('No, no, no, no.', 'wake');
    assert.equal(input.value, 'Borrador');
    assert.match(view.el.querySelector('.novo-voice-status').textContent, /could not understand/i);
    await finishDictation('¡Nobo! ¡Nobo!', 'wake');
    assert.equal(input.value, 'Borrador');
    await finishDictation('No, no quiero borrarlo.', 'wake');
    assert.equal(input.value, 'Borrador No, no quiero borrarlo.');
    input.value = '';
    await finishDictation('No, no.', 'manual');
    assert.equal(input.value, 'No, no.');
  } finally {
    view.dispose();
    State.settings = originalSettings;
    State.view = originalView;
  }
});

class FakeRecognition {
  static latest;
  constructor() {
    FakeRecognition.latest = this;
    this.lang = "";
    this.continuous = true;
    this.interimResults = false;
    this.maxAlternatives = 0;
    this.onstart = null;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.stopped = 0;
  }
  start() {}
  stop() { this.stopped++; this.onend?.(); }
  abort() { this.onend?.(); }
  result(...transcripts) {
    this.onresult?.({ results: transcripts.map((transcript) => ({ 0: { transcript } })) });
  }
}

test("Novo chat dictation fills the active draft and waits for the user to send", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "SpeechRecognition");
  globalThis.SpeechRecognition = FakeRecognition;
  FakeRecognition.latest = undefined;
  calls.length = 0;
  State.settings.voiceCloudConsent = true;
  const view = buildPrompt(() => {});
  const input = view.el.querySelector(".chat-input");
  const mic = view.el.querySelector(".novo-voice-button");
  try {
    input.value = "Ayúdame con este proyecto";
    mic.fire("click");
    assert.equal(FakeRecognition.latest.lang, "es-BO");
    assert.equal(State.stateOverride, "listening");
    assert.equal(mic.classList.contains("listening"), true);
    assert.equal(view.el.querySelector(".novo-chat-body").classList.contains("voice-listening"), true);
    FakeRecognition.latest.result(" y actualiza el Twin");
    assert.equal(input.value, "Ayúdame con este proyecto y actualiza el Twin");
    assert.deepEqual(calls.filter((call) => call.cmd === "novo_chat_start"), []);

    mic.fire("click");
    assert.equal(FakeRecognition.latest.stopped, 1);
    assert.equal(State.stateOverride, null);
    assert.equal(mic.classList.contains("listening"), false);
    assert.equal(view.el.querySelector(".novo-chat-body").classList.contains("voice-listening"), false);
    assert.equal(view.el.querySelector(".novo-voice-status").textContent, "");
  } finally {
    view.dispose();
    if (descriptor) Object.defineProperty(globalThis, "SpeechRecognition", descriptor);
    else delete globalThis.SpeechRecognition;
  }
});

test("voice dictation stays off until the user grants cloud speech consent", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "SpeechRecognition");
  globalThis.SpeechRecognition = FakeRecognition;
  FakeRecognition.latest = undefined;
  calls.length = 0;
  State.settings.voiceCloudConsent = false;
  const view = buildPrompt(() => {});
  try {
    view.el.querySelector(".novo-voice-button").fire("click");
    assert.equal(FakeRecognition.latest, undefined);
    assert.match(view.el.querySelector(".novo-voice-status").textContent, /Voice dictation is off/);
    assert.equal(calls.some(call => call.cmd === "novo_chat_start"), false);
  } finally {
    view.dispose();
    if (descriptor) Object.defineProperty(globalThis, "SpeechRecognition", descriptor);
    else delete globalThis.SpeechRecognition;
  }
});

test("revoking speech consent stops an active Novo dictation", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "SpeechRecognition");
  globalThis.SpeechRecognition = FakeRecognition;
  State.settings.voiceCloudConsent = true;
  const view = buildPrompt(() => {});
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    view.el.querySelector(".novo-voice-button").fire("click");
    const recognition = FakeRecognition.latest;
    assert.equal(State.stateOverride, "listening");
    emit("settings-changed", { voiceCloudConsent: false });
    assert.equal(recognition.stopped, 0);
    assert.equal(State.stateOverride, null);
    assert.equal(view.el.querySelector(".novo-chat-body").classList.contains("voice-listening"), false);
  } finally {
    view.dispose();
    if (descriptor) Object.defineProperty(globalThis, "SpeechRecognition", descriptor);
    else delete globalThis.SpeechRecognition;
  }
});

test("unsupported speech recognition explains why dictation cannot start", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "SpeechRecognition");
  delete globalThis.SpeechRecognition;
  State.settings.voiceCloudConsent = true;
  const view = buildPrompt(() => {});
  try {
    view.el.querySelector(".novo-voice-button").fire("click");
    const status = view.el.querySelector(".novo-voice-status");
    assert.equal(status.textContent, "Speech recognition is not available on this device.");
    assert.equal(view.el.querySelector(".novo-chat-body").classList.contains("voice-listening"), false);
  } finally {
    view.dispose();
    if (descriptor) Object.defineProperty(globalThis, "SpeechRecognition", descriptor);
  }
});
