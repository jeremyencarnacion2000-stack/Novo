import { test } from "node:test";
import assert from "node:assert/strict";
import { installFakeDom } from "./fakedom.mjs";
import { calls, emit, internals } from "./tauri.mjs";

installFakeDom();
const { buildPrompt } = await import("../src/views/chat.ts");
const { State } = await import("../src/core/state.ts");

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
