// Local browser QA of the actual island view. No accounts, tokens or provider calls.
// Not a Vite build input; native greeting/FSM acceptance remains a separate check.
import '../src/style.css';
import '../src/novo-island.css';
import {internals,eventPluginInternals,emit} from '../tests/tauri.mjs';
Object.assign(window,{__TAURI_INTERNALS__:internals,__TAURI_EVENT_PLUGIN_INTERNALS__:eventPluginInternals});
const {buildPrompt}=await import('../src/views/chat');
const {State}=await import('../src/core/state');
const {chatPromptHeight}=await import('../src/core/layout');
State.view='prompt';
let mode='connected';
let activeRequest:string|null=null;
const originalInvoke=internals.invoke;
const deviceId='11111111-1111-4111-8111-111111111111';
const user={id:'fixture-user',displayName:'Cuenta de prueba'};
internals.invoke=async(cmd:string,args:Record<string,any>)=>{
  if(cmd==='plugin:event|listen')return originalInvoke(cmd,args);
  if(cmd==='novo_account_status')return {state:mode,authorization:mode==='connected'?{user,device:{id:deviceId,name:'PC de prueba'},capabilities:{aiChat:true,twinRead:true,activityWrite:false,integrationsRead:true}}:null,revocationPending:false};
  if(cmd==='novo_chat_models')return [{id:'auto',label:'Automático',allowsTwinMode:true}];
  if(cmd==='novo_conversations')return [];
  if(cmd==='novo_chat_start'){
    activeRequest=args.input.requestId;
    emit('novo-chat-event',{type:'delta',requestId:activeRequest,text:'Respuesta de prueba. No se llamó a una IA.'});
    throw {code:'stream_interrupted'};
  }
  if(cmd==='novo_chat_cancel'){activeRequest=null;return;}
  return null;
};
const root=document.getElementById('root')!;
root.style.cssText='position:relative;width:min(620px,100%);margin:24px auto;padding:16px;box-sizing:border-box;';
const note=document.createElement('p');note.textContent='Fixture local de la vista real · captura apagada · sin conexión a cuentas';note.style.cssText='font:12px system-ui;color:#ddd';root.append(note);
const controls=document.createElement('div');controls.style.cssText='display:flex;gap:8px;margin-bottom:16px';root.append(controls);
for(const state of ['connected','offline','revoked']){
  const button=document.createElement('button');button.textContent=state;button.onclick=()=>{mode=state;emit('novo-account-changed',null);};controls.append(button);
}
const frame=document.createElement('div');frame.style.cssText=`position:relative;height:${chatPromptHeight(0)-42}px`;root.append(frame);
const view=buildPrompt(()=>{frame.style.height=`${chatPromptHeight(State.chatHistory.length)-42}px`;});view.el.classList.add('on');frame.append(view.el);
window.addEventListener('beforeunload',()=>view.dispose?.());
