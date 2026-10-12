import test from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from './fakedom.mjs';
import {internals,sent,emit,calls} from './tauri.mjs';
installFakeDom();
const {buildPrompt}=await import('../src/views/chat.ts');
const {State}=await import('../src/core/state.ts');
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
test('island sends text through Novo only and labels dropped files as unshared',async()=>{
  calls.length=0;State.view='prompt';State.droppedFile={name:'private.txt',path:'C:\\private\\file.txt'};
  let finish;
  const original=internals.invoke;
  internals.invoke=async(cmd,args)=>{
    if(cmd==='novo_account_status')return {state:'connected',authorization:{user:{id:'a',displayName:'Ángel'},capabilities:{aiChat:true,activityWrite:false,twinRead:true}},revocationPending:false};
    if(cmd==='novo_chat_models')return [{id:'auto',label:'Automático',allowsTwinMode:false}];
    if(cmd==='novo_conversations')return [];
    const result=await original(cmd,args);
    if(cmd==='novo_chat_start')return new Promise(resolve=>{finish=resolve;});
    return result;
  };
  const view=buildPrompt(()=>{});
  try {
    await flush();await flush();view.sync();
    assert.match(view.el.textContent,/no compartido/i);
    assert.equal(view.el.querySelector('.novo-models'),null);
    assert.equal(view.el.querySelector('.novo-context-panel'),null);
    assert.equal(view.el.querySelector('.novo-twin'),null);
    assert.ok(view.el.querySelector('.novo-chat-settings'));
    view.el.querySelector('.novo-choice-trigger').fire('click');
    assert.ok(view.el.querySelector('.novo-chat-body').classList.contains('history-open'));
    view.el.querySelector('.novo-choice-trigger').fire('click');
    const input=view.el.querySelector('.chat-input');input.value='Hola Novo';
    view.el.querySelector('.send-btn').fire('click');await flush();
    assert.equal(sent('novo_chat_start').length,1);
    assert.equal(sent('chat_send').length,0);assert.equal(sent('chat_models').length,0);
    const request=sent('novo_chat_start')[0].input;
    assert.equal(request.message,'Hola Novo');assert.ok(!JSON.stringify(request).includes('private'));
    emit('novo-chat-event',{type:'delta',requestId:request.requestId,text:'Hola, Ángel'});
    view.sync();assert.match(view.el.textContent,/Hola, Ángel/);
    finish();await flush();assert.match(view.el.textContent,/interrumpida/i);
  } finally {view.dispose?.();internals.invoke=original;State.droppedFile=null;}
});
