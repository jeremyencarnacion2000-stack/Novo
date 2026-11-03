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
  function drawDesktopApps(items:DesktopAppChoice[]){
    clear(desktopApps);
    for(const app of items){
      const input=h('input',{type:'checkbox',checked:app.allowed,disabled:!app.available,'aria-label':`${t('Permitir a Novo controlar')} ${app.name}`});
      input.addEventListener('change',()=>{input.disabled=true;void Bridge.desktopAppAllowedSet(app.id,input.checked).then(allowed=>{
        settings.desktopAllowedApps=allowed;drawDesktopApps(items.map(item=>item.id===app.id?{...item,allowed:allowed.includes(item.id)}:item));
      }).catch(()=>{input.checked=app.allowed;input.disabled=!app.available;desktopStatus.textContent=t('No se pudo guardar el permiso local.');});});
      desktopApps.append(h('label',{class:'row'},input,h('span',{text:app.name}),h('span',{class:'spacer'}),h('span',{class:'hint',text:app.available?'':t('No instalada')})));
    }
    if(items.length===0)desktopApps.append(h('p',{class:'hint',text:t('No se pudo consultar la lista local de apps.')}));
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
  const pick=h('button',{type:'button',text:t('Elegir carpetas')});
  pick.addEventListener('click',()=>{pick.disabled=true;void Bridge.contextFoldersPick().then(items=>{folders=normalize(items);drawFolders();}).catch(failure).finally(()=>{pick.disabled=false;});});
  const accountOptions=h('div',{},permission,h('button',{type:'button',class:'novo-account-shortcut',text:t('Gestionar cuenta y permisos'),onclick:()=>void Bridge.openSettingsWindow('account')}),
    h('div',{class:'row'},h('label',{text:t('Modelo de Novo')}),model),
    h('label',{class:'row'},twin,h('span',{text:t('Personalizar con mi Twin')})));
  const section=h('section',{class:'novo-chat-preferences'},h('h2',{text:t('Tu asistente Novo')}),
    h('h2',{text:t('Voz y privacidad')}),
    h('label',{class:'row'},voiceConsent,h('span',{text:t('Allow')})),
    h('p',{class:'hint',text:t('The speech service may process audio outside Novo. Novo receives only the text you send.')}),
    h('div',{class:'row'},h('label',{text:t("Response source")}),source),status,accountOptions,
    h('label',{class:'row'},connections,h('span',{text:t('Consultar conexiones locales')})),
    h('p',{class:'hint',text:t('Al preguntar, Novo consulta GitHub y Vercel conectados a este PC y usa el estado de agentes como Codex. Los resúmenes se envían a tu cuenta Novo; las claves permanecen en este PC.')}),
    h('button',{type:'button',text:t('Seguimiento y memoria de proyectos'),onclick:()=>{void Bridge.novoAccountStatus().then(account=>{const origin=account?.authorization?settings.companionApiOrigin:null;if(origin)void Bridge.openUrl(`${origin}/settings?tab=twin`);else failure();});}}),
    h('h2',{text:t('Trabajos delegados')}),h('p',{class:'hint',text:t('Activa reglas por proyecto en Seguimiento y memoria. Cada regla elige un PC y una carpeta. Seguir un proyecto no autoriza ejecutar cambios.')}),runtimes,
    h('button',{type:'button',text:t('Ver estado de los trabajos'),onclick:()=>{void Bridge.novoAccountStatus().then(account=>{const origin=account?.authorization?settings.companionApiOrigin:null;if(origin)void Bridge.openUrl(`${origin}/activity`);else failure();}).catch(failure);}}),
    h('h2',{text:t('Control de apps de este PC')}),h('p',{class:'hint',text:t('Elige las apps que Novo podrá abrir y manejar al pedirlo. Las rutas y títulos de ventanas permanecen en este dispositivo. Debes volver a conectar el Companion para otorgar estos permisos.')}),desktopApps,desktopStatus,
    h('h2',{text:t('Carpetas para dar contexto')}),h('p',{class:'hint',text:t('Elige dónde trabajas. Novo reconoce repositorios y proyectos de Vercel y sincroniza sus nombres y estado. Las rutas y claves se quedan en este PC. Puedes quitar el acceso en cualquier momento.')}),
    folderList,h('div',{class:'row'},pick,folderStatus));
  void verify();void Bridge.contextFoldersList().then(items=>{if(disposed)return;folders=normalize(items);drawFolders();}).catch(()=>{if(!disposed)failure();});
  void Bridge.desktopAppCatalog().then(items=>{if(!disposed)drawDesktopApps(items);}).catch(()=>{if(!disposed)desktopStatus.textContent=t('No se pudo consultar la lista local de apps.');});
  void Bridge.projectWorkRuntimes().then(items=>{if(disposed)return;clear(runtimes);for(const item of items)runtimes.append(h('p',{text:runtimeLabel(item)}));}).catch(()=>{if(!disposed)runtimes.textContent=t('No se pudieron verificar las capacidades de este PC.');});
  void onEvent('novo-account-changed',()=>void verify()).then(stop=>{if(disposed)stop();else unsubscribe=stop;});
  return {el:section,dispose:()=>{disposed=true;++generation;unsubscribe?.();}};
}
