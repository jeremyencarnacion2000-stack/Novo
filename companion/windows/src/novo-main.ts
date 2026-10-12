import { invoke } from "@tauri-apps/api/core";
import { developerContextErrorMessage, formatDeveloperContext } from "./developer-context";
import { DEVELOPER_CONTEXT_REFRESH_INTERVAL_MS, shouldRefreshDeveloperContext, shouldStartActivitySync } from "./sync-policy";
import { Bridge, onEvent, type NovoWorkContext } from './core/bridge';
import { accountLabel, type NativeAccountStatus } from './core/novo-chat';
import { normalizeNovoWorkContextInput } from './core/novo-work-context';

type Signal = { sourceRef: string; signalType: string; label: string; observedAt: string; reliability: string };
type LocalSummary = { deviceId: string; enabled: boolean; paused: boolean; apiOrigin: string; tokenPresent: boolean; accountConnected: boolean; excludedApplications: string[]; activeMinutesToday: number; appMinutesToday: Record<string, number>; queuedEvents: number };
type Snapshot = { applicationId: string; state: "active" | "idle" | "locked"; idleSeconds: number };
type DeviceAuthorizationPrompt = { verificationUri: string; userCode: string; intervalSeconds: number; expiresAt: string; openedInBrowser: boolean };

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
let root: HTMLElement | null = null;
let mounted = false;
let actionInFlight = false;
let local: LocalSummary = {
  deviceId: "demo-device",
  enabled: false,
  paused: false,
  apiOrigin: "",
  tokenPresent: false,
  accountConnected: false,
  excludedApplications: ["novo-companion"],
  activeMinutesToday: 0,
  appMinutesToday: {},
  queuedEvents: 0,
};
let signals: Signal[] = [];
let currentWorkContext: NovoWorkContext | null = null;
let currentWorkStatus = '';
let projectDraft = '';
let focusDraft = '';
let workContextBusy = false;
let developerContextLines: string[] = [];
let developerContextError = "";
let developerContextLastAttempt: { generation: number; atMs: number } | null = null;
let developerContextRequestGeneration: number | null = null;
let message = "";
let permissionConfirmed = false;
let sample: Snapshot | null = null;
let syncInFlight = false;
let historyClearRequested = false;
let authorizationPrompt: DeviceAuthorizationPrompt | null = null;
let authorizationTimer: number | null = null;
let manualTokenDraft = "";
let account:NativeAccountStatus={state:'demo',authorization:null,lastVerifiedAt:null,revocationPending:false};
let accountGeneration=0;
let deviceName='Novo PC';
let originDraft:string|null=null;
let deviceNameDraft:string|null=null;
let exclusionsDraft:string|null=null;

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function render() {
  if (!root) return;
  // Background summaries must not replace a form while the person is typing.
  const active=document.activeElement;
  const editingText=active instanceof HTMLTextAreaElement||(active instanceof HTMLInputElement&&['text','password','url','email','search','number'].includes(active.type));
  if(editingText && active && root.contains(active)){
    const feedback=root.querySelector<HTMLElement>('.novo-account-feedback');
    if(feedback){feedback.textContent=message;feedback.hidden=!message;}
    return;
  }
  const topApps = Object.entries(local.appMinutesToday).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const mode = !isTauri ? "Vista previa local · sin captura" : account.revocationPending ? 'Detenido localmente · revocación pendiente' : accountLabel(account);
  const openedDetails=[...root.querySelectorAll<HTMLDetailsElement>("details")].filter(element=>element.open).map(element=>element.className);
  root.innerHTML = `
    <div class="novo-account-content">
      <p class="novo-account-feedback" role="status" aria-live="polite" ${message ? '' : 'hidden'}>${escapeHtml(message)}</p>
      <section class="presence-card" aria-label="Estado de tu cuenta">
        <div class="presence-copy"><p class="presence-title">Tu cuenta de Novo</p><p class="muted">${escapeHtml(mode)}</p></div>
        <span class="status-led ${account.state==='connected' ? "on" : ""}" aria-label="${escapeHtml(mode)}"></span>
      </section>

      <section class="section-card connect-card">
        <div class="section-heading"><div><h2>Conexión de tu cuenta</h2></div></div>
        <p class="body-copy">Conecta tu cuenta para usar tu asistente y su contexto en este PC. Elige por separado qué actividad quieres compartir.</p>
        <p class="body-copy" role="status">${escapeHtml(accountLabel(account))}${account.authorization?.user.displayName ? ` · ${escapeHtml(account.authorization.user.displayName)}` : ''}${account.authorization?.device ? ` · ${escapeHtml(account.authorization.device.name)}` : ''}</p>
        <details class="account-address-settings"><summary>Servidor y nombre del dispositivo</summary>
        <label class="field-label" for="novo-origin">Dirección de Novo</label><input class="text-input" id="novo-origin" type="url" value="${escapeHtml(originDraft??(local.apiOrigin || 'https://productivitynovo.vercel.app'))}" placeholder="https://productivitynovo.vercel.app">
        <label class="field-label" for="novo-device-name">Nombre de este dispositivo</label><input class="text-input" id="novo-device-name" maxlength="80" value="${escapeHtml(deviceNameDraft??deviceName)}" autocomplete="off">
        </details>
        ${authorizationPrompt ? `<div class="authorization-prompt"><span class="eyebrow">CONFIRMA EN EL NAVEGADOR</span><a class="verification-link" href="${escapeHtml(authorizationPrompt.verificationUri)}" target="_blank" rel="noreferrer">Abrir autorización en el navegador</a><div class="device-code-row"><code>${escapeHtml(authorizationPrompt.userCode)}</code><button class="quiet-button" data-action="copy-code">Copiar código</button></div><small>${authorizationPrompt.openedInBrowser ? "Se abrió tu navegador predeterminado." : "Abre el enlace y escribe este código."} El código vence en unos minutos.</small><button class="text-button" data-action="cancel-authorization">Cancelar</button></div>` : ""}
        <div class="capture-controls"><button class="primary-button" data-action="account-connect" ${authorizationPrompt || account.state==='authorization_pending' || account.revocationPending ? "disabled" : ""}>${local.tokenPresent ? 'Actualizar conexión y permisos' : 'Iniciar sesión con Novo'}</button>${local.tokenPresent || account.revocationPending ? `<button class="quiet-button" data-action="disconnect">${account.revocationPending ? 'Reintentar revocación' : 'Desconectar y revocar'}</button>` : ""}<button class="quiet-button" data-action="verify-account">Verificar cuenta</button></div>
        ${account.state==='authorization_pending' && !authorizationPrompt ? '<div class="authorization-prompt"><p>Hay una autorización protegida pendiente de verificar. No se iniciará otra.</p><button class="quiet-button" data-action="resume-authorization">Continuar verificación</button><button class="text-button" data-action="cancel-authorization">Cancelar autorización</button></div>' : ''}
        ${account.revocationPending ? '<p class="body-copy" role="status">La captura y nuevas solicitudes están detenidas. La revocación remota necesita conexión.</p>' : ''}
        <details class="manual-token"><summary>Conectar con un token de API de Novo</summary><p>En Ajustes → Acceso de agentes, crea un token nuevo y activa “Conectar Novo Companion en Windows”. Pégalo aquí para vincular este dispositivo y usar las IA de tu cuenta. El token se guarda en Windows Credential Manager; no se habilita la escritura de tareas.</p><label class="field-label" for="device-token">Token personal de Novo</label><input class="text-input" id="device-token" type="password" autocomplete="new-password" value="${escapeHtml(manualTokenDraft)}" placeholder="novo_mcp_…"><button class="quiet-button manual-save" data-action="connect">Validar y conectar token</button></details>
        <button class="text-button" data-action="sync" ${!local.tokenPresent || local.queuedEvents === 0 ? "disabled" : ""}>Sincronizar resúmenes locales</button>
      </section>

      <section class="section-card capture-card">
        <div class="section-heading"><div><h2>Actividad, bajo tu control</h2></div><span class="privacy-tag">Solo apps y tiempo</span></div>
        <p class="body-copy">Novo puede observar qué aplicación está al frente y durante cuánto tiempo. No lee títulos, mensajes, archivos, rutas, URLs ni teclas.</p>
        <label class="consent-row"><input id="consent" type="checkbox" ${permissionConfirmed ? "checked" : ""}><span><strong>Entiendo qué se observará</strong><small>La captura permanece apagada hasta que la active.</small></span></label>
        <div class="capture-controls">
          <button class="primary-button" data-action="capture" ${(!permissionConfirmed && !local.enabled) || !isTauri ? "disabled" : ""}>${local.enabled ? "Detener observación" : "Activar observación"}</button>
          <button class="quiet-button" data-action="pause" ${!local.enabled ? "disabled" : ""}>${local.paused ? "Reanudar" : "Pausar"}</button>
        </div>
        <div class="live-row"><span class="live-dot ${sample?.state === "active" && !local.paused ? "on" : ""}"></span><span>${sample && local.enabled && !local.paused ? `Aplicación observada: <b>${escapeHtml(sample.applicationId)}</b>` : "Sin aplicación observada ahora"}</span>${sample && sample.state !== "active" ? `<small>${sample.state === "locked" ? "Bloqueado" : `Inactivo · ${Math.floor(sample.idleSeconds / 60)} min`}</small>` : ""}</div>
        <div class="mini-stats"><div><strong>${local.activeMinutesToday}<small> min</small></strong><span>tiempo activo hoy</span></div><div><strong>${local.queuedEvents}</strong><span>segmentos locales por sincronizar</span></div></div>
        <div class="app-list">${topApps.length ? topApps.map(([name, minutes]) => `<div class="app-item"><span>${escapeHtml(name)}</span><span>${minutes} min</span></div>`).join("") : `<div class="empty-row">Los resúmenes aparecerán aquí cuando habilites la captura.</div>`}</div>
        <div class="exclusions"><label for="excluded-apps">Excluir apps (separadas por coma)</label><div class="input-row"><input id="excluded-apps" type="text" class="text-input" value="${escapeHtml(exclusionsDraft??local.excludedApplications.join(", "))}" placeholder="por ejemplo, app.exe"><button class="quiet-button" data-action="save-exclusions">Guardar</button></div></div>
        <button class="text-button danger" data-action="clear-history">Eliminar historial local de 7 días</button>
      </section>

      <section class="section-card context-card"><div class="section-heading"><div><h2>Lo que Novo sabe</h2></div><button class="refresh-button" aria-label="Actualizar contexto" data-action="refresh" ${!local.tokenPresent ? "disabled" : ""}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 7v5h-5M19 12a7 7 0 1 1-2-5l3 3"/></svg></button></div>
        <p class="body-copy">Las señales de uso son observaciones, no interpretaciones; por sí solas no alteran tu plan.</p>
        <div class="signal-list">${signals.length ? signals.slice(0, 4).map((signal) => `<div class="signal-item"><span class="signal-dot"></span><div><p>${escapeHtml(signal.label)}</p><small>${new Date(signal.observedAt).toLocaleString()}</small></div></div>`).join("") : `<div class="empty-row">${local.tokenPresent ? "Aún no hay contexto compartido desde el escritorio." : "Conecta tu cuenta para ver aquí el contexto del twin."}</div>`}</div>
      </section>
      <section class="section-card context-card current-work-card"><div class="section-heading"><div><h2>¿En qué estás trabajando?</h2></div></div>
        <p class="body-copy">Comparte el proyecto y tu enfoque con el Twin durante cuatro horas. La nota se envía al guardar. Las carpetas que das al chat se gestionan en Asistente.</p>
        <label class="field-label" for="work-project">Proyecto (opcional)</label><input class="text-input" id="work-project" maxlength="100" value="${escapeHtml(projectDraft)}" placeholder="Por ejemplo, Novo Companion" autocomplete="off">
        <label class="field-label" for="work-focus">Enfoque actual</label><textarea class="text-input" id="work-focus" maxlength="240" rows="2" placeholder="Por ejemplo, conectar el contexto actual de trabajo">${escapeHtml(focusDraft)}</textarea>
        <div class="capture-controls"><button class="primary-button" data-action="save-work-context" ${!canShareWorkContext() || workContextBusy ? "disabled" : ""}>${workContextBusy ? "Guardando…" : "Compartir enfoque"}</button>${currentWorkContext?.canClear ? `<button class="quiet-button" data-action="clear-work-context" ${!canShareWorkContext() || workContextBusy ? "disabled" : ""}>Quitar contexto</button>` : ""}</div>
        <p class="body-copy" role="status">${escapeHtml(currentWorkStatus || workContextExpiry(currentWorkContext))}</p>
      </section>
      <section class="section-card context-card"><div class="section-heading"><div><span class="eyebrow">DESARROLLO CONECTADO</span><h2>GitHub y Vercel</h2></div><button class="refresh-button" data-action="refresh-developer-context" ${!local.tokenPresent ? "disabled" : ""} aria-label="Actualizar contexto de desarrollo"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 7v5h-5M19 12a7 7 0 1 1-2-5l3 3"/></svg></button></div>
        <p class="body-copy">Esta vista muestra resúmenes de revisiones y despliegues. El chat puede consultar las fuentes que hayas autorizado.</p>
        <div class="signal-list">${developerContextError ? `<div class="empty-row">${escapeHtml(developerContextError)}</div>` : developerContextLines.length ? developerContextLines.slice(0, 8).map((line) => `<div class="signal-item"><span class="signal-dot"></span><div><p>${escapeHtml(line)}</p><small>Resumen de lectura · sin acciones externas</small></div></div>`).join("") : `<div class="empty-row">${local.tokenPresent ? "Conecta GitHub o selecciona proyectos de Vercel en Novo; después actualiza para ver los resúmenes." : "Conecta Novo para consultar fuentes de desarrollo autorizadas."}</div>`}</div>
      </section>
    </div>`;

  for(const details of root.querySelectorAll<HTMLDetailsElement>('details'))details.open=openedDetails.includes(details.className);
  root.querySelector<HTMLInputElement>('#novo-origin')?.addEventListener('input',event=>{originDraft=(event.currentTarget as HTMLInputElement).value;});
  root.querySelector<HTMLInputElement>('#novo-device-name')?.addEventListener('input',event=>{deviceNameDraft=(event.currentTarget as HTMLInputElement).value;});
  root.querySelector<HTMLInputElement>('#excluded-apps')?.addEventListener('input',event=>{exclusionsDraft=(event.currentTarget as HTMLInputElement).value;});
  root.querySelector<HTMLInputElement>("#consent")?.addEventListener("change", (event) => {
    permissionConfirmed = (event.currentTarget as HTMLInputElement).checked;
    render();
    root?.querySelector<HTMLInputElement>('#consent')?.focus();
  });
  root.querySelector<HTMLInputElement>("#work-project")?.addEventListener("input", (event) => { projectDraft = (event.currentTarget as HTMLInputElement).value; });
  root.querySelector<HTMLTextAreaElement>("#work-focus")?.addEventListener("input", (event) => { focusDraft = (event.currentTarget as HTMLTextAreaElement).value; });
  root.querySelector<HTMLInputElement>("#device-token")?.addEventListener("input", (event) => { manualTokenDraft = (event.currentTarget as HTMLInputElement).value; });
  root.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => button.addEventListener("click", () => void runAction(button)));
}

