import type {DesktopAppChoice,DesktopWindowChoice} from './bridge';
import type {NovoLocalContext} from './novo-chat';
export type DesktopAppId=string
export type DesktopWindowAction='focus'|'minimize'|'maximize'|'restore'
export type DesktopCommand={appId:DesktopAppId;action:'open'|DesktopWindowAction;projectName?:string;projectQuery?:'pendingTasks'}

const aliases:Record<string,DesktopAppId>={
  'chrome':'chrome','google chrome':'chrome','edge':'edge','microsoft edge':'edge',
  'firefox':'firefox','visual studio code':'vscode','vs code':'vscode','vscode':'vscode','code':'vscode',
  'bloc de notas':'notepad','notepad':'notepad','explorador de archivos':'explorer','explorer':'explorer',
}
const actions:[RegExp,DesktopCommand['action']][]=[
  [/^(?:abre|abrir|open|launch)\s+(?:la\s+)?(?:app\s+)?/, 'open'],
  [/^(?:enfoca|enfocar|muestra|cambia\s+a|focus|switch\s+to)\s+(?:(?:la|el)\s+)?(?:ventana\s+de\s+)?/, 'focus'],
  [/^(?:minimiza|minimizar|minimize)\s+(?:(?:la|el)\s+)?(?:ventana\s+de\s+)?/, 'minimize'],
  [/^(?:maximiza|maximizar|maximize)\s+(?:(?:la|el)\s+)?(?:ventana\s+de\s+)?/, 'maximize'],
  [/^(?:restaura|restaurar|restore)\s+(?:(?:la|el)\s+)?(?:ventana\s+de\s+)?/, 'restore'],
]

