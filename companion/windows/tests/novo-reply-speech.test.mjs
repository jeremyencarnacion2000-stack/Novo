import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from './fakedom.mjs';
import {internals,sent,emit,calls} from './tauri.mjs';
installFakeDom();
const {buildPrompt}=await import('../src/views/chat.ts');
const {State,DEFAULT_SETTINGS}=await import('../src/core/state.ts');
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
async function fixture(deferred=false,voiceSpokenReplies=true){
  calls.length=0;State.settings={...DEFAULT_SETTINGS,voiceSpokenReplies,novoLocalConnections:false};State.view='prompt';State.droppedFile=null;
  let account='a';let finish;const original=internals.invoke;
  internals.invoke=async(cmd,args)=>{
    const result=await original(cmd,args);
    if(cmd==='novo_account_status')return {state:'connected',authorization:{user:{id:account},capabilities:{aiChat:true}},revocationPending:false};
    if(cmd==='novo_chat_models')return [{id:'auto',label:'Auto',allowsTwinMode:false}];
    if(cmd==='novo_conversations')return [{id:'history-'+account,title:'History '+account,revision:1,updatedAt:''}];
    if(cmd==='novo_conversation_get')return {id:args.id,revision:2,messages:[{id:'reply',role:'assistant',content:account==='b'?'Private history B':'Fresh server answer'}]};
    if(cmd==='desktop_app_catalog')return [{id:'chrome',name:'Chrome',available:true,allowed:true,canOpen:true,canControl:true,canRead:false}];
    if(cmd==='desktop_app_open')return {kind:'opened'};
    if(cmd==='novo_chat_start'){
      if(deferred)return new Promise(resolve=>finish=resolve);
      const requestId=args.input.requestId;
      emit('novo-chat-event',{type:'metadata',requestId,conversationId:'history-a',revision:1,userMessageId:'user'});
      emit('novo-chat-event',{type:'complete',requestId,assistantMessageId:'reply',revision:2,modelId:'auto'});return;
    }
    return result;
  };
  const view=buildPrompt(()=>{});await flush();await flush();
  const list=view.el.querySelector('.novo-choice-list');list.querySelectorAll=()=>list.find('BUTTON');
  const send=async text=>{view.el.querySelector('.chat-input').value=text;view.el.querySelector('.send-btn').fire('click');await flush();await flush();};
  const sendDraft=async()=>{view.el.querySelector('.send-btn').fire('click');await flush();await flush();};
  const dictate=async text=>{view.el.querySelector('.chat-input').value='';view.el.querySelector('.novo-voice-button').fire('click');await flush();const requestId=sent('voice_input_start').at(-1).requestId;emit('novo-voice-input',{requestId,state:'listening'});emit('novo-voice-input',{requestId,state:'finished',text});await flush();};
  return {view,send,sendDraft,dictate,switchAccount:async()=>{account='b';emit('novo-account-changed',null);await flush();await flush();view.el.find('BUTTON').find(button=>button.textContent==='History b').fire('click');await flush();},finish:()=>finish(),dispose:()=>{view.dispose();internals.invoke=original;State.settings={...DEFAULT_SETTINGS};}};
}
test('a server reply replaces the last desktop result for spoken and manual playback',async()=>{
  const f=await fixture();
  try{await f.send('abre Chrome');assert.match(sent('voice_speak').at(-1).text,/Listo/);
    await f.send('Hola Novo');assert.equal(sent('voice_speak').at(-1).text,'Fresh server answer');
  }finally{f.dispose();}
});
test('a dictated desktop action speaks its verified ready result with replies otherwise off',async()=>{
  const f=await fixture(false,false);
  try{await f.dictate('abre Chrome');assert.equal(f.view.el.querySelector('.chat-input').value,'abre Chrome');await f.sendDraft();
    assert.equal(sent('desktop_app_open').length,1);assert.equal(sent('voice_speak').at(-1).text,'Listo, abrí Chrome.');
  }finally{f.dispose();}
});
test('a dictated assistant request speaks the returned answer with replies otherwise off',async()=>{
  const f=await fixture(false,false);
  try{await f.dictate('hola Novo');await f.sendDraft();assert.equal(sent('voice_speak').at(-1).text,'Fresh server answer');}
  finally{f.dispose();}
});
test('an old-account request completing cannot read the newly opened account history',async()=>{
  const f=await fixture(true);
  try{await f.send('Old question');await f.switchAccount();const count=sent('voice_speak').length;
    f.finish();await flush();await flush();assert.equal(sent('voice_speak').length,count);
  }finally{f.dispose();}
});
