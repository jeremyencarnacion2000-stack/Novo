export async function requestCompanionAuthorization<T>(
  details:{origin:string;deviceName:string},
  confirmConnection:(message:string)=>boolean,
  start:(options:{origin:string;deviceName:string;reconnect:boolean})=>Promise<T>,
):Promise<T|null>{
  if(!confirmConnection('¿Conectar este PC a Novo? Si ya estaba vinculado a la cuenta que elijas, se sustituirá el acceso anterior y se pausarán sus trabajos. El historial pendiente no se enviará a otra cuenta.'))return null;
  return start({...details,reconnect:true});
}