async function runAction(button:HTMLButtonElement){
  if(actionInFlight)return;
  actionInFlight=true;button.disabled=true;
  try {await action(button.dataset.action);}
  catch {message='No se pudo completar la acción. Comprueba la conexión y vuelve a intentarlo.';}
  finally {actionInFlight=false;button.disabled=false;render();}
}

async function refresh() {
  if (isTauri) {
    local = await invoke<LocalSummary>("companion_status");
    if (local.enabled && !local.paused) sample = await invoke<Snapshot | null>("companion_sample");
  }
  render();
}

async function refreshAccount(){
  const generation=++accountGeneration;
  account={...account,state:'verifying'};render();
  const verified=await Bridge.novoAccountStatus();if(generation!==accountGeneration)return;
  account=verified;local.accountConnected=verified.state==='connected';
  if(verified.authorization?.capabilities.activityRead!==true)signals=[];
  if(verified.authorization?.capabilities.integrationsRead!==true){developerContextLines=[];developerContextError='';}
  if(verified.authorization?.device)deviceName=verified.authorization.device.name;
  render();
  await refresh();
  if(generation!==accountGeneration)return;
  await refreshWorkContext();
  await refreshDeveloperContext();
}

async function syncPending(manual = false) {
  if(account.revocationPending)return;
  if(account.authorization?.capabilities.activityWrite!==true)return;
  if (!shouldStartActivitySync({
    isTauri,
    syncInFlight,
    historyClearRequested,
    tokenPresent: local.tokenPresent,
    queuedEvents: local.queuedEvents,
    online: navigator.onLine,
  })) return;
  syncInFlight = true;
  try {
    const result = await invoke<{ accepted: number; skipped: number }>("companion_sync");
    if (manual) message = `Resúmenes actualizados: ${result.accepted} días/app; ${result.skipped} duplicados de esta solicitud.`;
    await refreshSignals();
  } catch {
    if (manual) message = "La sincronización no está disponible. Tu historial de 7 días sigue local; se reintentará al recuperar conexión.";
  } finally {
    syncInFlight = false;
    await refresh();
  }
}

