import test from 'node:test';
import assert from 'node:assert/strict';
import { NovoChatController, accountLabel } from '../src/core/novo-chat.ts';

const id='01234567-1234-4234-9234-123456789012';
const authorization=user=>({version:1,state:'connected',user:{id:user,displayName:'Ángel'},device:{id,name:'Novo PC',platform:'windows',scopes:['device:connect','ai:chat'],connectedAt:'2026-10-09T00:00:00Z',lastVerifiedAt:'2026-10-09T00:00:00Z',revokedAt:null},capabilities:{deviceConnect:true,aiChat:true,twinRead:true,integrationsRead:false,activityWrite:false}});
const status=user=>({state:'connected',authorization:authorization(user),lastVerifiedAt:'2026-10-09T00:00:00Z',revocationPending:false});
function fixture() {
  const listeners=new Map();const sends=[];const cancellations=[];
  const api={
    novoAccountStatus:async()=>status('a'),
    novoChatModels:async()=>[{id:'auto',label:'Automático',allowsTwinMode:false}],
    novoConversations:async()=>[],
    novoConversationGet:async()=>({id,title:'Mi conversación',updatedAt:'2026-10-09T00:00:00Z',revision:2,messages:[{id:'canonical',role:'assistant',content:'Respuesta guardada',timestamp:'2026-10-09T00:00:00Z'}]}),
    novoChatStart:async request=>{sends.push(request);},
    novoChatCancel:async request=>{cancellations.push(request);},
  };
  const controller=new NovoChatController(api,async(name,callback)=>{listeners.set(name,callback);return()=>listeners.delete(name);},()=>{});
  return {controller,api,sends,cancellations,event:(name,payload)=>listeners.get(name)?.(payload),listeners};
}
test('stored token is not connected when server verification is offline',async()=>{
  const f=fixture();f.api.novoAccountStatus=async()=>({state:'offline',authorization:null,lastVerifiedAt:null,revocationPending:false});
  await f.controller.loadAccount();assert.equal(accountLabel(f.controller.state.account),'Sin conexión');
  assert.equal(f.controller.canSend,false);f.controller.dispose();
});
test('Novo send bypasses legacy provider and capture denial does not block chat',async()=>{
  const f=fixture();await f.controller.loadAccount();assert.equal(f.controller.canSend,true);
  let finish;f.api.novoChatStart=request=>{f.sends.push(request);return new Promise(resolve=>{finish=resolve;});};
  const sending=f.controller.send('Hola','auto',false);
  await new Promise(resolve=>setImmediate(resolve));const request=f.sends[0];
  assert.deepEqual(Object.keys(request).sort(),['conversationId','conversationRevision','message','model','requestId','twinMode']);
  assert.equal(request.message,'Hola');assert.equal(request.conversationId,null);
  f.event('novo-chat-event',{type:'metadata',requestId:request.requestId,conversationId:id,revision:1,userMessageId:id});
  f.event('novo-chat-event',{type:'delta',requestId:request.requestId,text:'Respuesta parcial'});
  assert.equal(f.controller.state.liveText,'Respuesta parcial');
  f.event('novo-chat-event',{type:'complete',requestId:request.requestId,assistantMessageId:id,revision:2,modelId:'auto'});
  assert.equal(f.controller.state.conversation,null,'terminal event alone is not saved history');
  finish();await sending;
  assert.equal(f.controller.state.conversation.messages[0].id,'canonical');
  assert.equal(f.sends.length,1);f.controller.dispose();
});
test('stale request event and stale history cannot change a new account',async()=>{
  const f=fixture();await f.controller.loadAccount();
  let finish;f.api.novoChatStart=request=>{f.sends.push(request);return new Promise(resolve=>{finish=resolve;});};
  const old=f.controller.send('Mi mensaje antiguo','auto',false);await new Promise(resolve=>setImmediate(resolve));
  const request=f.sends[0];f.api.novoAccountStatus=async()=>status('b');
  f.event('novo-account-changed',null);await new Promise(resolve=>setImmediate(resolve));
  f.event('novo-chat-event',{type:'delta',requestId:request.requestId,text:'privado de A'});
  finish();await old;
  assert.equal(f.controller.state.account.authorization.user.id,'b');
  assert.equal(f.controller.state.liveText,'');assert.equal(f.controller.state.conversation,null);
  assert.deepEqual(f.cancellations,[request.requestId]);f.controller.dispose();
});
test('uncertain generation is never replayed and raw errors are not displayed',async()=>{
  const f=fixture();await f.controller.loadAccount();
  f.api.novoChatStart=async request=>{f.sends.push(request);throw {code:'stream_interrupted',message:'SECRET provider token'};};
  await f.controller.send('Hola','auto',false);
  assert.equal(f.sends.length,1);assert.equal(f.controller.state.error.code,'stream_interrupted');
  assert.ok(!JSON.stringify(f.controller.state).includes('SECRET'));f.controller.dispose();
});
test('a revoked connection disables further sends until account verification',async()=>{
  const f=fixture();await f.controller.loadAccount();
  f.api.novoChatStart=async()=>{throw {code:'revoked',message:'private provider detail'};};
  await f.controller.send('Hola','auto',false);
  assert.equal(f.controller.canSend,false);
  assert.equal(f.controller.state.account.state,'revoked');
  assert.equal(f.controller.state.conversation,null);f.controller.dispose();
});
test('disposal removes listeners including late subscriptions and cancels current turn',async()=>{
  const f=fixture();await f.controller.loadAccount();
  let finish;f.api.novoChatStart=request=>{f.sends.push(request);return new Promise(resolve=>{finish=resolve;});};
  const sending=f.controller.send('Hola','auto',false);await new Promise(resolve=>setImmediate(resolve));
  f.controller.dispose();finish();await sending;
  assert.equal(f.listeners.size,0);assert.equal(f.cancellations.length,1);
});
