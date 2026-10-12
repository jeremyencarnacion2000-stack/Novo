// Chat view — DOM port of PromptView / ChatBubble / TypingDotsView /
// ModelPickerView from IslandViewContent.swift.
//
// Answers are rendered as Markdown (markdown.ts). A local model streams its
// answer: Rust sends `chat-delta` events with the text visible so far. The
// model name above the text field opens the picker: provider chips, then the
// models of the chosen provider, asked for only once it is picked.

import { h, svg, clear } from "./dom";
import { ICONS } from "./icons";
import { renderMarkdown } from "./markdown";
import { Bridge, onEvent, type ChatContext, type ModelInfo } from "../core/bridge";
import {
  activeModel, pickModel, providerDef, visibleProviders, withModel, type ProviderDef,
} from "../core/providers";
import { Sound } from "../core/sound";
import { State, type ChatMessage } from "../core/state";
import type { ViewHost } from "./views";
import { N_, t, tl } from "../i18n/i18n";
import { NovoChatController } from '../core/novo-chat';

const STRINGS = {
  placeholderFirst: N_("Ask me anything…"),
  placeholderNext: N_("Continue…"),
  send: N_("Send"),
  switchModel: N_("Switch provider or model"),
  noModel: N_("Choose a model"),
  loading: N_("Loading models…"),
  noKey: N_("No API key — add it in Settings."),
  openSettings: N_("Open Settings"),
};

let nextId = 1;

function bubble(message: ChatMessage): HTMLElement {
  if (message.role === "user") {
    return h(
      "div",
      { class: "chat-row user" },
      h("div", { class: "bubble", text: message.content }),
    );
  }
  const reply = h("div", { class: "reply" });
  renderMarkdown(reply, message.content);
  return h("div", { class: "chat-row" }, reply);
}

function typingDots(): HTMLElement {
  return h(
    "div",
    { class: "chat-row" },
    h("div", { class: "typing" }, h("i"), h("i"), h("i")),
  );
}

/** The coloured chip showing what the question is about (a dropped file). */
function contextChip(label: string): HTMLElement {
  const chip = h("div", { class: "chip" }, h("i", { class: "chip-dot" }), h("span", { text: label }));
  requestAnimationFrame(() => chip.classList.add("settled"));
  return chip;
}

function saveSettings() {
  void Bridge.saveSettings(State.settings);
}

// ── Model picker ──────────────────────────────────────────────────────────────

interface Picker {
  el: HTMLElement;
  open(): void;
  close(): void;
  readonly isOpen: boolean;
}

interface ChoiceOption { value: string; label: string }
interface ChoiceMenu {
  el: HTMLElement;
  setOptions(options: ChoiceOption[], value: string, disabled: boolean): void;
  getValue(): string;
  close(): void;
  dispose(): void;
}