/** Accept only a complete, single-app utterance so dictation cannot run a partial guess. */
export function parseDesktopCommand(text:string):DesktopCommand|null {
  const input=text.trim().replace(/^novo[,:]?\s+/i,'').replace(/[.!?]+$/,'').trim().replace(/\s+/g,' ')
  for(const [prefix,action] of actions){
    const match=input.toLocaleLowerCase().match(prefix)
    if(!match)continue
    const target=input.slice(match[0].length);
    const taskQuery=target.match(/^(.+?)\s+(?:y\s+(?:revisa\s+las\s+tareas\s+pendientes\s+de|dime\s+qu[eé]\s+tarea\s+pendiente\s+de)|and\s+check\s+the\s+pending\s+tasks\s+for)\s+([\p{L}\p{N}][\p{L}\p{N}_. -]*?)(?:\s+puedes\s+confirmar\s+y\s+de\s+qu[eé]\s+fuente\s+viene)?$/iu);
    const parts=taskQuery?taskQuery.slice(1):target.split(/\s+(?:y\s+continuemos\s+con|and\s+(?:let's\s+)?continue\s+with)\s+/i);
    if(parts.length>2||(parts.length===2&&action!=='open'))return null;
    const name=parts[0].trim();const projectName=parts[1]?.trim();
    if(!name||name.length>120||/\s+y\s+|\s+and\s+|[\\/:;|&<>]|--/i.test(name)||projectName&&projectName.length>120)return null;
    if(taskQuery&&(!projectName||/\b(?:y|and)\b/i.test(projectName)))return null;
    const appId=aliases[normalize(name)]??name;
    return {appId,action,...(projectName?{projectName}:{}),...(taskQuery?{projectQuery:'pendingTasks' as const}:{})};
  }
  return null
}

const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export interface DesktopApi {
  desktopAppCatalog(refresh?:boolean,codexOnly?:boolean):Promise<DesktopAppChoice[]>;
  desktopAppOpen(appId:string,requestId?:string):Promise<{kind:string;focus?:'not_confirmed'}>;
  desktopAppWindows(appId:string):Promise<DesktopWindowChoice[]>;
  desktopWindowAction(id:string,action:DesktopWindowAction,requestId?:string):Promise<void>;
  contextSearch(query:string):Promise<NovoLocalContext>;
}
export interface DesktopResult {response:string;windows?:DesktopWindowChoice[];continuation?:{message:string;context:NovoLocalContext}}

function openingError(error:unknown):string{
  const code=error&&typeof error==='object'&&'code' in error?error.code:undefined;
  switch(code){
    case 'permission_required':return 'Faltan permisos para abrir esta app desde Novo.';
    case 'expired':
    case 'revoked':return 'Vuelve a autorizar este dispositivo en Novo para abrir la app.';
    case 'offline':return 'No pude verificar los permisos de apertura porque Novo está sin conexión.';
    case 'desktop_catalog_unavailable':return 'No pude leer el catálogo de aplicaciones de Windows.';
    case 'desktop_app_missing':return 'La app ya no aparece en el catálogo de Windows.';
    case 'desktop_launch_failed':return 'Windows no pudo iniciar la aplicación.';
    case 'desktop_window_unconfirmed':return 'Windows no confirmó una ventana visible. No se repitió la apertura.';
    case 'cancelled':return 'Acción cancelada.';
    default:return 'No recibí una confirmación de apertura de Windows. No se repitió la acción.';
  }
}

/** One deterministic desktop action on the Novo account chat Send path. */
export async function executeDesktopCommand(api:DesktopApi,command:DesktopCommand,current:()=>boolean,requestId?:string):Promise<DesktopResult>{
  let apps:DesktopAppChoice[];
  try{apps=await api.desktopAppCatalog(false,normalize(command.appId)==='codex');}
  catch{return {response:'No pude leer el catálogo de aplicaciones de Windows.'};}
  if(!current())return {response:'Acción cancelada.'};
  const matches=apps.filter(app=>app.id===command.appId||normalize(app.name)===normalize(command.appId)||aliases[normalize(app.name)]===command.appId);
  if(matches.length!==1)return {response:matches.length?'Hay varias apps con ese nombre. Indica cuál quieres abrir.':'No encontré esa app instalada. Revisa su nombre o instálala antes de continuar.'};
  const app=matches[0];
  if(!app.available)return {response:'Esa app no está instalada en este PC.'};
  if(command.action==='open'?!app.canOpen:!app.canControl)return {response:'Esta acción está excluida para esa app. Puedes cambiarla en Configuración → Asistente.'};
  if(command.action==='open'){
    let receipt:Awaited<ReturnType<DesktopApi['desktopAppOpen']>>;
    try{receipt=await api.desktopAppOpen(app.id,requestId);}
    catch(error){return {response:openingError(error)};}
    if(!['opened','focused','already_open'].includes(receipt?.kind))return {response:openingError(null)};
    if(!current())return {response:'Acción terminada; la conversación cambió.'};
    const response=receipt.kind==='already_open'
      ? `Listo, ${app.name} ya tiene una ventana abierta.${receipt.focus==='not_confirmed'?' Windows no confirmó que quedara al frente.':''}`
      : receipt.kind==='focused'?`Listo, puse ${app.name} al frente.`:`Listo, abrí ${app.name}.`;
    if(!command.projectName)return {response};
    let context:NovoLocalContext;
    try{
      context=await api.contextSearch(command.projectName);
    }catch{
      return {response:`${response} No pude consultar el contexto de ${command.projectName}.`};
    }
    if(!current())return {response};
    const name=normalize(command.projectName);
    const projects=(context.projectHints??[]).filter(h=>normalize(h.name.split(/[\\/]/).pop()??'')===name||normalize(h.repository?.split('/').pop()??'')===name);
    const local=projects.filter(project=>project.source==='folder');
    const identities=new Set((local.length?local:projects).map(project=>normalize(project.repository??project.name)));
    if(local.length>1||identities.size!==1||!context.text||context.matchedFiles===0)return {response:`${response} Necesito contexto de ${command.projectName}: elige su carpeta en Configuración → Asistente o dime qué tarea quieres retomar. No tengo información suficiente para continuar ese proyecto.`};
    const message=command.projectQuery==='pendingTasks'
      ? `¿Qué tareas pendientes de ${command.projectName} puedes confirmar y de qué fuente viene cada una? Usa sólo el contexto autorizado. Si ninguna está confirmada, indícalo.`
      : `Continuemos con ${command.projectName}. Usa sólo el contexto autorizado disponible; si falta la tarea o el siguiente paso, pregúntame.`;
    return {response,continuation:{message,context}};
  }
  const windows=await api.desktopAppWindows(app.id);
  if(!current())return {response:'Acción cancelada.'};
  if(!windows.length)return {response:'No encontré una ventana visible de esa app.'};
  if(windows.length>1)return {response:'Hay varias ventanas abiertas. Elige dónde aplicar la acción.',windows};
  await api.desktopWindowAction(windows[0].id,command.action,requestId);
  return {response:'Windows confirmó el cambio de ventana.'};
}
