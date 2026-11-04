import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as desktop from '../src/core/desktop-command.ts';

const app={id:'vscode',name:'Visual Studio Code',available:true,allowed:true,canOpen:true,canControl:true,canRead:false};
function fixture(context={text:'',folders:[],matchedFiles:0,projectHints:[]}) {
  const calls=[];
  const api={desktopAppCatalog:async()=>[app],desktopAppOpen:async id=>{calls.push(id);return {kind:'opened'};},desktopAppWindows:async()=>[],desktopWindowAction:async()=>{},contextSearch:async()=>context};
  return {api,calls};
}
test('Novo prefix and project continuation resolve as a single desktop intent',()=>{
  assert.deepEqual(desktop.parseDesktopCommand('Novo, abre Visual Studio Code y continuemos con ClickHome.'),{appId:'vscode',action:'open',projectName:'ClickHome'});
});
test('registered names outside the old six-app list can be requested',()=>{
  assert.deepEqual(desktop.parseDesktopCommand('abre Obsidian'),{appId:'Obsidian',action:'open'});
});
test('verified opening without project evidence asks for context rather than inventing a continuation',async()=>{
  const f=fixture();const result=await desktop.executeDesktopCommand(f.api,{appId:'vscode',action:'open',projectName:'ClickHome'},()=>true);
  assert.deepEqual(f.calls,['vscode']);assert.match(result.response,/ClickHome/);assert.match(result.response,/carpeta|contexto/i);assert.equal(result.continuation,undefined);
});
test('project evidence is forwarded once to the existing chat workflow',async()=>{
  const context={text:'ClickHome: README and open tasks',folders:['ClickHome'],matchedFiles:1,projectHints:[{source:'folder',name:'ClickHome'}]};
  const f=fixture(context);let reads=0;f.api.contextSearch=async()=>{reads++;return context;};
  const result=await desktop.executeDesktopCommand(f.api,{appId:'vscode',action:'open',projectName:'ClickHome'},()=>true);
  assert.deepEqual(f.calls,['vscode']);assert.equal(reads,1);assert.match(result.continuation.message,/ClickHome/);assert.equal(result.continuation.context,context);
});
test('exclusion and ambiguous app names cause no desktop side effects',async()=>{
  for(const apps of [[{...app,canOpen:false}],[app,{...app,id:'other'}]]){
    const f=fixture();f.api.desktopAppCatalog=async()=>apps;
    const result=await desktop.executeDesktopCommand(f.api,{appId:'Visual Studio Code',action:'open'},()=>true);
    assert.equal(f.calls.length,0);assert.equal(result.continuation,undefined);
  }
});
test('cancellation while loading the catalog never opens the app',async()=>{
  const f=fixture();let current=true;f.api.desktopAppCatalog=async()=>{current=false;return [app];};
  await desktop.executeDesktopCommand(f.api,{appId:'vscode',action:'open'},()=>current);assert.equal(f.calls.length,0);
});
test('two same-named local project roots require clarification even without repositories',async()=>{
  const f=fixture({text:'mixed context',folders:['ClickHome','ClickHome'],matchedFiles:2,projectHints:[{source:'folder',name:'ClickHome'},{source:'folder',name:'ClickHome'}]});
  const result=await desktop.executeDesktopCommand(f.api,{appId:'vscode',action:'open',projectName:'ClickHome'},()=>true);
  assert.equal(result.continuation,undefined);
});
