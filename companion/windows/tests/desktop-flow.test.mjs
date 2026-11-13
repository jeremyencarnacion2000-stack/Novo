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
test('opening Codex and asking for confirmed project tasks keeps the read intent after opening',async()=>{
  const codex={...app,id:'codex',name:'Codex'};
  const f=fixture({text:'ClickHome: authorized notes',folders:['ClickHome'],matchedFiles:1,projectHints:[{source:'folder',name:'ClickHome'}]});
  f.api.desktopAppCatalog=async()=>[codex];
  for(const text of [
    'Abre Codex y dime qué tarea pendiente de ClickHome puedes confirmar y de qué fuente viene',
    'Abre Codex y revisa las tareas pendientes de ClickHome',
    'Open Codex and check the pending tasks for ClickHome',
  ]){
    const command=desktop.parseDesktopCommand(text);
    assert.equal(command?.projectName,'ClickHome');
    const result=await desktop.executeDesktopCommand(f.api,command,()=>true);
    assert.match(result.continuation.message,/tareas pendientes de ClickHome/);
    assert.match(result.continuation.message,/fuente/);
  }
  assert.deepEqual(f.calls,['codex','codex','codex']);
  assert.equal(desktop.parseDesktopCommand('Abre Codex y revisa las tareas pendientes de ClickHome y borra todo'),null);
  assert.equal(desktop.parseDesktopCommand('Minimiza Codex y revisa las tareas pendientes de ClickHome'),null);
});
test('registered names outside the old six-app list can be requested',()=>{
  assert.deepEqual(desktop.parseDesktopCommand('abre Obsidian'),{appId:'Obsidian',action:'open'});
});
test('opening acknowledgement matches the Windows receipt',async()=>{
  const f=fixture();
  const opened=await desktop.executeDesktopCommand(f.api,{appId:'vscode',action:'open'},()=>true);
  assert.equal(opened.response,'Listo, abrí Visual Studio Code.');
  f.api.desktopAppOpen=async()=>({kind:'focused'});
  const focused=await desktop.executeDesktopCommand(f.api,{appId:'vscode',action:'open'},()=>true);
  assert.equal(focused.response,'Listo, puse Visual Studio Code al frente.');
  f.api.desktopAppOpen=async()=>({kind:'already_open'});
  const existing=await desktop.executeDesktopCommand(f.api,{appId:'vscode',action:'open'},()=>true);
  assert.equal(existing.response,'Listo, Visual Studio Code ya tiene una ventana abierta.');
});
test('focus denial preserves the observed window and continues with project context',async()=>{
  const context={text:'Authorized project evidence',folders:['ClickHome'],matchedFiles:1,projectHints:[{source:'folder',name:'ClickHome'}]};
  const f=fixture(context);
  f.api.desktopAppOpen=async()=>({kind:'already_open',focus:'not_confirmed'});
  const result=await desktop.executeDesktopCommand(f.api,{appId:'vscode',action:'open',projectName:'ClickHome'},()=>true);
  assert.match(result.response,/ventana abierta/);
  assert.match(result.response,/al frente/);
  assert.equal(result.continuation.context,context);
});
test('open errors identify the stage without exposing raw diagnostics',async()=>{
  const f=fixture();
  const command={appId:'vscode',action:'open'};
  f.api.desktopAppCatalog=async()=>{throw new Error('private detail');};
  assert.match((await desktop.executeDesktopCommand(f.api,command,()=>true)).response,/catálogo/);
  f.api.desktopAppCatalog=async()=>[app];
  for(const [code,message] of [['permission_required',/permisos/],['desktop_launch_failed',/iniciar/],['desktop_window_unconfirmed',/ventana visible/]]){
    f.api.desktopAppOpen=async()=>{throw {code,message:'private detail'};};
    const result=await desktop.executeDesktopCommand(f.api,command,()=>true);
    assert.match(result.response,message);
    assert.doesNotMatch(result.response,/private detail/);
  }
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
test('context lookup failure preserves an already verified opening',async()=>{
  const f=fixture();
  f.api.contextSearch=async()=>{throw new Error('Private diagnostic');};
  const result=await desktop.executeDesktopCommand(f.api,{appId:'vscode',action:'open',projectName:'ClickHome'},()=>true);
  assert.deepEqual(f.calls,['vscode']);
  assert.match(result.response,/Listo, abrí Visual Studio Code/);
  assert.match(result.response,/No pude consultar.*ClickHome/);
  assert.doesNotMatch(result.response,/Private diagnostic/);
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
