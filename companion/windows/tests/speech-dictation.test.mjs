import { test } from "node:test";
import assert from "node:assert/strict";
import { SpeechDictation } from "../src/core/speech-dictation.ts";

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
    this.started = 0;
    this.stopped = 0;
    this.aborted = 0;
  }
  start() { this.started++; this.onstart?.(); }
  stop() { this.stopped++; this.onend?.(); }
  abort() { this.aborted++; this.onend?.(); }
  result(...transcripts) {
    this.onresult?.({ results: transcripts.map((transcript) => ({ 0: { transcript } })) });
  }
}

test("dictation appends interim and final speech to the current draft, then stops", () => {
  const texts = [];
  const states = [];
  const dictation = new SpeechDictation({
    transcript: (text) => texts.push(text),
    listening: (active) => states.push(active),
    error: (error) => assert.fail(`unexpected error: ${error}`),
  }, FakeRecognition, "es-BO");

  assert.equal(dictation.start("Revisar este proyecto"), true);
  assert.equal(dictation.isListening, true);
  const recognition = FakeRecognition.latest;
  assert.equal(recognition.lang, "es-BO");
  assert.equal(recognition.interimResults, true);
  assert.equal(recognition.continuous, false);
  recognition.result("por favor");
  recognition.result("por favor, actualiza el twin");
  assert.deepEqual(texts, [
    "Revisar este proyecto por favor",
    "Revisar este proyecto por favor, actualiza el twin",
  ]);

  dictation.stop();
  assert.equal(recognition.stopped, 1);
  assert.equal(dictation.isListening, false);
  assert.deepEqual(states, [true, false]);
});

test("cancel restores the draft and prevents a late browser result", () => {
  const texts = [];
  const dictation = new SpeechDictation({
    transcript: (text) => texts.push(text),
    listening: () => {},
    error: (error) => assert.fail(`unexpected error: ${error}`),
  }, FakeRecognition);
  dictation.start("existing text");
  const recognition = FakeRecognition.latest;
  recognition.result("discard this");
  dictation.cancel();
  recognition.result("late result");
  assert.equal(recognition.aborted, 1);
  assert.deepEqual(texts, ["existing text discard this", "existing text"]);
  assert.equal(dictation.isListening, false);
});

test("cancel after recognition ended does not overwrite a newer draft", () => {
  const texts = [];
  const dictation = new SpeechDictation({
    transcript: (text) => texts.push(text),
    listening: () => {},
    error: (error) => assert.fail(`unexpected error: ${error}`),
  }, FakeRecognition);
  dictation.start("original draft");
  const recognition = FakeRecognition.latest;
  recognition.result("spoken words");
  dictation.stop();

  dictation.cancel();

  assert.deepEqual(texts, ["original draft spoken words"]);
});

test("unavailable recognition and microphone errors produce safe states", () => {
  const errors = [];
  const dictation = new SpeechDictation({
    transcript: () => {},
    listening: () => {},
    error: (error) => errors.push(error),
  }, null);
  assert.equal(dictation.start(""), false);
  assert.deepEqual(errors, ["unavailable"]);

  const denied = new SpeechDictation({
    transcript: () => {},
    listening: () => {},
    error: (error) => errors.push(error),
  }, FakeRecognition);
  denied.start("");
  FakeRecognition.latest.onerror?.({ error: "not-allowed" });
  assert.equal(errors.at(-1), "permission");
});
