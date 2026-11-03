import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalSpeech, speechText } from '../src/core/local-speech.ts';
test('an unavailable native event channel stays silent and reports a safe error',async()=>{
  let called=false;
  const speech=new LocalSpeech({voiceSpeak:async()=>{called=true;},voiceStop:async()=>{}},async()=>{throw new Error('internal detail');},()=>{});
  await speech.play('Hola');assert.equal(called,false);assert.equal(speech.state.error,'speech_unavailable');speech.dispose();
});
test('the speech boundary does not cut a Unicode character',()=>{
  const result=speechText('a'.repeat(5999)+'🙂 más');
  assert.equal(Array.from(result).length,6000);assert.equal(result.endsWith('🙂'),true);
});

function fixture() {
  const calls=[]; let event; let release; const states=[];
  const api={voiceSpeak:(id,text)=>{calls.push(['speak',id,text]);return new Promise(resolve=>release=resolve);},voiceStop:async id=>{calls.push(['stop',id]);}};
  const speech=new LocalSpeech(api,async(_name,cb)=>{event=cb;return()=>{};},()=>states.push(speech.state.status));
  return {speech,calls,states,event:value=>event(value),release:()=>release?.()};
}

test('speech reads plain content and omits code blocks and link destinations',()=>{
  assert.equal(speechText('## Hola\n[proyecto](https://private.example) **listo**\n```sh\nsecret command\n```'), 'Hola proyecto listo');
});
test('cancelling a pending start clears UI immediately and purges the late start',async()=>{
  const f=fixture(); const playing=f.speech.play('Hola');
  await new Promise(resolve=>setTimeout(resolve,0)); const id=f.calls[0][1];
  f.speech.stop(); assert.equal(f.speech.state.status,'idle');
  f.release(); await playing;
  assert.deepEqual(f.calls.map(c=>c[0]),['speak','stop','stop']);
  f.event({requestId:id,state:'speaking'}); assert.equal(f.speech.state.status,'idle');
  f.speech.dispose();
});
test('a completion for an older request cannot stop its replacement',async()=>{
  const f=fixture(); const first=f.speech.play('Primera');
  await new Promise(resolve=>setTimeout(resolve,0)); const old=f.calls[0][1]; f.release(); await first;
  const second=f.speech.play('Segunda'); await new Promise(resolve=>setTimeout(resolve,0));
  const current=f.calls.findLast(c=>c[0]==='speak')[1]; f.release();await second;
  f.event({requestId:old,state:'finished'}); assert.equal(f.speech.state.requestId,current);
  f.event({requestId:current,state:'finished'}); assert.equal(f.speech.state.status,'idle');f.speech.dispose();
});
test('voice errors expose only known codes and empty code-only responses stay silent',async()=>{
  const f=fixture();await f.speech.play('```\nonly code\n```');assert.deepEqual(f.calls,[]);
  const play=f.speech.play('Hola');await new Promise(resolve=>setTimeout(resolve,0));f.release();await play;
  f.event({requestId:f.speech.state.requestId,state:'error',code:'provider credential detail'});
  assert.equal(f.speech.state.error,'speech_unavailable');f.speech.dispose();
});