/** A compact Coucou-style menu instead of the platform's large native select popup. */
function buildChoiceMenu(className: string, label: string, onChange: (value: string) => void, onOpenChange: (open:boolean)=>void = ()=>{}): ChoiceMenu {
  const caption = h("span", { class: "novo-choice-caption" });
  const trigger = h("button", {
    type: "button", class: "novo-choice-trigger", "aria-haspopup": "listbox", "aria-expanded": "false", title: label,
  }, caption, svg(ICONS.chevronUpDown, 10, { stroke: 2 }));
  const list = h("div", { class: "novo-choice-list", role: "listbox", "aria-label": label });
  const el = h("div", { class: `novo-choice ${className}` }, trigger, list);
  let options: ChoiceOption[] = [];
  let value = "";
  let isOpen = false;

  function close() {
    isOpen = false;
    el.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    onOpenChange(false);
  }
  function open() {
    if (trigger.disabled) return;
    isOpen = true;
    el.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    onOpenChange(true);
    list.querySelector<HTMLElement>("[aria-selected='true']")?.scrollIntoView({ block: "nearest" });
  }
  function renderOptions() {
    clear(list);
    for (const option of options) {
      const row = h("button", { type: "button", class: "novo-choice-option", role: "option", "aria-selected": option.value === value ? "true" : "false" },
        h("span", { text: option.label }), option.value === value ? svg(ICONS.check, 11, { stroke: 2.2 }) : null);
      row.addEventListener("click", () => {
        value = option.value;
        caption.textContent = option.label;
        for (const item of list.querySelectorAll("[role='option']")) item.setAttribute("aria-selected", "false");
        row.setAttribute("aria-selected", "true");
        close();
        onChange(value);
        trigger.focus();
      });
      list.append(row);
    }
  }
  const outside = (event: PointerEvent) => { if (isOpen && !el.contains(event.target as Node)) close(); };
  document.addEventListener("pointerdown", outside);
  trigger.addEventListener("click", () => isOpen ? close() : open());
  trigger.addEventListener("keydown", event => {
    if ((event as KeyboardEvent).key === "ArrowDown" || (event as KeyboardEvent).key === "Enter" || (event as KeyboardEvent).key === " ") {
      event.preventDefault(); open(); list.querySelector<HTMLElement>("[role='option']")?.focus();
    }
  });
  list.addEventListener("keydown", event => {
    const keyboard = event as KeyboardEvent;
    const rows = [...list.querySelectorAll<HTMLElement>("[role='option']")];
    const index = rows.indexOf(document.activeElement as HTMLElement);
    if (keyboard.key === "Escape") { keyboard.preventDefault(); close(); trigger.focus(); }
    if (keyboard.key === "ArrowDown") { keyboard.preventDefault(); rows[Math.min(rows.length - 1, index + 1)]?.focus(); }
    if (keyboard.key === "ArrowUp") { keyboard.preventDefault(); rows[Math.max(0, index - 1)]?.focus(); }
  });

  return {
    el,
    setOptions(next, selected, disabled) {
      const changed = JSON.stringify(next) !== JSON.stringify(options);
      options = next;
      value = next.some(option => option.value === selected) ? selected : (next[0]?.value ?? "");
      if (changed) renderOptions();
      caption.textContent = next.find(option => option.value === value)?.label ?? label;
      trigger.disabled = disabled || next.length === 0;
      if (trigger.disabled) close();
    },
    getValue: () => value,
    close,
    dispose: () => { close(); document.removeEventListener("pointerdown", outside); },
  };
}

/** Provider chips, then the chosen provider's models — ModelPickerView. */
function buildPicker(onChange: () => void): Picker {
  const chips = h("div", { class: "picker-chips" });
  const list = h("div", { class: "picker-list" });
  const el = h("div", { class: "picker" }, chips, h("div", { class: "picker-rule" }), list);

  /** Models already asked for, by provider; a model server is asked again each time. */
  const cache = new Map<string, ModelInfo[]>();
  let isOpen = false;
  let request = 0;

  function drawChips() {
    clear(chips);
    for (const p of visibleProviders(State.settings)) {
      const on = p.id === State.settings.chatProvider;
      const chip = h(
        "button",
        { class: on ? "picker-chip on" : "picker-chip", style: `--accent:${p.accent}` },
        h("i", { class: "picker-dot" }),
        h("span", { text: t(p.name) }),
      );
      chip.addEventListener("click", () => {
        if (p.id === State.settings.chatProvider) return;
        State.settings = { ...State.settings, chatProvider: p.id };
        saveSettings();
        Sound.play("pop");
        drawChips();
        void loadModels();
        onChange();
      });
      chips.append(chip);
    }
  }

  function status(text: string, withSettings = false) {
    clear(list);
    const line = h("div", { class: "picker-status", text });
    if (withSettings) {
      line.append(
        h("button", {
          class: "picker-link",
          text: tl(STRINGS.openSettings),
          onclick: () => void Bridge.openSettingsWindow(),
        }),
      );
    }
    list.append(line);
  }

  function drawModels(p: ProviderDef, models: ModelInfo[]) {
    clear(list);
    const current = activeModel(State.settings);
    for (const m of models) {
      const on = m.id === current;
      const row = h(
        "button",
        { class: on ? "picker-model on" : "picker-model", style: `--accent:${p.accent}`, title: m.id },
        h("span", { class: "picker-model-name", text: m.label }),
        on ? svg(ICONS.check, 11, { stroke: 2.2 }) : null,
      );
      row.addEventListener("click", () => {
        State.settings = withModel(State.settings, p.id, m.id);
        saveSettings();
        Sound.play("blip");
        close();
      });
      list.append(row);
    }
    list.querySelector(".picker-model.on")?.scrollIntoView({ block: "nearest" });
  }

  async function loadModels() {
    const p = providerDef(State.settings.chatProvider);
    const ticket = ++request;
    const cached = p.urlField ? undefined : cache.get(p.id);
    if (cached) {
      drawModels(p, cached);
      return;
    }
    // Nothing is asked of a provider that has no key yet.
    if (p.key && !(await Bridge.secretPresent(p.key))) {
      if (ticket === request) status(t(STRINGS.noKey), true);
      return;
    }
    if (ticket !== request) return;
    status(t(STRINGS.loading));
    try {
      const models = await Bridge.chatModels(p.id);
      if (ticket !== request) return;
      if (!p.urlField) cache.set(p.id, models);
      const keep = pickModel(p, models.map((m) => m.id), activeModel(State.settings));
      if (keep && keep !== activeModel(State.settings)) {
        State.settings = withModel(State.settings, p.id, keep);
        saveSettings();
        onChange();
      }
      drawModels(p, models);
    } catch (err) {
      if (ticket === request) status(String(err).replace(/^Error:\s*/, ""), Boolean(p.key));
    }
  }

  function open() {
    isOpen = true;
    el.classList.add("on");
    drawChips();
    onChange();
    void loadModels();
  }

  function close() {
    isOpen = false;
    request++;
    el.classList.remove("on");
    onChange();
  }

  return {
    el,
    open,
    close,
    get isOpen() {
      return isOpen;
    },
  };
}

