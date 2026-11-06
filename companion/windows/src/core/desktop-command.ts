import type {DesktopAppChoice,DesktopWindowChoice} from './bridge';
import type {NovoLocalContext} from './novo-chat';
export type DesktopAppId=string
export type DesktopWindowAction='focus'|'minimize'|'maximize'|'restore'
export type DesktopCommand={appId:DesktopAppId;action:'open'|DesktopWindowAction;projectName?:string}

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
    const parts=input.slice(match[0].length).split(/\s+(?:y\s+continuemos\s+con|and\s+(?:let's\s+)?continue\s+with)\s+/i);
    if(parts.length>2||(parts.length===2&&action!=='open'))return null;
    const name=parts[0].trim();const projectName=parts[1]?.trim();
    if(!name||name.length>120||/\s+y\s+|\s+and\s+|[\\/:;|&<>]|--/i.test(name)||projectName&&(!projectName||projectName.length>120))return null;
    const appId=aliases[normalize(name)]??name;
    return {appId,action,...(projectName?{projectName}:{})};
  }
  return null
}

const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export interface DesktopApi {
  desktopAppCatalog():Promise<DesktopAppChoice[]>;
  desktopAppOpen(appId:string,requestId?:string):Promise<{kind:string}>;
  desktopAppWindows(appId:string):Promise<DesktopWindowChoice[]>;
  desktopWindowAction(id:string,action:DesktopWindowAction,requestId?:string):Promise<void>;
  contextSearch(query:string):Promise<NovoLocalContext>;
}
export interface DesktopResult {response:string;windows?:DesktopWindowChoice[];continuation?:{message:string;context:NovoLocalContext}}

/** One deterministic desktop action on the Novo account chat Send path. */
export async function executeDesktopCommand(api:DesktopApi,command:DesktopCommand,current:()=>boolean,requestId?:string):Promise<DesktopResult>{
  const apps=await api.desktopAppCatalog();
  if(!current())return {response:'Acción cancelada.'};
  const matches=apps.filter(app=>app.id===command.appId||normalize(app.name)===normalize(command.appId)||aliases[normalize(app.name)]===command.appId);
  if(matches.length!==1)return {response:matches.length?'Hay varias apps con ese nombre. Indica cuál quieres abrir.':'No encontré esa app instalada. Revisa su nombre o instálala antes de continuar.'};
  const app=matches[0];
  if(!app.available)return {response:'Esa app no está instalada en este PC.'};
  if(command.action==='open'?!app.canOpen:!app.canControl)return {response:'Esta acción está excluida para esa app. Puedes cambiarla en Configuración → Asistente.'};
  if(command.action==='open'){
    const receipt=await api.desktopAppOpen(app.id,requestId);
    if(!['opened','focused','already_open'].includes(receipt?.kind))throw new Error('Windows did not confirm the action');
    if(!current())return {response:'Acción terminada; la conversación cambió.'};
    const response=receipt.kind==='already_open'?`Listo, ${app.name} ya tiene una ventana abierta.`:receipt.kind==='focused'?`Listo, puse ${app.name} al frente.`:`Listo, abrí ${app.name}.`;
    if(!command.projectName)return {response};
    const context=await api.contextSearch(command.projectName);
    if(!current())return {response};
    const name=normalize(command.projectName);
    const projects=(context.projectHints??[]).filter(h=>normalize(h.name.split(/[\\/]/).pop()??'')===name||normalize(h.repository?.split('/').pop()??'')===name);
    const local=projects.filter(project=>project.source==='folder');
    const identities=new Set((local.length?local:projects).map(project=>normalize(project.repository??project.name)));
    if(local.length>1||identities.size!==1||!context.text||context.matchedFiles===0)return {response:`${response} Necesito contexto de ${command.projectName}: elige su carpeta en Configuración → Asistente o dime qué tarea quieres retomar. No tengo información suficiente para continuar ese proyecto.`};
    return {response,continuation:{message:`Continuemos con ${command.projectName}. Usa sólo el contexto autorizado disponible; si falta la tarea o el siguiente paso, pregúntame.`,context}};
  }
  const windows=await api.desktopAppWindows(app.id);
  if(!current())return {response:'Acción cancelada.'};
  if(!windows.length)return {response:'No encontré una ventana visible de esa app.'};
  if(windows.length>1)return {response:'Hay varias ventanas abiertas. Elige dónde aplicar la acción.',windows};
  await api.desktopWindowAction(windows[0].id,command.action,requestId);
  return {response:'Windows confirmó el cambio de ventana.'};
}
