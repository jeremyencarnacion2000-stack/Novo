export type AssistantCommand =
  | {type:'task.list'}
  | {type:'task.create';title:string}
  | {type:'twin.status'}

/** Small deterministic catalog: ambiguous or open-ended requests stay in chat. */
export function matchAssistantCommand(text:string):AssistantCommand|null {
  const input=text.trim().replace(/\s+/g,' ')
  const create=input.match(/^(?:crea(?:r)?|añade?|agrega?|create|add)\s+(?:una?\s+)?tarea\s*[:,-]?\s+(.{1,180})$/i)
  if(create){
    const title=create[1].trim().replace(/[.!?]+$/,'').trim()
    return title?{type:'task.create',title}:null
  }
  if(/^(?:lista|mu[eé]strame|ens[eé]ñame|show|list)\s+(?:mis\s+|my\s+)?(?:tareas|pendientes|tasks|to[- ]?dos)\s*\??$/i.test(input)
    || /^(?:qu[eé]|what|which)\s+(?:tareas|pendientes|tasks)\s+(?:tengo|hay|do i have|are pending)\s*\??$/i.test(input))return {type:'task.list'}
  if(/^(?:(?:c[oó]mo\s+est[aá](?:\s+mi)?|dime\s+mi|what(?:'s| is)\s+my)\s+(?:estado\s+cognitivo|estado|cognitive status|energy|energ[ií]a))\s*\??$/i.test(input))return {type:'twin.status'}
  return null
}
