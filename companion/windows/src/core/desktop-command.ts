export type DesktopAppId='chrome'|'edge'|'firefox'|'vscode'|'notepad'|'explorer'
export type DesktopWindowAction='focus'|'minimize'|'maximize'|'restore'
export type DesktopCommand={appId:DesktopAppId;action:'open'|DesktopWindowAction}

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
  const input=text.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[.!?]+$/,'').trim().replace(/\s+/g,' ')
  for(const [prefix,action] of actions){
    const match=input.match(prefix)
    if(!match)continue
    const appId=aliases[input.slice(match[0].length).trim()]
    return appId?{appId,action}:null
  }
  return null
}
