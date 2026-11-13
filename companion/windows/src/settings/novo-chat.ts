import { Bridge, onEvent, type DesktopAppChoice, type NovoContextFolder } from '../core/bridge';
import { accountLabel } from '../core/novo-chat';
import { runtimeLabel } from '../core/project-work';
import type { Settings } from '../core/state';
import { h, clear } from '../views/dom';
import { t } from '../i18n/i18n';

/** Account chat preferences belong in a full window, never over the messages. */
export function novoChatSection(settings:Settings, save:()=>Promise<void>):{el:HTMLElement;dispose:()=>void} {
  let disposed=false;let unsubscribe:(()=>void)|null=null;let generation=0;
  const status=h('p',{class:'hint',role:'status',text:t('Cargando modelos de tu cuenta…')});
  const permission=h('p',{class:'hint',hidden:true});
  const runtimes=h('div',{class:'hint',role:'status',text:t('Comprobando capacidades de este PC…')});
  const model=h('select',{'aria-label':t('Modelo de Novo')});
  const source=h('select',{'aria-label':t("Response source")},h('option',{value:'novo',text:t("Novo account")}),h('option',{value:'codex',text:'ChatGPT Codex'}));
  source.value=settings.chatProvider==='codex'?'codex':'novo';
  const twin=h('input',{type:'checkbox',checked:settings.novoTwinMode,'aria-label':t('Personalizar con mi Twin')});
  const connections=h('input',{type:'checkbox',checked:settings.novoLocalConnections,'aria-label':t('Consultar conexiones locales')});
  const voiceConsent=h('input',{type:'checkbox',checked:settings.voiceCloudConsent,'aria-label':t('Allow'),'aria-description':t('The speech service may process audio outside Novo. Novo receives only the text you send.')});
  const inputMode=h('select',{'aria-label':t("Voice input")},h('option',{value:'local',text:t("Local · Spanish and English")}),h('option',{value:'cloud',text:t("Connected speech service")}),h('option',{value:'off',text:t("Off")}));
  inputMode.value=settings.voiceInputMode??'local';
  const inputLanguage=h('select',{'aria-label':t('Idioma del dictado local')},h('option',{value:'auto',text:t('Automático')}),h('option',{value:'es',text:'Español'}),h('option',{value:'en',text:'English'}));
  inputLanguage.value=settings.voiceInputLanguage??'auto';
  const localLanguage=h('div',{class:'row',hidden:inputMode.value!=='local'},h('label',{text:t('Idioma del dictado local')}),inputLanguage);
  const cloudConsent=h('div',{hidden:inputMode.value!=='cloud'},h('label',{class:'row'},voiceConsent,h('span',{text:t('Allow')})),h('p',{class:'hint',text:t('The speech service may process audio outside Novo. Novo receives only the text you send.')}));
  const spokenReplies=h('input',{type:'checkbox',checked:settings.voiceSpokenReplies,'aria-label':t("Read replies aloud")});
  const localVoice=h('select',{'aria-label':t("Windows voice")},h('option',{value:'',text:t("Spanish (automatic)")}));
  const localVoiceStatus=h('p',{class:'hint',role:'status',text:t("Audio is generated on this PC.")});
  const folderList=h('div',{class:'novo-settings-folders'});
  const desktopApps=h('div',{class:'novo-desktop-apps'});
  const desktopStatus=h('p',{class:'hint',role:'status'});
  const folderStatus=h('p',{class:'hint',role:'status'});
  let folders:NovoContextFolder[]=[];
  const normalize=(items:unknown):NovoContextFolder[]=>Array.isArray(items)?items:[];
  const failure=()=>{folderStatus.textContent=t('No se pudo completar la acción. Inténtalo de nuevo.');};
  function drawFolders(){
    clear(folderList);
    for(const folder of folders){
      const remove=h('button',{type:'button',text:t('Quitar'),'aria-label':`${t('Quitar carpeta')} ${folder.name}`});
      remove.addEventListener('click',()=>{remove.disabled=true;void Bridge.contextFoldersRemove(folder.id).then(items=>{folders=normalize(items);drawFolders();}).catch(()=>{remove.disabled=false;failure();});});
      folderList.append(h('div',{class:'row'},h('span',{text:folder.name}),h('span',{class:'spacer'}),remove));
    }
    folderStatus.textContent=folders.length?`${folders.length} ${t('carpetas elegidas')}`:t('Todavía no elegiste carpetas.');
  }
  let catalog:DesktopAppChoice[]=[];const savingApps=new Set<string>();
  const appSearch=h('input',{type:'search',placeholder:t("Search installed apps"),'aria-label':t("Search installed apps")});
  appSearch.addEventListener('input',()=>drawDesktopApps(catalog));
  const refreshApps=h('button',{type:'button',text:t("Refresh apps"),onclick:()=>{refreshApps.disabled=true;void Bridge.desktopAppCatalog(true).then(items=>{if(!disposed)drawDesktopApps(items);}).catch(()=>{desktopStatus.textContent=t('No se pudo consultar la lista local de apps.');}).finally(()=>{refreshApps.disabled=false;});}});
  desktopApps.style.maxHeight='320px';desktopApps.style.overflowY='auto';
  function drawDesktopApps(items:DesktopAppChoice[]){
    catalog=items;clear(desktopApps);
    for(const app of items.filter(item=>item.name.toLocaleLowerCase().includes(appSearch.value.toLocaleLowerCase()))){
      const row=h('div',{'aria-label':app.name});const controls:HTMLInputElement[]=[];
      row.append(h('strong',{text:app.name}));
      for(const [key,label,value] of [['open',t("Open"),app.canOpen],['control',t("Control windows"),app.canControl],['read',t("Read window titles"),app.canRead]] as const){
        const input=h('input',{type:'checkbox',checked:value,disabled:!app.available||savingApps.has(app.id),'aria-label':`${label}: ${app.name}`});
        input.addEventListener('change',()=>{
          if(savingApps.has(app.id))return;savingApps.add(app.id);controls.forEach(control=>{control.disabled=true;});
          const permissions={open:app.canOpen,control:app.canControl,read:app.canRead,[key]:input.checked};
          void Bridge.desktopAppPermissionsSet(app.id,permissions).then(result=>{
            savingApps.delete(app.id);if(disposed)return;settings.desktopPolicy=result.policy;drawDesktopApps(catalog.map(item=>item.id===app.id?result.app:item));
          }).catch(()=>{savingApps.delete(app.id);if(disposed)return;drawDesktopApps(catalog);desktopStatus.textContent=t('No se pudo guardar el permiso local.');});
        });
        controls.push(input);row.append(h('label',{class:'row'},input,h('span',{text:label})));
      }
      desktopApps.append(row);
    }
    desktopStatus.textContent=items.length?`${items.length} ${t("Installed apps")}`:t('No se pudo consultar la lista local de apps.');
  }
  async function verify(){
    const attempt=++generation;
    const local=settings.chatProvider==='codex';
    accountOptions.hidden=local;
    permission.hidden=true;
    if(local){status.textContent=t("ChatGPT Codex uses your local Codex login. This session stays separate from your Novo history.");return;}
    try {
      const [account,models]=await Promise.all([Bridge.novoAccountStatus(),Bridge.novoChatModels().catch(()=>[])]);
      if(disposed||attempt!==generation)return;
      status.textContent=models.length?t('Los modelos disponibles pertenecen a tu cuenta Novo.'):accountLabel(account);
      twin.disabled=!account.authorization?.capabilities.twinRead;
      permission.hidden=account.state!=='connected'||Boolean(account.authorization?.device?.scopes.includes('projects:read'));
      permission.textContent=t('Para relacionar también tus proyectos de Novo, vuelve a conectar la cuenta y autoriza leer proyectos.');
      clear(model);
      for(const choice of models)model.append(h('option',{value:choice.id,text:choice.label}));
      model.value=models.some(choice=>choice.id===settings.novoChatModel)?settings.novoChatModel:'auto';
      model.disabled=!models.length;
    }catch{if(!disposed&&attempt===generation)status.textContent=t('No se pudo verificar la cuenta.');}
  }
  source.addEventListener('change',()=>{settings.chatProvider=source.value==='codex'?'codex':'anthropic';void save().then(verify).catch(failure);});
  model.addEventListener('change',()=>{settings.novoChatModel=model.value;void save().catch(failure);});
  twin.addEventListener('change',()=>{settings.novoTwinMode=twin.checked;void save().catch(failure);});
  connections.addEventListener('change',()=>{settings.novoLocalConnections=connections.checked;void save().catch(failure);});
  voiceConsent.addEventListener('change',()=>{
    const next=voiceConsent.checked;settings.voiceCloudConsent=next;
    void save().catch(()=>{settings.voiceCloudConsent=!next;voiceConsent.checked=!next;failure();});
  });
  inputMode.addEventListener('change',()=>{
    const previous=settings.voiceInputMode;
    settings.voiceInputMode=inputMode.value==='cloud'?'cloud':inputMode.value==='off'?'off':'local';
    cloudConsent.hidden=settings.voiceInputMode!=='cloud';
    localLanguage.hidden=settings.voiceInputMode!=='local';
    void save().catch(()=>{settings.voiceInputMode=previous;inputMode.value=previous;cloudConsent.hidden=previous!=='cloud';localLanguage.hidden=previous!=='local';failure();});
  });
  inputLanguage.addEventListener('change',()=>{
    const previous=settings.voiceInputLanguage;settings.voiceInputLanguage=inputLanguage.value==='es'?'es':inputLanguage.value==='en'?'en':'auto';
    void save().catch(()=>{settings.voiceInputLanguage=previous;inputLanguage.value=previous;failure();});
  });
  spokenReplies.addEventListener('change',()=>{
    const previous=settings.voiceSpokenReplies;settings.voiceSpokenReplies=spokenReplies.checked;
    void save().catch(()=>{settings.voiceSpokenReplies=previous;spokenReplies.checked=previous;failure();});
  });
  localVoice.addEventListener('change',()=>{
    const previous=settings.voiceLocalVoiceId;settings.voiceLocalVoiceId=localVoice.value;
    void save().catch(()=>{settings.voiceLocalVoiceId=previous;localVoice.value=previous;failure();});
  });
  const pick=h('button',{type:'button',text:t('Elegir carpetas')});
  pick.addEventListener('click',()=>{pick.disabled=true;void Bridge.contextFoldersPick().then(items=>{folders=normalize(items);drawFolders();}).catch(failure).finally(()=>{pick.disabled=false;});});
  const accountOptions=h('div',{},permission,h('button',{type:'button',class:'novo-account-shortcut',text:t('Gestionar cuenta y permisos'),onclick:()=>void Bridge.openSettingsWindow('account')}),
    h('div',{class:'row'},h('label',{text:t('Modelo de Novo')}),model),
    h('label',{class:'row'},twin,h('span',{text:t('Personalizar con mi Twin')})));
  const section=h('section',{class:'novo-chat-preferences'},h('h2',{text:t('Tu asistente Novo')}),
    h('h2',{text:t('Voz y privacidad')}),
    h('div',{class:'row'},h('label',{text:t("Voice input")}),inputMode),
    localLanguage,
    h('p',{class:'hint',text:t("Local dictation starts only when you press the microphone. Review the text before sending. Audio stays on this PC; low memory stops recognition.")}),cloudConsent,
    h('label',{class:'row'},spokenReplies,h('span',{text:t("Read replies aloud")})),
    h('div',{class:'row'},h('label',{text:t("Windows voice")}),localVoice),localVoiceStatus,
    h('div',{class:'row'},h('label',{text:t("Response source")}),source),status,accountOptions,
    h('label',{class:'row'},connections,h('span',{text:t('Consultar conexiones locales')})),
    h('p',{class:'hint',text:t('Al preguntar, Novo consulta GitHub y Vercel conectados a este PC y usa el estado de agentes como Codex. Los resúmenes se envían a tu cuenta Novo; las claves permanecen en este PC.')}),
    h('button',{type:'button',text:t('Seguimiento y memoria de proyectos'),onclick:()=>{void Bridge.novoAccountStatus().then(account=>{const origin=account?.authorization?settings.companionApiOrigin:null;if(origin)void Bridge.openUrl(`${origin}/settings?tab=twin`);else failure();});}}),
    h('h2',{text:t('Trabajos delegados')}),h('p',{class:'hint',text:t('Activa reglas por proyecto en Seguimiento y memoria. Cada regla elige un PC y una carpeta. Seguir un proyecto no autoriza ejecutar cambios.')}),runtimes,
    h('button',{type:'button',text:t('Ver estado de los trabajos'),onclick:()=>{void Bridge.novoAccountStatus().then(account=>{const origin=account?.authorization?settings.companionApiOrigin:null;if(origin)void Bridge.openUrl(`${origin}/activity`);else failure();}).catch(failure);}}),
    h('h2',{text:t('Control de apps de este PC')}),h('p',{class:'hint',text:t("Installed apps can be opened and controlled when you ask. Turn off either permission to exclude an app. Reading window titles is separate and starts off; this never grants reading app contents.")}),appSearch,refreshApps,desktopApps,desktopStatus,
    h('h2',{text:t('Carpetas para dar contexto')}),h('p',{class:'hint',text:t('Elige dónde trabajas. Novo reconoce repositorios y proyectos de Vercel y sincroniza sus nombres y estado. Las rutas y claves se quedan en este PC. Puedes quitar el acceso en cualquier momento.')}),
    folderList,h('div',{class:'row'},pick,folderStatus));
  void verify();void Bridge.contextFoldersList().then(items=>{if(disposed)return;folders=normalize(items);drawFolders();}).catch(()=>{if(!disposed)failure();});
  void Bridge.voiceChoices().then(items=>{
    if(disposed)return;const voices=Array.isArray(items)?items:[];
    for(const voice of voices)localVoice.append(h('option',{value:voice.id,text:voice.name}));
    localVoice.value=settings.voiceLocalVoiceId??'';
    if(!voices.some(voice=>voice.spanish)&&!settings.voiceLocalVoiceId)localVoiceStatus.textContent=t("No local Spanish voice. Install one in Windows Settings → Time & language → Speech.");
  }).catch(()=>{if(disposed)return;localVoice.disabled=true;localVoiceStatus.textContent=t("Local speech is unavailable. Check your Windows voice settings.");});
  void Bridge.desktopAppCatalog().then(items=>{if(!disposed)drawDesktopApps(items);}).catch(()=>{if(!disposed)desktopStatus.textContent=t('No se pudo consultar la lista local de apps.');});
  void Bridge.projectWorkRuntimes().then(items=>{if(disposed)return;clear(runtimes);for(const item of items)runtimes.append(h('p',{text:runtimeLabel(item)}));}).catch(()=>{if(!disposed)runtimes.textContent=t('No se pudieron verificar las capacidades de este PC.');});
  void onEvent('novo-account-changed',()=>void verify()).then(stop=>{if(disposed)stop();else unsubscribe=stop;});
  return {el:section,dispose:()=>{disposed=true;++generation;unsubscribe?.();}};
}
