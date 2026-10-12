import { Bridge, onEvent, type NovoContextFolder } from '../core/bridge';
import { accountLabel } from '../core/novo-chat';
import type { Settings } from '../core/state';
import { h, clear } from '../views/dom';
import { t } from '../i18n/i18n';

/** Account chat preferences belong in a full window, never over the messages. */
export function novoChatSection(settings:Settings, save:()=>Promise<void>):{el:HTMLElement;dispose:()=>void} {
  let disposed=false;let unsubscribe:(()=>void)|null=null;let generation=0;
  const status=h('p',{class:'hint',role:'status',text:t('Cargando modelos de tu cuenta…')});
  const permission=h('p',{class:'hint',hidden:true});
  const model=h('select',{'aria-label':t('Modelo de Novo')});
  const twin=h('input',{type:'checkbox',checked:settings.novoTwinMode,'aria-label':t('Personalizar con mi Twin')});
  const connections=h('input',{type:'checkbox',checked:settings.novoLocalConnections,'aria-label':t('Consultar conexiones locales')});
  const folderList=h('div',{class:'novo-settings-folders'});
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
  async function verify(){
    const attempt=++generation;
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
  model.addEventListener('change',()=>{settings.novoChatModel=model.value;void save().catch(failure);});
  twin.addEventListener('change',()=>{settings.novoTwinMode=twin.checked;void save().catch(failure);});
  connections.addEventListener('change',()=>{settings.novoLocalConnections=connections.checked;void save().catch(failure);});
  const pick=h('button',{type:'button',text:t('Elegir carpetas')});
  pick.addEventListener('click',()=>{pick.disabled=true;void Bridge.contextFoldersPick().then(items=>{folders=normalize(items);drawFolders();}).catch(failure).finally(()=>{pick.disabled=false;});});
  const section=h('section',{class:'novo-chat-preferences'},h('h2',{text:t('Tu asistente Novo')}),
    status,permission,h('button',{type:'button',class:'novo-account-shortcut',text:t('Gestionar cuenta y permisos'),onclick:()=>void Bridge.openSettingsWindow('account')}),
    h('div',{class:'row'},h('label',{text:t('Modelo de Novo')}),model),
    h('label',{class:'row'},twin,h('span',{text:t('Personalizar con mi Twin')})),
    h('label',{class:'row'},connections,h('span',{text:t('Consultar conexiones locales')})),
    h('p',{class:'hint',text:t('Al preguntar, Novo consulta GitHub y Vercel conectados a este PC y usa el estado de agentes como Codex. Los resúmenes se envían a tu cuenta Novo; las claves permanecen en este PC.')}),
    h('h2',{text:t('Carpetas para dar contexto')}),h('p',{class:'hint',text:t('Elige dónde trabajas. Novo busca archivos relacionados y reconoce repositorios y proyectos de Vercel en esas carpetas. Puedes quitar el acceso en cualquier momento.')}),
    folderList,h('div',{class:'row'},pick,folderStatus));
  void verify();void Bridge.contextFoldersList().then(items=>{if(disposed)return;folders=normalize(items);drawFolders();}).catch(()=>{if(!disposed)failure();});
  void onEvent('novo-account-changed',()=>void verify()).then(stop=>{if(disposed)stop();else unsubscribe=stop;});
  return {el:section,dispose:()=>{disposed=true;++generation;unsubscribe?.();}};
}