async function refreshSignals() {
  if (!isTauri || !local.tokenPresent || account.authorization?.capabilities.activityRead!==true) { signals=[]; return; }
  const generation=accountGeneration;
  const result=await invoke<Signal[]>("companion_context");if(generation===accountGeneration)signals=result;
}

function canShareWorkContext(): boolean {
  const capabilities=account.authorization?.capabilities;
  return isTauri && account.state==='connected' && !account.revocationPending
    && capabilities?.workContextRead===true && capabilities.workContextWrite===true;
}

function workContextExpiry(context:NovoWorkContext|null):string {
  return context ? `Compartido hasta ${new Date(context.expiresAt).toLocaleTimeString()}.` : '';
}

async function refreshWorkContext() {
  if(!isTauri || !local.tokenPresent || account.authorization?.capabilities.workContextRead!==true){
    currentWorkContext=null;
    currentWorkStatus=account.state==='connected' ? 'Autoriza la lectura y escritura de contexto de trabajo para que el Twin lo use.' : 'Conecta tu cuenta Novo para compartir el enfoque actual.';
    render();
    return;
  }
  const generation=accountGeneration;
  try {
    const result=await Bridge.novoWorkContextGet();
    if(generation!==accountGeneration)return;
    currentWorkContext=result.context;
    if(result.context){projectDraft=result.context.projectLabel??'';focusDraft=result.context.focusSummary;}
    currentWorkStatus=workContextExpiry(currentWorkContext);
  } catch(error) {
    if(generation!==accountGeneration)return;
    currentWorkContext=null;
    const code=error && typeof error==='object' && 'code' in error ? String((error as {code:unknown}).code) : '';
    currentWorkStatus=code==='permission_required' ? 'Actualiza los permisos de contexto de trabajo en Novo.' : 'El contexto actual no está disponible; tu nota local no se ha compartido.';
  }
  render();
}

