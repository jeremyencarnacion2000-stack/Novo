import {CompanionError} from './auth'
export function companionChatEnabled():boolean{return process.env.NOVO_COMPANION_CHAT_ENABLED==='true'}
export function requireCompanionChatEnabled():void {
  if(!companionChatEnabled())throw new CompanionError(503,'chat_disabled')
}
