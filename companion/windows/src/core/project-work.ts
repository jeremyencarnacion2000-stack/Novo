export interface ProjectWorkRuntime {capability:'project.diagnose'|'codex.prepare_fix'|'claude.prepare_fix';available:boolean;reason:string|null;version:string|null}
export function runtimeLabel(runtime:ProjectWorkRuntime):string {
  const name=runtime.capability==='project.diagnose'?'Estado local':runtime.capability==='codex.prepare_fix'?'Codex':'Claude';
  if(runtime.available)return `${name}: disponible`;
  return `${name}: ${runtime.reason==='unsupported_sandbox'?'aislamiento no disponible':'no disponible en este PC'}`;
}
