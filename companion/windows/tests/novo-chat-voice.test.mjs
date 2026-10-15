import { test } from "node:test";
import assert from "node:assert/strict";
import { installFakeDom } from "./fakedom.mjs";
import { calls, internals } from "./tauri.mjs";

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
  calls.length = 0;
  const view = buildPrompt(() => {});
  const input = view.el.querySelector(".chat-input");
  const mic = view.el.querySelector(".novo-voice-button");
  try {
    input.value = "Ayúdame con este proyecto";
    mic.fire("click");
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

test("unsupported speech recognition explains why dictation cannot start", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "SpeechRecognition");
  delete globalThis.SpeechRecognition;
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
