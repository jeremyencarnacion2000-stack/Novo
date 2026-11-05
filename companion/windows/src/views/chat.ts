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
import { Bridge, onEvent, type ChatContext, type ModelInfo, type DesktopWindowChoice } from "../core/bridge";
import {
  activeModel, pickModel, providerDef, visibleProviders, withModel, type ProviderDef,
} from "../core/providers";
import { Sound } from "../core/sound";
import { State, type ChatMessage, type Settings } from "../core/state";
import type { ViewHost } from "./views";
import { N_, t, tl } from "../i18n/i18n";
import { NovoChatController } from '../core/novo-chat';
import { CompanionDictation, dictationMessage } from "../core/companion-dictation";
import {parseDesktopCommand,executeDesktopCommand,type DesktopWindowAction} from '../core/desktop-command';
import { buildCodexPrompt } from './codex-chat';
import { buildReplySpeech } from './reply-speech';

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
const VOICE_LABELS = { start: N_("Start dictation"), stop: N_("Stop dictation") };

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

export function buildPrompt(onHeightChange: () => void): ViewHost {
  const el = h('div', { class: 'view' });
  let child: ViewHost | null = null;
  let backend = '';
  let disposed = false;
  function sync() {
    if (disposed) return;
    const wanted = State.settings.chatProvider === 'codex' ? 'codex' : 'novo';
    if (wanted !== backend) {
      backend = wanted;
      const previous = child;
      child = null;
      previous?.dispose?.();
      State.chatHistory = [];
      child = wanted === 'codex' ? buildCodexPrompt(onHeightChange) : buildAccountPrompt(onHeightChange);
      child.el.classList.remove('view');
      child.el.style.height = '100%';
      clear(el);
      el.append(child.el);
      el.dataset.backend = wanted;
    }
    child?.sync();
  }
  sync();
  return { el, sync, focus: () => child?.focus?.(), dispose() {
    if (disposed) return;
    disposed = true;
    child?.dispose?.();
    child = null;
  } };
}

