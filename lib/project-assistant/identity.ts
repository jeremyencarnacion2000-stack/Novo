export type AssistantIdentitySource={kind:string;sourceKey:string;repository?:string|null;vercelProjectId?:string|null}
export type AssistantIdentityRecord={id:string;title:string;manualIdentity?:boolean;sources:AssistantIdentitySource[]}
export type AssistantIdentityResolution={kind:'existing';id:string}|{kind:'new';candidates:string[]}|{kind:'conflict';ids:string[]}
const nameKey=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s*\(\d+\)$/,'').replace(/[^a-z0-9]/g,'')

/** Only durable identifiers resolve a memory; conflicting records need a user decision. */
export function resolveObservationIdentity(existing:AssistantIdentityRecord[],observation:AssistantIdentitySource&{title:string}):AssistantIdentityResolution {
  const repo=observation.repository?.toLowerCase()
  const matched=existing.filter(record=>record.sources.some(source=>
    (source.kind===observation.kind&&source.sourceKey.toLowerCase()===observation.sourceKey.toLowerCase())||
    Boolean(repo&&source.repository?.toLowerCase()===repo)||
    Boolean(observation.vercelProjectId&&source.vercelProjectId===observation.vercelProjectId)))
  if(matched.length>1||matched.some(record=>!record.manualIdentity&&repo&&record.sources.some(source=>source.repository&&source.repository.toLowerCase()!==repo)))return {kind:'conflict',ids:matched.map(record=>record.id)}
  if(matched.length===1)return {kind:'existing',id:matched[0].id}
  const key=nameKey(observation.title)
  return {kind:'new',candidates:key.length<3?[]:existing.filter(record=>nameKey(record.title)===key).map(record=>record.id)}
}
