import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from './fakedom.mjs';
import {calls,emit,internals} from './tauri.mjs';
installFakeDom();
const {buildPrompt}=await import('../src/views/chat.ts');
const {State,DEFAULT_SETTINGS}=await import('../src/core/state.ts');
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
test('manual transcript waits for Send then runs the desktop action and asks for missing project context',async()=>{
  const original=internals.invoke;calls.length=0;
  State.settings={...DEFAULT_SETTINGS,voiceInputMode:'local'};State.view='prompt';
  internals.invoke=async(cmd,args)=>{
    const result=await original(cmd,args);
    if(cmd==='novo_account_status')return {state:'connected',revocationPending:false,authorization:{user:{id:'owner'},capabilities:{aiChat:true,twinRead:true}}};
    if(cmd==='novo_chat_models')return [{id:'auto',label:'Auto',allowsTwinMode:true}];
    if(['novo_conversations','novo_assistant_actions'].includes(cmd))return [];
    if(cmd==='desktop_app_catalog')return [{id:'editor',name:'Antigravity',available:true,canOpen:true,canControl:true,canRead:false}];
    if(cmd==='desktop_app_open')return {kind:'opened'};
    if(cmd==='companion_context_search')return {text:'',matchedFiles:0,folders:[],projectHints:[]};
    return result;
  };
  const view=buildPrompt(()=>{});
  try{
    await flush();await flush();
    view.el.querySelector('.chat-input').value='';
    view.el.querySelector('.novo-voice-button').fire('click');await flush();
    const request=calls.find(([cmd])=>cmd==='voice_input_start');assert.ok(request);
    emit('novo-voice-input',{requestId:request[1].requestId,state:'finished',text:'Novo, abre Antigravity y continuemos con ClickHome'});
    assert.equal(calls.some(([cmd])=>cmd==='desktop_app_open'),false);
    view.el.querySelector('.send-btn').fire('click');await flush();await flush();
    assert.equal(calls.filter(([cmd])=>cmd==='desktop_app_open').length,1,JSON.stringify({commands:calls.map(c=>c[0]),input:view.el.querySelector('.chat-input').value,text:view.el.textContent}));
    assert.match(view.el.textContent,/ClickHome/);assert.match(view.el.textContent,/Necesito contexto/);
    assert.equal(calls.some(([cmd])=>cmd==='novo_chat_start'),false);
  }finally{view.dispose();internals.invoke=original;State.settings={...DEFAULT_SETTINGS};}
});