async function refreshDeveloperContext(force = false) {
  if (!isTauri || !local.tokenPresent || account.authorization?.capabilities.integrationsRead!==true) { developerContextLines=[];developerContextError='';return; }
  const generation=accountGeneration;
  const lastAttemptMs=developerContextLastAttempt?.generation===generation ? developerContextLastAttempt.atMs : null;
  if (!shouldRefreshDeveloperContext({nowMs:Date.now(),lastAttemptMs,inFlight:developerContextRequestGeneration===generation,force})) return;
  developerContextRequestGeneration=generation;
  developerContextLastAttempt={generation,atMs:Date.now()};
  developerContextError = "";
  try {
    const context = await invoke<unknown>("companion_developer_context");
    if(generation!==accountGeneration)return;developerContextLines = formatDeveloperContext(context);
  } catch (error) {
    if(generation!==accountGeneration)return;
    developerContextLines = [];
    developerContextError = developerContextErrorMessage(error);
  } finally {
    if(developerContextRequestGeneration===generation)developerContextRequestGeneration=null;
  }
  render();
}

function scheduleAuthorizationPoll(delaySeconds: number) {
  if (authorizationTimer !== null) window.clearTimeout(authorizationTimer);
  authorizationTimer = window.setTimeout(async () => {
    authorizationTimer = null;
    try {
      const result = await invoke<{ state: "pending" | "authorized"; intervalSeconds: number }>("companion_authorization_poll");
      if (result.state === "authorized") {
        authorizationPrompt = null;originDraft=null;deviceNameDraft=null;
        await refreshAccount();
        message = account.state==='connected' ? 'Cuenta y dispositivo verificados. Puedes usar el chat de la isla.' : 'Autorización guardada; la cuenta aún no está verificada.';
        await refresh();
        await refreshWorkContext();
        await refreshSignals().catch(() => undefined);
        await refreshDeveloperContext(true);
        render();
        return;
      }
      if(authorizationPrompt)authorizationPrompt.intervalSeconds=result.intervalSeconds;
      scheduleAuthorizationPoll(result.intervalSeconds);
    } catch (error) {
      const reason = String(error);
      if (reason.includes("authorization_denied")) {
        authorizationPrompt = null;
        message = "Autorización cancelada desde Novo.";
        render();
        return;
      }
      if (reason.includes("authorization_expired")) {
        authorizationPrompt = null;
        message = "El código venció. Inicia sesión de nuevo cuando quieras.";
        render();
        return;
      }
      if (reason.includes("credential_store_unavailable") || reason.includes("settings_save_failed") || reason.includes("authorization_not_pending")) {
        authorizationPrompt = null;
        message = 'No se pudo completar la verificación protegida. Verifica la cuenta antes de iniciar otra autorización.';
        await refreshAccount();
        render();
        return;
      }
      if(!authorizationPrompt){message='La autorización sigue pendiente. Usa Continuar verificación cuando haya conexión.';await refreshAccount();render();return;}
      // Temporary network errors do not discard a valid pending device code.
      scheduleAuthorizationPoll(Math.max(5,authorizationPrompt.intervalSeconds));
    }
  }, Math.max(1, delaySeconds) * 1000);
}