// ── View ──────────────────────────────────────────────────────────────────────

/** Default island conversation: only the signed-in Novo account and server history. */
export function buildPrompt(onHeightChange: () => void): ViewHost {
  const conversations=buildChoiceMenu('novo-conversations',t('Conversación de Novo'),value=>void controller.selectConversation(value),open=>{body.classList.toggle('history-open',open);});
  const settingsButton=h('button',{type:'button',class:'novo-chat-settings','aria-label':tl('Configuración del chat'),title:tl('Configuración del chat'),onclick:()=>void Bridge.openSettingsWindow('assistant')},svg(ICONS.gear,12));
  const connect=h('button',{type:'button',class:'novo-chat-link',text:tl('Conectar'),onclick:()=>void Bridge.openNovo()});
  const header=h('div',{class:'novo-chat-heading'},conversations.el,connect,settingsButton);
  const chip=h('div',{class:'novo-unshared-file'});
  const log=h('div',{class:'chat-log','aria-label':tl('Mensajes de la cuenta')});
  const error=h('div',{class:'novo-chat-error',role:'status','aria-live':'polite'});
  const input=h('input',{class:'chat-input',type:'text',maxlength:12000,'aria-label':tl('Mensaje para Novo'),placeholder:tl('Habla con Novo…')});
  const send=h('button',{class:'send-btn','aria-label':tl('Enviar mensaje')},svg(ICONS.arrowUp,11));
  const cancel=h('button',{class:'novo-chat-link',text:tl('Cancelar respuesta'),onclick:()=>void controller.cancel()});
  const bar=h('div',{class:'chat-bar'},input,cancel,send);
  const body=h('div',{class:'chat-body novo-chat-body'},header,chip,log,error,bar);
  const el=h('div',{class:'view'},h('div',{class:'card wash chat-card'},body));
  (el.querySelector('.card') as HTMLElement).style.setProperty('--wash','rgba(99,102,241,0.5)');
  let renderedConversation:unknown=null;let renderedPending='';let renderedActive:string|null=null;
  let live:HTMLElement|null=null;let disposed=false;
  const controller=new NovoChatController({...Bridge,contextSearch:async query=>{
    const context=await Bridge.contextSearch(query);
    if(State.settings.novoLocalConnections){
      const agents=State.tasks.filter(task=>task.id==='integration_codex'&&task.sessionCwd).slice(0,8).map(task=>({
        agent:'Codex',folder:task.sessionCwd!.split(/[\\/]/).filter(Boolean).pop()?.slice(0,120),state:task.state,
      }));
      if(agents.length)context.connections={...context.connections,codex:JSON.stringify({observedAt:new Date().toISOString(),sessions:agents,note:'Estado observado por hooks; no incluye el historial de conversaciones de Codex.'})};
    }
    return context;
  }},onEvent,draw);

  function draw() {
    if(disposed)return;
    const state=controller.state;const busy=state.activeRequestId!==null;
    connect.hidden=state.account?.state==='connected'||state.phase==='loading';
    conversations.setOptions([{value:'',label:t('Nueva conversación')},...state.conversations.map(c=>({value:c.id,label:c.title}))],state.conversation?.id??'',busy||state.phase==='loading');
    send.disabled=!controller.canSend;input.disabled=busy;cancel.hidden=!busy;
    error.textContent=state.error?.message??(state.phase==='loading'?'Verificando cuenta…':'');
    error.hidden=!error.textContent;
    if(renderedConversation!==state.conversation||renderedPending!==state.pendingMessage||renderedActive!==state.activeRequestId){
      renderedConversation=state.conversation;renderedPending=state.pendingMessage;renderedActive=state.activeRequestId;
      clear(log);live=null;
      for(const message of state.conversation?.messages??[])if(message.role!=='system')log.append(bubble({id:0,role:message.role,content:message.content}));
      if(state.pendingMessage)log.append(bubble({id:0,role:'user',content:state.pendingMessage}));
      if(busy)log.append(typingDots());
      // Presentation mirror consumed only by the unchanged island height policy.
      // It is never used as request history; UUID/revision remain in the controller.
      State.chatHistory=(state.conversation?.messages??[]).filter(m=>m.role!=='system').map((m,index)=>({id:index,role:m.role as 'user'|'assistant',content:m.content}));
      if(state.pendingMessage)State.chatHistory.push({id:-1,role:'user',content:state.pendingMessage});
      onHeightChange();
    }
    if(state.liveText){if(!live){log.querySelector('.typing')?.parentElement?.remove();live=h('div',{class:'reply'});log.append(h('div',{class:'chat-row'},live));}renderMarkdown(live,state.liveText);}
    log.scrollTop=log.scrollHeight;
    State.stateOverride=busy?'thinking':null;State.notify();
    syncFile();
  }
  function syncFile(){const name=State.droppedFile?.name??'';chip.textContent=name?`${name} · archivo local, no compartido`:'';chip.hidden=!name;}
  async function submit(){if(!input.value.trim()||!controller.canSend)return;const text=input.value;
    const model=controller.state.models.find(m=>m.id===State.settings.novoChatModel)??controller.state.models.find(m=>m.id==='auto')??controller.state.models[0];
    if(!model)return;
    const twinMode=Boolean(State.settings.novoTwinMode&&model.allowsTwinMode&&controller.state.account?.authorization?.capabilities.twinRead);
    const sending=controller.send(text,model.id,twinMode);input.value='';Sound.play('send');await sending;
    if(!disposed){if(controller.state.error)Sound.play('error');else Sound.play('finish');input.focus();}}
  send.addEventListener('click',()=>void submit());
  input.addEventListener('input',()=>{send.disabled=!controller.canSend;});
  input.addEventListener('keydown',event=>{const key=(event as KeyboardEvent).key;if(key==='Enter'){event.preventDefault();void submit();}event.stopPropagation();});
  const stop=()=>{if(disposed)return;disposed=true;controller.dispose();conversations.dispose();window.removeEventListener('beforeunload',stop);};
  window.addEventListener('beforeunload',stop);
  void controller.loadAccount();
  return {el,sync:syncFile,focus:()=>input.focus(),dispose:stop};
}

