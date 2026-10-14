import {Bridge,type LocalProjectArtifact} from '../core/bridge';
import {h,clear} from '../views/dom';

function localTime(value:string|null){
  if(!value)return '';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(date);
}

export function projectWorkArtifactsSection(){
  const root=h('section',{class:'project-work-artifacts'},
    h('h2',{text:'Propuestas locales'}),
    h('p',{class:'hint',text:'Las propuestas se quedan en este PC. Busca la referencia que Novo muestra en el chat y abre su carpeta para revisarla.'}),
  );
  const search=h('input',{type:'search',class:'project-work-artifacts-search',placeholder:'Pega una referencia de artefacto','aria-label':'Buscar propuestas por referencia'});
  const status=h('p',{class:'hint',text:'Cargando propuestas locales…'});
  const list=h('div',{class:'project-work-artifacts-list'});
  root.append(search,status,list);
  let items:LocalProjectArtifact[]=[];
  function render(){
    clear(list);
    const query=search.value.trim().toLowerCase();
    const visible=items.filter(item=>!query||item.id.toLowerCase().includes(query));
    if(!visible.length){status.textContent=items.length?'No hay una propuesta con esa referencia.':'No hay propuestas locales para esta cuenta.';return;}
    status.textContent=`${visible.length} propuesta${visible.length===1?'':'s'} disponible${visible.length===1?'':'s'} en este PC.`;
    for(const item of visible){
      const card=h('article',{class:'project-work-artifact-card'});
      const title=h('h3',{text:item.summary||`Propuesta ${item.id.slice(0,8)}`});
      const reference=h('code',{text:item.id});
      const paths=h('p',{class:'hint',text:item.changedPaths.length?`${item.changedPaths.length} archivo${item.changedPaths.length===1?'':'s'} cambiado${item.changedPaths.length===1?'':'s'}: ${item.changedPaths.slice(0,4).join(', ')}${item.changedPaths.length>4?'…':''}`:'Sin archivos modificados'});
      card.append(title,reference,paths);
      if(item.baseCommit)card.append(h('p',{class:'hint',text:`Punto de partida: ${item.baseCommit.slice(0,12)}`}));
      if(item.verificationStatus)card.append(h('p',{class:'hint',text:`Comprobaciones: ${item.verificationStatus==='passed'?'correctas':item.verificationStatus==='failed'?'con errores':'no ejecutadas'}`}));
      if(item.modifiedAt)card.append(h('p',{class:'hint',text:`Guardada ${localTime(item.modifiedAt)}`}));
      if(item.workspaceReady||item.patchReady){
        const open=h('button',{type:'button',text:'Abrir carpeta de propuesta'});
        open.addEventListener('click',async()=>{
          open.disabled=true;
          try{await Bridge.projectWorkOpenArtifact(item.id);open.textContent='Carpeta abierta';}
          catch{open.disabled=false;open.textContent='No se pudo abrir; reintentar';}
        });
        card.append(open);
      }else card.append(h('p',{class:'hint',text:'Este resultado no incluye una propuesta de código para abrir.'}));
      list.append(card);
    }
  }
  search.addEventListener('input',render);
  void Bridge.projectWorkArtifacts().then(value=>{items=value;render();}).catch(()=>{status.textContent='Conecta Novo Companion y vuelve a cargar para consultar las propuestas locales de tu cuenta.';});
  const refresh=h('button',{type:'button',text:'Actualizar propuestas'});
  refresh.addEventListener('click',async()=>{
    refresh.disabled=true;status.textContent='Actualizando…';
    try{items=await Bridge.projectWorkArtifacts();render();}
    catch{status.textContent='Conecta Novo Companion y vuelve a cargar para consultar las propuestas locales de tu cuenta.';}
    finally{refresh.disabled=false;}
  });
  root.append(refresh);
  return root;
}