/** The signed-in Novo account and server history remain independent of local plan chat. */
function buildAccountPrompt(onHeightChange: () => void): ViewHost {
  let dictation: CompanionDictation | null = null;
  const playback=buildReplySpeech(()=>dictation?.cancel());
  const conversations=buildChoiceMenu('novo-conversations',t('Conversación de Novo'),value=>{++speechTurn;playback.stop();voiceDraft=false;speakLocalResult=false;localExchange=null;localWindows=[];void controller.selectConversation(value);},open=>{body.classList.toggle('history-open',open);});
  const settingsButton=h('button',{type:'button',class:'novo-chat-settings','aria-label':tl('Configuración del chat'),title:tl('Configuración del chat'),onclick:()=>void Bridge.openSettingsWindow('assistant')},svg(ICONS.gear,12));
  const connect=h('button',{type:'button',class:'novo-chat-link',text:tl('Conectar'),onclick:()=>void Bridge.openNovo()});
  const header=h('div',{class:'novo-chat-heading'},conversations.el,connect,playback.el,settingsButton);
  const chip=h('div',{class:'novo-unshared-file'});
  const log=h('div',{class:'chat-log','aria-label':tl('Mensajes de la cuenta')});
  const actionPanel=h('div',{class:'novo-action-list','aria-live':'polite'});
  const error=h('div',{class:'novo-chat-error',role:'status','aria-live':'polite'});
  const voiceStatus=h('div',{class:'novo-voice-status',role:'status','aria-live':'polite',hidden:true});
  const input=h('input',{class:'chat-input',type:'text',maxlength:12000,'aria-label':tl('Mensaje para Novo'),placeholder:tl('Habla con Novo…')});
  const send=h('button',{class:'send-btn','aria-label':tl('Enviar mensaje')},svg(ICONS.arrowUp,11));
  const voiceButton=h("button",{type:"button",class:"novo-voice-button","aria-label":tl(VOICE_LABELS.start),title:tl("The speech service may process audio outside Novo. Novo receives only the text you send."),"aria-description":tl("The speech service may process audio outside Novo. Novo receives only the text you send.")},svg(ICONS.mic,14,{stroke:1.8}));
  const cancel=h('button',{class:'novo-chat-link',text:tl('Cancelar respuesta'),onclick:()=>{cancelDesktop();void controller.cancel();}});
  const bar=h('div',{class:'chat-bar'},input,cancel,voiceButton,send);
  const body=h('div',{class:'chat-body novo-chat-body'},header,chip,log,actionPanel,error,voiceStatus,playback.status,bar);
  const el=h('div',{class:'view'},h('div',{class:'card wash chat-card'},body));
  (el.querySelector('.card') as HTMLElement).style.setProperty('--wash','rgba(99,102,241,0.5)');
  let renderedConversation:unknown=null;let renderedPending='';let renderedActive:string|null=null;
  let localExchange:{request:string;response:string;continuing?:boolean}|null=null;
  let localWindows:DesktopWindowChoice[]=[];
  let voiceDraft=false;let speakLocalResult=false;
  let localWindowAction:DesktopWindowAction='focus';
  let localBusy=false;let localRequestId:string|null=null;
  function cancelDesktop(){if(localRequestId){++speechTurn;void Bridge.desktopActionCancel(localRequestId).catch(()=>{});}}
  let live:HTMLElement|null=null;let disposed=false;
  let speechTurn=0;let speechAccount='';
  const currentSpeechTurn=(turn:number)=>!disposed&&turn===speechTurn&&State.view==='prompt';
  let stopSettings:(()=>void)|null=null;
  dictation=new CompanionDictation({
    transcript(text,recognized){input.value=text;voiceDraft=Boolean(recognized&&text.trim());send.disabled=!controller.canSend||Boolean(dictation?.isListening);},
    preparing(){
      voiceStatus.textContent=t('Preparando el micrófono…');voiceStatus.hidden=false;delete voiceStatus.dataset.error;
      voiceButton.setAttribute('aria-label',t(VOICE_LABELS.stop));voiceButton.replaceChildren(svg(ICONS.stop,11,{stroke:1.8}));
      send.disabled=true;input.disabled=true;State.stateOverride='thinking';State.notify();onHeightChange();
    },
    listening(active){
      body.classList.toggle('voice-listening',active);
      voiceButton.classList.toggle('listening',active);
      voiceButton.setAttribute("aria-label",t(active?VOICE_LABELS.stop:VOICE_LABELS.start));
      voiceButton.replaceChildren(svg(active?ICONS.stop:ICONS.mic,active?11:14,{stroke:1.8}));
      voiceStatus.textContent=active?t("Listening… press the microphone button again to stop"):"";
      voiceStatus.hidden=!active&&!voiceStatus.dataset.error;
      if(active)delete voiceStatus.dataset.error;
      State.stateOverride=active?"listening":null;
      State.notify();
      send.disabled=!controller.canSend||active;
      input.disabled=active||localBusy||Boolean(controller.state.activeRequestId);
      onHeightChange();
    },
    processing(){voiceStatus.textContent=t("Transcribing on this PC…");voiceStatus.hidden=false;State.stateOverride='thinking';State.notify();onHeightChange();},
    error(kind){
      voiceStatus.textContent=dictationMessage(kind);voiceStatus.hidden=false;voiceStatus.dataset.error='true';onHeightChange();
    },
  });
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
  void onEvent<Settings>('settings-changed',settings=>{
    cancelDesktop();State.settings={...State.settings,...settings};
    playback.settingsChanged();
    dictation?.cancel();
  }).then(stop=>{if(disposed)stop();else stopSettings=stop;});

  function draw() {
    if(disposed)return;
    const state=controller.state;const busy=state.activeRequestId!==null;
    const accountKey=state.account?.state==='connected'?state.account.authorization?.user.id??'':'';
    if(accountKey!==speechAccount){cancelDesktop();speechAccount=accountKey;++speechTurn;playback.stop();dictation?.cancel();voiceDraft=false;speakLocalResult=false;localExchange=null;localWindows=[];}
    const replies=(state.conversation?.messages??[]).filter(m=>m.role==='assistant');
    playback.update(state.account?.state==='connected'?`${state.account.authorization?.user.id}/${state.conversation?.id??''}`:'',(!localExchange?.continuing?localExchange?.response:undefined)??replies[replies.length-1]?.content??'');
    connect.hidden=state.account?.state==='connected'||state.phase==='loading';
    conversations.setOptions([{value:'',label:t('Nueva conversación')},...state.conversations.map(c=>({value:c.id,label:c.title}))],state.conversation?.id??'',busy||localBusy||state.phase==='loading');
    send.disabled=!controller.canSend||Boolean(dictation?.isListening)||localBusy;input.disabled=busy||localBusy||Boolean(dictation?.isListening);cancel.hidden=!busy&&!localBusy;voiceButton.disabled=busy||localBusy;
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
    clear(actionPanel);
    for(const action of state.assistantActions){
      const card=h('section',{class:`novo-action-card ${action.status}`,'aria-label':`Acción de Novo: ${action.title}`});
      card.append(h('div',{class:'novo-action-title',text:action.title}),h('div',{class:'novo-action-description',text:action.status==='proposed'?'Novo propone crear esta tarea.':action.status==='succeeded'?'Tarea creada en Novo.':action.status==='rejected'?'No se creó la tarea.':'La propuesta venció sin cambios.'}));
      if(action.status==='proposed'){
        const controls=h('div',{class:'novo-action-controls'});
        for(const [decision,label] of [['confirm','Aprobar'],['deny','Ahora no']] as const){
          const button=h('button',{type:'button',class:decision==='confirm'?'novo-action-approve':'novo-action-deny',text:label,'aria-label':`${label}: ${action.title}`});
          button.disabled=state.actionBusyId===action.id||Boolean(state.actionBusyId);
          button.addEventListener('click',()=>void controller.decideAssistantAction(action.id,action.revision,decision));
          controls.append(button);
        }
        card.append(controls);
      }
      actionPanel.append(card);
    }
    if(state.actionError)actionPanel.append(h('p',{class:'novo-action-error',role:'status',text:state.actionError}));
    if(localExchange){
      const list=h('section',{class:'novo-action-card','aria-label':t('Resultado local de Novo')},h('div',{class:'novo-action-title',text:localExchange.request}),h('div',{class:'novo-action-description',text:localExchange.response}));
      if(localWindows.length)list.append(h('div',{class:'novo-action-description',text:t('Elige una ventana')}));
      for(const item of localWindows){
        const row=h('div',{class:'row'},h('span',{text:item.title||t('Ventana sin título')}),h('span',{class:'spacer'}));
        const button=h('button',{type:'button',class:'novo-action-approve',text:t('Aplicar')});
        button.addEventListener('click',()=>void applyWindowAction(item));row.append(button);list.append(row);
      }
      actionPanel.append(list);
    }
    actionPanel.hidden=state.assistantActions.length===0&&!state.actionError&&!localExchange;
    log.scrollTop=log.scrollHeight;
    State.stateOverride=dictation?.isListening?'listening':busy?'thinking':null;State.notify();
    syncFile();
  }
  function syncFile(){const name=State.droppedFile?.name??'';chip.textContent=name?`${name} · archivo local, no compartido`:'';chip.hidden=!name;}
  async function runDesktopCommand(text:string,command:NonNullable<ReturnType<typeof parseDesktopCommand>>,turn:number,speakReply:boolean){
    if(localBusy)return;const exchange={request:text,response:t('Comprobando la autorización y la app en este PC…')};localBusy=true;localRequestId=crypto.randomUUID();localExchange=exchange;localWindows=[];draw();
    try{
      const result=await executeDesktopCommand(Bridge,command,()=>currentSpeechTurn(turn),localRequestId??undefined);
      if(!currentSpeechTurn(turn))return;
      exchange.response=result.response;localWindows=result.windows??[];
      if(command.action!=='open')localWindowAction=command.action;
      if(result.continuation){
        const model=controller.state.models.find(m=>m.id===State.settings.novoChatModel)??controller.state.models[0];
        if(model){
          localExchange={...exchange,continuing:true};
          await controller.send(result.continuation.message,model.id,Boolean(State.settings.novoTwinMode&&model.allowsTwinMode&&controller.state.account?.authorization?.capabilities.twinRead),result.continuation.context);
        }
      }
    }catch{exchange.response=t('No pude confirmar el resultado en Windows. Revisa los permisos y la ventana; no repetí la acción.');if(currentSpeechTurn(turn))localWindows=[];}
    finally{localBusy=false;localRequestId=null;if(!disposed){draw();if(currentSpeechTurn(turn))playback.readReply(speakReply);onHeightChange();}}
  }
  async function applyWindowAction(window:DesktopWindowChoice){
    if(localBusy)return;const turn=++speechTurn;localBusy=true;localRequestId=crypto.randomUUID();draw();
    try{await Bridge.desktopWindowAction(window.id,localWindowAction,localRequestId??undefined);if(currentSpeechTurn(turn)){localExchange={request:localExchange?.request??'',response:t('Listo. Windows confirmó el cambio de ventana.')};localWindows=[];}}
    catch{if(currentSpeechTurn(turn)){localExchange={request:localExchange?.request??'',response:t('Windows no permitió cambiar esta ventana. No se aplicaron más acciones.')};localWindows=[];}}
    finally{localBusy=false;localRequestId=null;if(!disposed){draw();if(currentSpeechTurn(turn))playback.readReply(speakLocalResult);onHeightChange();}}
  }
  async function submit(){if(dictation?.isListening){dictation.stop();return;}if(!input.value.trim()||!controller.canSend||localBusy)return;const text=input.value;
    const turn=++speechTurn;playback.stop();
    const desktopCommand=parseDesktopCommand(text);
    if(desktopCommand){const speakReply=voiceDraft;voiceDraft=false;speakLocalResult=speakReply;input.value='';void runDesktopCommand(text,desktopCommand,turn,speakReply);return;}
    localExchange=null;localWindows=[];
    const model=controller.state.models.find(m=>m.id===State.settings.novoChatModel)??controller.state.models.find(m=>m.id==='auto')??controller.state.models[0];
    if(!model)return;
    const twinMode=Boolean(State.settings.novoTwinMode&&model.allowsTwinMode&&controller.state.account?.authorization?.capabilities.twinRead);
    const speakReply=voiceDraft;voiceDraft=false;
    const sending=controller.send(text,model.id,twinMode);input.value='';Sound.play('send');await sending;
    if(currentSpeechTurn(turn)){if(controller.state.error)Sound.play('error');else{Sound.play('finish');playback.readReply(speakReply);}input.focus();}}
  send.addEventListener('click',()=>void submit());
  voiceButton.addEventListener('click',()=>{
    playback.stop();
    if(dictation?.isListening){dictation.stop();return;}
    if(State.settings.voiceInputMode==='cloud'&&!State.settings.voiceCloudConsent){
      voiceStatus.textContent=t('Voice dictation is off. Enable it in Novo Settings → Assistant to allow the speech service to process audio.');
      voiceStatus.hidden=false;voiceStatus.dataset.error='true';
      void Bridge.openSettingsWindow('assistant');
      return;
    }
    voiceStatus.hidden=true;delete voiceStatus.dataset.error;
    dictation?.start(input.value);
  });
  conversations.el.addEventListener('click',()=>{playback.stop();dictation?.cancel();});
  input.addEventListener('input',()=>{send.disabled=!controller.canSend||Boolean(dictation?.isListening);});
  input.addEventListener('keydown',event=>{const key=(event as KeyboardEvent).key;if(key==='Escape'&&dictation?.isListening){event.preventDefault();dictation.cancel();voiceStatus.hidden=true;delete voiceStatus.dataset.error;}else if(key==='Enter'){event.preventDefault();void submit();}event.stopPropagation();});
  const stop=()=>{if(disposed)return;cancelDesktop();disposed=true;stopSettings?.();dictation?.dispose();playback.dispose();if(State.stateOverride==='listening'){State.stateOverride=null;State.notify();}controller.dispose();conversations.dispose();window.removeEventListener('beforeunload',stop);};
  window.addEventListener('beforeunload',stop);
  void controller.loadAccount();
  return {el,sync(){syncFile();if(State.view!=='prompt'){cancelDesktop();++speechTurn;playback.stop();dictation?.cancel();}},focus:()=>input.focus(),dispose:stop};
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
