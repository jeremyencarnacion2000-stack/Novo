export function authorizationPollFailure(error:unknown):string|null {
  const code=typeof error==='string'?error:error&&typeof error==='object'&&'code' in error?error.code:null;
  switch(code){
    case 'expired':case 'unauthorized':case 'revoked':case 'permission_required':
      return 'Novo rechazó la verificación de esa autorización. No se guardó como una conexión válida.';
    case 'authorization_not_pending':
      return 'El intento ya terminó. Puedes iniciar una conexión nueva; no hay una autorización pendiente que verificar.';
    case 'credential_store_unavailable':
      return 'La autorización no pudo completar su guardado protegido en Windows. Verifica la cuenta para recuperar el estado.';
    case 'settings_unavailable':case 'settings_save_failed':
      return 'No se pudieron guardar los ajustes de la conexión. Verifica la cuenta antes de volver a conectar.';
  }
  return null;
}
