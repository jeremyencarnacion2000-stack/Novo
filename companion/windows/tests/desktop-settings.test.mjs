import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from './fakedom.mjs';
import {internals,calls} from './tauri.mjs';
installFakeDom();
const {novoChatSection}=await import('../src/settings/novo-chat.ts');
const {DEFAULT_SETTINGS}=await import('../src/core/state.ts');
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
test('rapid permission edits cannot restore a previously disabled permission',async()=>{
  const original=internals.invoke;let finish;const writes=[];
  const app={id:'app',name:'Editor',available:true,canOpen:true,canControl:true,canRead:false,allowed:true};
  internals.invoke=async(cmd,args)=>{
    await original(cmd,args);
    if(cmd==='desktop_app_catalog')return [app];
    if(cmd==='desktop_app_permissions_set'){writes.push(args.permissions);return new Promise(resolve=>{finish=resolve;});}
    if(['companion_context_folders_list','project_work_runtimes','voice_choices'].includes(cmd))return [];
    return null;
  };
  const view=novoChatSection({...DEFAULT_SETTINGS},async()=>{});
  view.el.find('INPUT').find(el=>el.getAttribute('aria-label')==='Search installed apps').value='';
  const field=label=>view.el.find('INPUT').find(el=>el.getAttribute('aria-label')===`${label}: Editor`);
  try{
    await flush();const open=field('Open');const control=field('Control windows');
    open.checked=false;open.fire('change');control.checked=false;control.fire('change');
    await flush();assert.equal(writes.length,1);assert.equal(control.disabled,true);
    finish({app:{...app,canOpen:false},policy:{denyAll:false,entries:{app:{open:false,control:true,read:false}}}});await flush();
    const next=field('Control windows');next.checked=false;next.fire('change');await flush();
    assert.deepEqual(writes[1],{open:false,control:false,read:false});
  }finally{view.dispose();internals.invoke=original;}
});
