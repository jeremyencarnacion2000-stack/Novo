import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calls, emit } from './tauri.mjs';
import { State, DEFAULT_SETTINGS } from '../src/core/state.ts';
import { CompanionDictation } from '../src/core/companion-dictation.ts';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('local speech fills the existing draft without cloud speech or sending chat', async () => {
  State.settings = { ...DEFAULT_SETTINGS, voiceInputMode: 'local', voiceCloudConsent: false };
  calls.length = 0; const texts = []; const phases = [];
  const input = new CompanionDictation({ transcript: text => texts.push(text), listening: active => phases.push(active), processing: () => phases.push('processing'), error: error => assert.fail(error) });
  await tick(); input.start('Revisar'); await tick();
  const start = calls.find(([name]) => name === 'voice_input_start');
  assert.ok(start, 'explicit mic start must reach the native local worker');
  emit('novo-voice-input', { requestId: start[1].requestId, state: 'processing' });
  assert.equal(input.isListening, true);
  emit('novo-voice-input', { requestId: start[1].requestId, state: 'finished', text: 'mis tareas' });
  assert.deepEqual(texts, ['Revisar mis tareas']);
  assert.equal(input.isListening, false);
  assert.ok(phases.includes('processing'));
  assert.equal(calls.some(([name]) => /chat_start|chat_send|transcribe/.test(name)), false);
  input.dispose();
});

test('cancelled local audio cannot change the draft or trigger cloud fallback', async () => {
  State.settings = { ...DEFAULT_SETTINGS, voiceInputMode: 'local', voiceCloudConsent: true };
  calls.length = 0; const texts = []; const errors = [];
  const input = new CompanionDictation({ transcript: text => texts.push(text), listening() {}, error: code => errors.push(code) });
  await tick(); input.start('Borrador'); await tick();
  const requestId = calls.find(([name]) => name === 'voice_input_start')[1].requestId;
  input.cancel();
  emit('novo-voice-input', { requestId, state: 'finished', text: 'enviar correo' });
  assert.deepEqual(texts, ['Borrador']);
  assert.ok(calls.some(([name, args]) => name === 'voice_input_cancel' && args.requestId === requestId));
  input.start('Borrador'); await tick();
  const next = calls.filter(([name]) => name === 'voice_input_start').at(-1)[1].requestId;
  emit('novo-voice-input', { requestId: next, state: 'error', code: 'speech_memory_low' });
  assert.deepEqual(errors, ['memory']);
  assert.equal(input.isListening, false);
  assert.equal(calls.filter(([name]) => name === 'voice_input_start').length, 2);
  input.dispose();
});

test('off mode never opens a microphone and cloud mode still requires consent', async () => {
  calls.length = 0; const errors = [];
  const input = new CompanionDictation({ transcript() {}, listening() {}, error: code => errors.push(code) });
  await tick();
  State.settings = { ...DEFAULT_SETTINGS, voiceInputMode: 'off' };
  assert.equal(input.start(''), false);
  State.settings.voiceInputMode = 'cloud'; State.settings.voiceCloudConsent = false;
  assert.equal(input.start(''), false);
  assert.deepEqual(errors, ['disabled', 'consent']);
  assert.equal(calls.some(([name]) => name === 'voice_input_start'), false);
  input.dispose();
});