// Explicit legacy fixture/advanced adapter; never a fallback for Novo account errors.
export function buildLegacyPrompt(onHeightChange: () => void): ViewHost {
  const chipRow = h("div", { class: "chip-row" });
  const log = h("div", { class: "chat-log" });
  const input = h("input", {
    type: "text",
    class: "chat-input",
    placeholder: t(STRINGS.placeholderFirst),
    spellcheck: "false",
  }) as HTMLInputElement;
  const send = h("button", { class: "send-btn", title: tl(STRINGS.send) }, svg(ICONS.arrowUp, 11));
  const bar = h("div", { class: "chat-bar" }, input, send);

  const modelDot = h("i", { class: "model-dot" });
  const modelName = h("span", { class: "model-name" });
  const modelBtn = h(
    "button",
    { class: "model-btn", title: tl(STRINGS.switchModel) },
    modelDot,
    modelName,
    svg(ICONS.chevronUpDown, 9, { stroke: 2 }),
  );
  const modelRow = h("div", { class: "model-row" }, modelBtn);

  const body = h("div", { class: "chat-body" });
  const picker = buildPicker(() => {
    body.classList.toggle("picking", picker.isOpen);
    drawModelButton();
  });
  body.append(chipRow, log, picker.el, modelRow, bar);

  const el = h("div", { class: "view" }, h("div", { class: "card wash chat-card" }, body));
  (el.querySelector(".card") as HTMLElement).style.setProperty("--wash", "rgba(99,102,241,0.5)");

  let sending = false;
  let renderedCount = -1;
  // A local model answers token by token: where its text so far is shown.
  let live: HTMLElement | null = null;

  function drawModelButton() {
    const p = providerDef(State.settings.chatProvider);
    modelDot.style.background = p.accent;
    modelName.textContent = activeModel(State.settings) || t(STRINGS.noModel);
    modelBtn.classList.toggle("open", picker.isOpen);
    modelBtn.disabled = sending;
  }

  modelBtn.addEventListener("click", () => {
    if (sending) return;
    if (picker.isOpen) picker.close();
    else picker.open();
  });

  void onEvent<string>("chat-delta", (text) => {
    if (!sending || !text) return; // nothing visible yet: the dots stay
    if (!live) {
      live = h("div", { class: "reply" });
      log.querySelector(".typing")?.parentElement?.remove();
      log.append(h("div", { class: "chat-row" }, live));
    }
    renderMarkdown(live, text);
    log.scrollTop = log.scrollHeight;
  });

  async function submit() {
    const query = input.value.trim();
    if (!query || sending) return;
    if (picker.isOpen) picker.close();
    input.value = "";
    sending = true;
    drawModelButton();
    Sound.play("send");

    State.chatHistory.push({ id: nextId++, role: "user", content: query });
    State.stateOverride = "thinking";
    State.notify();
    onHeightChange();

    const file = State.droppedFile;
    const context: ChatContext | null =
      State.chatHistory.length === 1 && file ? { kind: "file", name: file.name, path: file.path } : null;

    try {
      const reply = await Bridge.chatSend(query, context);
      State.chatHistory.push({ id: nextId++, role: "assistant", content: reply.text });
      State.stateOverride = null;
      Sound.play("finish");
    } catch (err) {
      State.stateOverride = null;
      State.noteMessage = String(err).replace(/^Error:\s*/, "");
      State.view = "note";
      Sound.play("error");
    } finally {
      sending = false;
      live = null;
      renderedCount = -1; // the finished answer replaces the streamed one
      drawModelButton();
      State.notify();
      onHeightChange();
      input.focus();
    }
  }

  send.addEventListener("click", () => void submit());
  input.addEventListener("keydown", (e) => {
    const key = (e as KeyboardEvent).key;
    if (key === "Enter") {
      e.preventDefault();
      void submit();
    } else if (key === "Escape" && picker.isOpen) {
      e.preventDefault();
      picker.close();
    }
    e.stopPropagation(); // Escape closes the island, not the chat
  });

  return {
    el,
    sync() {
      const file = State.droppedFile;
      const wantChip = file?.name ?? "";
      if (chipRow.dataset.label !== wantChip) {
        chipRow.dataset.label = wantChip;
        clear(chipRow);
        if (wantChip) chipRow.append(contextChip(wantChip));
      }

      const thinking = State.stateOverride === "thinking";
      const count = State.chatHistory.length + (thinking ? 0.5 : 0);
      if (count !== renderedCount && !live) {
        renderedCount = count;
        clear(log);
        for (const m of State.chatHistory) log.append(bubble(m));
        if (thinking) log.append(typingDots());
        log.scrollTop = log.scrollHeight;
      }

      // Leaving the chat folds the picker away.
      if (State.view !== "prompt" && picker.isOpen) picker.close();
      drawModelButton();

      input.placeholder = t(State.chatHistory.length === 0 ? STRINGS.placeholderFirst : STRINGS.placeholderNext);
      input.disabled = sending;
    },
    focus() {
      input.focus();
      input.select();
    },
  };
}