async function action(name?: string) {
  if (name === "capture") {
    if (!local.enabled && !permissionConfirmed) return;
    if (isTauri) await invoke("companion_capture_set", { enabled: !local.enabled });
    message = local.enabled ? "Observación detenida." : "Observación activada en este dispositivo.";
  }
  if (name === "pause" && isTauri) {
    await invoke("companion_pause_set", { paused: !local.paused });
    message = local.paused ? "La captura se reanudó." : "Pausa activa: no se captura ni se sincroniza.";
  }
  if (name === "save-exclusions" && isTauri) {
    const values = (root?.querySelector<HTMLInputElement>("#excluded-apps")?.value ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    await invoke("companion_exclusions_set", { applications: values });
    exclusionsDraft=null;message = "Exclusiones guardadas.";
  }
  if (name === "clear-history") {
    if (historyClearRequested) {
      message = "La eliminación del historial ya está en curso.";
      render();
      return;
    }
    if (syncInFlight) {
      message = "Hay una sincronización en curso. Espera a que termine antes de eliminar el historial local.";
      render();
      return;
    }
    if (confirm("¿Eliminar todos los segmentos guardados localmente? Esto no borra resúmenes ya sincronizados en Novo.")) {
      if (isTauri) {
        historyClearRequested = true;
        try {
          await invoke("companion_history_clear");
          message = "Historial local eliminado.";
        } catch {
          message = "No se pudo borrar el historial local; vuelve a intentarlo.";
        } finally {
          historyClearRequested = false;
        }
      } else {
        message = "La demostración no guarda historial local.";
      }
    }
  }
  if (name === "connect" && isTauri) {
    const origin = root?.querySelector<HTMLInputElement>("#novo-origin")?.value.trim() ?? "";
    const tokenInput = root?.querySelector<HTMLInputElement>("#device-token");
    const token = tokenInput?.value.trim() ?? "";
    manualTokenDraft = token;
    if (!/^https:\/\//i.test(origin)) { message = "Por seguridad, la dirección debe usar HTTPS."; render(); return; }
    if (!token && !local.tokenPresent) { message = "Añade un token revocable para este dispositivo."; render(); return; }
    try {
      await invoke("companion_connect", { origin, token: token || null });
      manualTokenDraft = "";originDraft=null;
      if (tokenInput) tokenInput.value = "";
    } catch (error) {
      const reason = String(error);
      message = reason.includes("token_origin_mismatch")
        ? "La dirección es distinta de la que validó este token. Pégalo de nuevo solo si confías en ese servidor."
        : reason.includes("disconnect_account_first")
        ? "Desconecta primero la sesión iniciada en el navegador; luego conecta el token personal."
        : reason.includes("permission_required") || reason.includes("companion_permission_required")
          ? "El token no tiene acceso a Novo Companion. Crea uno nuevo en Ajustes de Novo con esa opción activada."
          : "No se pudo validar el token; revisa la dirección, su vigencia y los permisos de Companion.";
      render();
      return;
    }

    message = "Token validado y guardado en este equipo.";
    try {
      await refreshAccount();
      await refresh();
      await refreshWorkContext();
      await refreshSignals().catch(() => undefined);
      await refreshDeveloperContext(true);
      if (account.state === 'connected') message = "Token validado: dispositivo vinculado y cuenta lista.";
    } catch {
      message = "Token validado y guardado. No se pudo actualizar el estado en pantalla; usa Verificar cuenta.";
    }
    render();
    return;
  }
  if (name === "account-connect" && isTauri) {
    const origin = root?.querySelector<HTMLInputElement>("#novo-origin")?.value.trim() ?? "";
    if (!/^https:\/\//i.test(origin)) { message = "Por seguridad, la dirección debe usar HTTPS."; render(); return; }
    deviceName=root?.querySelector<HTMLInputElement>('#novo-device-name')?.value.trim()||'Novo PC';
    if(local.tokenPresent && !confirm('¿Actualizar la conexión de este dispositivo? Confirma la cuenta y los permisos en el navegador. El historial pendiente no se enviará a otra cuenta.'))return;
    try {
      authorizationPrompt = await invoke<DeviceAuthorizationPrompt>("companion_authorization_start", { origin,deviceName,reconnect:local.tokenPresent });
      message = "Confirma el acceso en la página segura de Novo.";
      render();
      scheduleAuthorizationPoll(authorizationPrompt.intervalSeconds);
      return;
    } catch (error) {
      const reason = String(error);
      message = reason.includes("already_connected")
        ? "Desconecta la sesión actual antes de volver a autorizarla."
        : "No se pudo iniciar el inicio de sesión. Verifica la dirección de Novo y vuelve a intentar.";
    }
  }
  if(name==='verify-account'){await refreshAccount();return;}
  if(name==='resume-authorization' && isTauri){scheduleAuthorizationPoll(1);message='Verificando la autorización protegida…';render();return;}
  if (name === "copy-code" && authorizationPrompt) {
    try { await navigator.clipboard.writeText(authorizationPrompt.userCode); message = "Código copiado. Confirma el acceso en Novo."; }
    catch { message = "Selecciona el código y cópialo manualmente."; }
  }
  if (name === "cancel-authorization" && isTauri) {
    if (authorizationTimer !== null) window.clearTimeout(authorizationTimer);
    authorizationTimer = null;
    await invoke("companion_authorization_cancel");
    authorizationPrompt = null;
    message = "Inicio de sesión cancelado.";
    await refreshAccount();
  }
  if (name === "disconnect" && isTauri) {
    const confirmation = local.accountConnected
      ? "¿Desconectar este dispositivo y revocar su sesión en Novo? La observación se detendrá. El historial local de 7 días se conservará."
      : "¿Desconectar este dispositivo y borrar el token de este equipo? Si era un token personal, seguirá vigente en Novo hasta que lo revoques allí. El historial local se conservará.";
    if (confirm(confirmation)) {
      try {
        const result = await invoke<string>("companion_disconnect");
        await refreshAccount();
        signals = [];
        developerContextLines = [];
        developerContextError = "";
        message = result === 'revocation_pending' ? 'Detenido localmente; revocación remota pendiente. Puedes reintentar cuando haya conexión.' : result === "oauth_revoked"
          ? "Sesión revocada en Novo y credenciales eliminadas de este equipo."
          : "Token eliminado de este equipo. Revócalo también en Ajustes de Novo si ya no lo usarás.";
      } catch {
        message = "La observación se detuvo, pero no se pudo confirmar la revocación con Novo. Se conservó la credencial para reintentar; revócala desde Ajustes de Novo si no hay conexión.";
      }
    }
  }
  if (name === "sync" && isTauri) {
    await syncPending(true);
  }
  if (name === "refresh") {
    try { await refreshSignals(); await refreshWorkContext(); message = "Contexto actualizado desde Novo."; }
    catch { message = "No se pudo consultar el contexto. Revisa conexión y permisos."; }
  }
  if(name==='save-work-context'){
    projectDraft=root?.querySelector<HTMLInputElement>('#work-project')?.value??projectDraft;
    focusDraft=root?.querySelector<HTMLTextAreaElement>('#work-focus')?.value??focusDraft;
    const input=normalizeNovoWorkContextInput(projectDraft,focusDraft);
    if(!input){currentWorkStatus='Revisa el enfoque: máximo 240 caracteres, sin URLs, rutas ni secretos.';render();return;}
    if(!canShareWorkContext()){currentWorkStatus='Vuelve a autorizar el dispositivo con lectura y escritura de contexto de trabajo.';render();return;}
    workContextBusy=true;currentWorkStatus='Guardando en tu cuenta Novo…';render();
    try {
      const result=await Bridge.novoWorkContextSave(input);
      currentWorkContext=result.context;projectDraft=result.context.projectLabel??'';focusDraft=result.context.focusSummary;
      currentWorkStatus=workContextExpiry(result.context);message='Enfoque compartido con el Twin por cuatro horas.';
    } catch(error){
      const code=error && typeof error==='object' && 'code' in error ? String((error as {code:unknown}).code) : '';
      currentWorkStatus=code==='permission_required'?'Actualiza los permisos de contexto de trabajo en Novo.':'No se pudo compartir el enfoque. La nota sigue en este equipo.';
    } finally {workContextBusy=false;render();}
  }
  if(name==='clear-work-context' && currentWorkContext && canShareWorkContext()){
    if(confirm('¿Quitar de Novo el enfoque actual compartido desde este dispositivo?')){
      workContextBusy=true;render();
      try { await Bridge.novoWorkContextClear();currentWorkContext=null;projectDraft='';focusDraft='';currentWorkStatus='El contexto compartido se quitó.';message='Contexto de trabajo eliminado de Novo.'; }
      catch {currentWorkStatus='No se pudo quitar el contexto; inténtalo de nuevo.';}
      finally {workContextBusy=false;render();}
    }
  }
  if (name === "refresh-developer-context") {
    await refreshDeveloperContext(true);
    message = developerContextError ? "Revisa permisos o vuelve a intentar más tarde." : "Contexto de desarrollo actualizado en modo lectura.";
  }
  if (name === "minimize" && isTauri) await invoke("companion_minimize");
  await refresh();
  if (name === "connect" && isTauri) {
    await refreshDeveloperContext(true);
    render();
  }
}

/** Mounted once in unified settings; background activity sync survives tab changes. */
export function mountNovoAccount(element:HTMLElement){
  if(mounted)return;
  mounted=true;root=element;render();
  if (!isTauri)return;
  const timers:number[]=[];
  let stopped=false;
  const subscriptions:(()=>void)[]=[];
  const saveSubscription=(stop:()=>void)=>stopped?stop():subscriptions.push(stop);
  void refreshAccount().catch(()=>{message='No se pudo verificar la cuenta. Usa Verificar cuenta para reintentar.';render();});
  void onEvent('novo-account-changed',()=>{++accountGeneration;signals=[];currentWorkContext=null;currentWorkStatus='';projectDraft='';focusDraft='';developerContextLines=[];developerContextError='';sample=null;permissionConfirmed=false;void refreshAccount().catch(()=>{message='No se pudo verificar la cuenta.';render();});}).then(saveSubscription);
  const refreshAndSync=async()=>{try{await refresh();await syncPending();}catch{message='La actividad no se pudo actualizar. Vuelve a intentarlo cuando haya conexión.';render();}};
  void refreshAndSync().then(()=>refreshWorkContext());
  void refreshSignals().catch(()=>undefined);
  void refreshDeveloperContext();
  timers.push(window.setInterval(()=>{void refreshAndSync();},15_000));
  const online=()=>{void refreshAndSync();};window.addEventListener('online',online);
  timers.push(window.setInterval(()=>{void refreshSignals().catch(()=>undefined);},60_000));
  timers.push(window.setInterval(()=>{void refreshDeveloperContext();},DEVELOPER_CONTEXT_REFRESH_INTERVAL_MS));
  window.addEventListener('beforeunload',()=>{stopped=true;for(const id of timers)window.clearInterval(id);if(authorizationTimer!==null)window.clearTimeout(authorizationTimer);for(const stop of subscriptions)stop();window.removeEventListener('online',online);},{once:true});
}
