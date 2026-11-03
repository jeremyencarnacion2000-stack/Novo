import { Bridge, onEvent } from '../core/bridge';
import { State, type ChatMessage, type Settings } from '../core/state';
import { SpeechDictation } from '../core/speech-dictation';
import { Sound } from '../core/sound';
import { N_, t } from '../i18n/i18n';
import { h, svg, clear } from './dom';
import { ICONS } from './icons';
import { renderMarkdown } from './markdown';
import type { ViewHost } from './views';

// Finish a disposed view's reset before a replacement session can send.
let resetQueue: Promise<void> = Promise.resolve();
function resetSession() {
  resetQueue = resetQueue.catch(() => {}).then(() => Bridge.codexChatReset());
  return resetQueue;
}

export function buildCodexPrompt(onHeightChange: () => void): ViewHost {
  const messages: ChatMessage[] = [];
  let disposed = false;
  let generation = 0;
  let busy = false;
  let ready = false;
  const status = h('div', { class: 'novo-chat-error', role: 'status', 'aria-live': 'polite' });
  const log = h('div', { class: 'chat-log' });
  const file = h('div', { class: 'novo-unshared-file' });
  const input = h('input', { type: 'text', class: 'chat-input', maxlength: 12000, 'aria-label': t("Ask me anything…"), placeholder: t("Ask me anything…") });
  const send = h('button', { class: 'send-btn', 'aria-label': t("Send") }, svg(ICONS.arrowUp, 11));
  const mic = h('button', { type: 'button', class: 'novo-voice-button', 'aria-label': t("Start dictation"), title: t("The speech service may process audio outside Novo. Novo receives only the text you send.") }, svg(ICONS.mic, 14));
  const fresh = h('button', { class: 'novo-chat-link', text: t("Start a new chat"), onclick: () => void reset() });
  const settings = h('button', { type: 'button', class: 'novo-chat-settings', 'aria-label': t("Settings"), onclick: () => void Bridge.openSettingsWindow('assistant') }, svg(ICONS.gear, 12));
  const header = h('div', { class: 'novo-chat-heading' }, h('span', { text: 'ChatGPT Codex' }), fresh, settings);
  const body = h('div', { class: 'chat-body novo-chat-body' }, header, file, log, status, h('div', { class: 'chat-bar' }, input, mic, send));
  const el = h('div', { class: 'view' }, h('div', { class: 'card wash chat-card' }, body));
  const dictation = new SpeechDictation({
    transcript(text) { input.value = text; controls(); },
    listening(active) {
      body.classList.toggle('voice-listening', active);
      mic.classList.toggle('listening', active);
      mic.setAttribute('aria-label', active ? t("Stop dictation") : t("Start dictation"));
      mic.replaceChildren(svg(active ? ICONS.stop : ICONS.mic, 14));
      State.stateOverride = active ? 'listening' : busy ? 'thinking' : null;
      State.notify();
      controls();
    },
    error(kind) {
      status.textContent = kind === 'unavailable' ? t("Speech recognition is not available on this device.") : kind === 'permission' ? t("Microphone access was denied. Allow it in your device settings.") : kind === 'no-speech' ? t("No speech was detected. Try again.") : t("Voice dictation failed. Try again.");
    },
  }, undefined, 'es-BO');
  let stopSettings:(()=>void)|null=null;
  void onEvent<Settings>('settings-changed',settings=>{
    State.settings={...State.settings,...settings};
    if(settings.voiceCloudConsent!==true)dictation.cancel();
  }).then(stop=>{if(disposed)stop();else stopSettings=stop;});

  function controls() {
    send.disabled = !ready || busy || dictation.isListening;
    input.disabled = busy || !ready;
    mic.disabled = busy || !ready;
  }
  function draw() {
    if (disposed) return;
    clear(log);
    for (const message of messages) {
      const content = h('div', { class: message.role === 'user' ? 'bubble' : 'reply' });
      if (message.role === 'user') content.textContent = message.content;
      else renderMarkdown(content, message.content);
      log.append(h('div', { class: message.role === 'user' ? 'chat-row user' : 'chat-row' }, content));
    }
    if (busy) log.append(h('div', { class: 'chat-row' }, h('div', { class: 'typing' }, h('i'), h('i'), h('i'))));
    State.chatHistory = messages.map(message => ({ ...message }));
    State.stateOverride = busy ? 'thinking' : null;
    controls();
    log.scrollTop = log.scrollHeight;
    State.notify();
    onHeightChange();
  }
  async function reset() {
    const attempt = ++generation;
    ready = false;
    busy = false;
    dictation.cancel();
    messages.length = 0;
    status.textContent = t("ChatGPT Codex uses your local Codex login. This session stays separate from your Novo history.");
    draw();
    try { await resetSession(); if (!disposed && attempt === generation) ready = true; }
    catch { if (!disposed && attempt === generation) status.textContent = t("Codex could not finish this response. Try again."); }
    finally { if (!disposed && attempt === generation) controls(); }
  }
  async function submit() {
    if (dictation.isListening) { dictation.stop(); return; }
    const query = input.value.trim();
    if (!query || !ready || busy || disposed) return;
    const attempt = generation;
    messages.push({ id: messages.length, role: 'user', content: query });
    input.value = '';
    status.textContent = '';
    busy = true;
    Sound.play('send');
    draw();
    try {
      const reply = await Bridge.codexChatSend(query);
      if (disposed || attempt !== generation) return;
      messages.push({ id: messages.length, role: 'assistant', content: reply.text });
      Sound.play('finish');
    } catch (error) {
      if (disposed || attempt !== generation) return;
      messages.pop();
      input.value = query;
      const code = String(error).replace(/^Error:\s*/, '');
      status.textContent = code === 'runtime_unavailable' ? t("Open Codex and sign in with ChatGPT to use your plan here.") : code === t("Message too long for Codex chat.") ? code : t("Codex could not finish this response. Try again.");
      Sound.play('error');
    } finally {
      if (!disposed && attempt === generation) { busy = false; draw(); input.focus(); }
    }
  }
  send.addEventListener('click', () => void submit());
  mic.addEventListener('click', () => {
    if (dictation.isListening) { dictation.stop(); return; }
    if (!State.settings.voiceCloudConsent) {
      status.textContent = t(N_("Voice dictation is off. Enable it in Novo Settings → Assistant to allow the speech service to process audio."));
      void Bridge.openSettingsWindow('assistant');
      return;
    }
    status.textContent = '';
    dictation.start(input.value);
  });
  input.addEventListener('keydown', event => {
    const key = (event as KeyboardEvent).key;
    if (key === 'Enter') { event.preventDefault(); void submit(); }
    else if (key === 'Escape' && dictation.isListening) { event.preventDefault(); dictation.cancel(); }
    event.stopPropagation();
  });
  const stop = () => {
    if (disposed) return;
    disposed = true;
    ++generation;
    stopSettings?.();
    dictation.dispose();
    State.stateOverride = null;
    void resetSession().catch(() => {});
    window.removeEventListener('beforeunload', stop);
  };
  window.addEventListener('beforeunload', stop);
  void reset();
  return { el, sync() {
    const name = State.droppedFile?.name ?? '';
    file.textContent = name ? `${name} · archivo local, no compartido` : '';
    file.hidden = !name;
  }, focus: () => input.focus(), dispose: stop };
}
