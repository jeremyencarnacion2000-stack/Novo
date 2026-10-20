//! Novo account transport only. No provider keys or animation runtime here.

use crate::{companion, Shared};
use chrono::{DateTime, Utc};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::future::Future;
use std::time::Duration;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeError {
    pub code: String,
    pub message: String,
    pub retry_after_seconds: Option<u64>,
}
impl SafeError {
    pub fn new(code: &str) -> Self {
        let (code, message) = match code {
            "demo" => ("demo", "Conecta tu cuenta de Novo para continuar."),
            "offline" => (
                "offline",
                "No se pudo conectar con Novo. Tu credencial se conserva.",
            ),
            "expired" | "unauthorized" | "authorization_expired" => {
                ("expired", "Vuelve a autorizar este dispositivo.")
            }
            "revoked" | "device_revoked" => ("revoked", "Esta conexión fue revocada en Novo."),
            "permission_required" | "twin_permission_required" => (
                "permission_required",
                "Actualiza los permisos de esta conexión.",
            ),
            "work_context_permission_required" | "activity_permission_required" => (
                "permission_required",
                "Actualiza los permisos de contexto de este dispositivo en Novo.",
            ),
            "request_conflict" | "revision_conflict" | "turn_active" => (
                code,
                "Hay un turno activo o una revisión diferente. No se repitió la generación.",
            ),
            "rate_limited" => (
                "rate_limited",
                "Se alcanzó un límite temporal. Espera antes de enviar otra solicitud.",
            ),
            "chat_disabled" => (
                "chat_disabled",
                "El chat del compañero aún no está activado en este servidor.",
            ),
            "cancelled" => ("cancelled", "Solicitud cancelada."),
            "pending" => (
                "pending",
                "Esta solicitud ya está en curso. No se inició otra generación.",
            ),
            "stream_interrupted" => (
                "stream_interrupted",
                "La respuesta se interrumpió; no se reintentó automáticamente.",
            ),
            "invalid_request" => (
                "invalid_request",
                "Comprueba el mensaje y la conversación seleccionada.",
            ),
            "request_expired" => (
                "request_expired",
                "Esta solicitud antigua no puede regenerarse automáticamente.",
            ),
            "credential_store_unavailable" => (
                "credential_store_unavailable",
                "No se pudo actualizar la credencial protegida de Windows.",
            ),
            "revocation_pending" => (
                "revocation_pending",
                "Detenido localmente; la revocación remota sigue pendiente.",
            ),
            "reconnect_required" => (
                "reconnect_required",
                "Este dispositivo ya está vinculado. Confirma la reconexión.",
            ),
            _ => (
                "unavailable",
                "El servicio no está disponible. No se hicieron reintentos de generación.",
            ),
        };
        Self {
            code: code.into(),
            message: message.into(),
            retry_after_seconds: None,
        }
    }
    pub fn from_status(status: u16) -> Self {
        Self::new(match status {
            401 => "expired",
            403 => "permission_required",
            409 => "request_conflict",
            429 => "rate_limited",
            _ => "unavailable",
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AccountState {
    Demo,
    AuthorizationPending,
    Verifying,
    Connected,
    Offline,
    PermissionRequired,
    Expired,
    Revoked,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Capabilities {
    pub device_connect: bool,
    pub ai_chat: bool,
    pub twin_read: bool,
    pub integrations_read: bool,
    pub activity_write: bool,
    #[serde(default)]
    pub activity_read: bool,
    #[serde(default)]
    pub work_context_read: bool,
    #[serde(default)]
    pub work_context_write: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AccountUser {
    pub id: String,
    pub display_name: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DeviceView {
    pub id: String,
    pub name: String,
    pub platform: String,
    pub connected_at: DateTime<Utc>,
    pub last_verified_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub scopes: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CompanionAuthorization {
    pub version: u8,
    pub state: String,
    pub user: AccountUser,
    pub device: Option<DeviceView>,
    pub capabilities: Capabilities,
}
impl CompanionAuthorization {
    pub fn validate_preflight(&self) -> Result<(), SafeError> {
        if self.version != 1
            || self.user.id.is_empty()
            || self.user.id.len() > 200
            || self.user.display_name.as_ref().is_some_and(|name| name.len() > 500)
            || self.device.is_some()
            || self.state != "permission_required"
            || !self.capabilities.device_connect
            || !self.capabilities.ai_chat
        {
            return Err(SafeError::new("permission_required"));
        }
        Ok(())
    }

    pub fn validate(&self, device_id: &str) -> Result<(), SafeError> {
        if self.version != 1
            || self.user.id.is_empty()
            || self.user.id.len() > 200
            || self
                .user
                .display_name
                .as_ref()
                .is_some_and(|n| n.len() > 500)
        {
            return Err(SafeError::new("unavailable"));
        }
        let device = self
            .device
            .as_ref()
            .ok_or_else(|| SafeError::new("permission_required"))?;
        if device.id != device_id
            || uuid::Uuid::parse_str(&device.id).is_err()
            || device.platform != "windows"
            || device.name.is_empty()
            || device.name.chars().count() > 80
            || device.scopes.len() > 40
            || device.scopes.iter().any(|s| s.len() > 120)
        {
            return Err(SafeError::new("unavailable"));
        }
        if device.revoked_at.is_some() || self.state == "revoked" {
            return Err(SafeError::new("revoked"));
        }
        if self.state != "connected"
            || !self.capabilities.device_connect
            || !self.capabilities.ai_chat
        {
            return Err(SafeError::new("permission_required"));
        }
        Ok(())
    }
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAccountStatus {
    pub state: AccountState,
    pub authorization: Option<CompanionAuthorization>,
    pub last_verified_at: Option<DateTime<Utc>>,
    pub revocation_pending: bool,
}
impl Default for NativeAccountStatus {
    fn default() -> Self {
        Self {
            state: AccountState::Demo,
            authorization: None,
            last_verified_at: None,
            revocation_pending: false,
        }
    }
}

pub struct StreamTicket {
    pub request_id: String,
    pub epoch: u64,
    pub cancelled: tokio::sync::watch::Receiver<bool>,
}
#[derive(Default)]
pub struct AccountRuntime {
    pub status: NativeAccountStatus,
    pub epoch: u64,
    pub authorization_attempt: u64,
    active: Option<(String, tokio::sync::watch::Sender<bool>)>,
    pub retry_at: Option<std::time::Instant>,
    transport_retry: crate::transport_retry::TransportRetry,
}
impl AccountRuntime {
    pub fn begin_stream(&mut self, id: String) -> Result<StreamTicket, SafeError> {
        if self.active.is_some() {
            return Err(SafeError::new("turn_active"));
        }
        if self
            .retry_at
            .is_some_and(|deadline| deadline > std::time::Instant::now())
        {
            return Err(SafeError::new("rate_limited"));
        }
        let (sender, cancelled) = tokio::sync::watch::channel(false);
        self.active = Some((id.clone(), sender));
        Ok(StreamTicket {
            request_id: id,
            epoch: self.epoch,
            cancelled,
        })
    }
    pub fn accepts(&self, ticket: &StreamTicket) -> bool {
        self.epoch == ticket.epoch
            && !*ticket.cancelled.borrow()
            && self
                .active
                .as_ref()
                .is_some_and(|(id, _)| *id == ticket.request_id)
    }
    pub fn finish_stream(&mut self, ticket: &StreamTicket) {
        if self.epoch == ticket.epoch
            && self
                .active
                .as_ref()
                .is_some_and(|(id, _)| *id == ticket.request_id)
        {
            self.active = None;
        }
    }
    pub fn cancel(&mut self, id: &str) -> bool {
        if let Some((active, sender)) = &self.active {
            if active == id {
                let _ = sender.send(true);
                return true;
            }
        }
        false
    }
    pub fn invalidate(&mut self) {
        if let Some((_, sender)) = self.active.take() {
            let _ = sender.send(true);
        }
        self.epoch = self.epoch.wrapping_add(1);
        self.status = NativeAccountStatus::default();
        self.retry_at = None;
        self.transport_retry.reset();
    }
    pub fn fail(&mut self, error: &SafeError) {
        if matches!(error.code.as_str(), "offline" | "unavailable" | "rate_limited") {
            self.transport_retry.fail(std::time::Instant::now(), error.retry_after_seconds);
        }
        self.status.state = match error.code.as_str() {
            "demo" => AccountState::Demo,
            "expired" => AccountState::Expired,
            "revoked" => AccountState::Revoked,
            "permission_required" => AccountState::PermissionRequired,
            _ => AccountState::Offline,
        };
        if matches!(
            self.status.state,
            AccountState::Expired | AccountState::Revoked | AccountState::PermissionRequired
        ) {
            if let Some((_, sender)) = self.active.take() {
                let _ = sender.send(true);
            }
            self.epoch = self.epoch.wrapping_add(1);
            self.status.authorization = None;
            self.transport_retry.reset();
        }
    }
    pub fn fail_if_current(&mut self, epoch: u64, error: &SafeError) -> bool {
        if self.epoch != epoch {
            return false;
        }
        self.fail(error);
        true
    }
}

pub async fn serialized<T>(lock: &tokio::sync::Mutex<()>, future: impl Future<Output = T>) -> T {
    let _guard = lock.lock().await;
    future.await
}
pub async fn verify_before_commit<T>(
    verification: impl Future<Output = Result<T, SafeError>>,
    commit: impl FnOnce() -> Result<(), SafeError>,
) -> Result<T, SafeError> {
    let verified = verification.await?;
    commit()?;
    Ok(verified)
}

#[derive(Deserialize)]
pub struct OAuthMetadata {
    pub issuer: String,
    pub registration_endpoint: String,
    pub device_authorization_endpoint: String,
    pub token_endpoint: String,
    pub revocation_endpoint: String,
}
pub fn validate_metadata(
    origin: &str,
    content_type: &str,
    bytes: &[u8],
) -> Result<OAuthMetadata, SafeError> {
    if !content_type
        .split(';')
        .next()
        .is_some_and(|mime| mime.trim().eq_ignore_ascii_case("application/json"))
        || bytes.len() > 65536
    {
        return Err(SafeError::new("unavailable"));
    }
    let parsed: OAuthMetadata =
        serde_json::from_slice(bytes).map_err(|_| SafeError::new("unavailable"))?;
    if parsed.issuer.trim_end_matches('/') != origin
        || companion::validate_origin(&parsed.issuer).is_err()
    {
        return Err(SafeError::new("unavailable"));
    }
    for endpoint in [
        &parsed.registration_endpoint,
        &parsed.device_authorization_endpoint,
        &parsed.token_endpoint,
        &parsed.revocation_endpoint,
    ] {
        companion::validate_oauth_endpoint(origin, endpoint)
            .map_err(|_| SafeError::new("unavailable"))?;
    }
    Ok(parsed)
}
pub fn client(seconds: u64) -> Result<reqwest::Client, SafeError> {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(seconds))
        .build()
        .map_err(|_| SafeError::new("unavailable"))
}
pub async fn read_json<T: DeserializeOwned>(
    response: reqwest::Response,
    limit: usize,
) -> Result<T, SafeError> {
    let status = response.status();
    if !status.is_success() {
        let retry = response
            .headers()
            .get("retry-after")
            .and_then(|s| s.to_str().ok())
            .and_then(|s| {
                s.parse::<u64>().ok().or_else(|| {
                    DateTime::parse_from_rfc2822(s).ok().map(|date| {
                        (date.with_timezone(&Utc) - Utc::now()).num_seconds().max(1) as u64
                    })
                })
            })
            .map(|n| n.clamp(1, 3600));
        let mut error = SafeError::from_status(status.as_u16());
        // Only known machine codes cross the Rust boundary, never provider body/text.
        if let Ok(bytes) = crate::net::read_capped(response, 65536).await {
            if let Ok(body) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                if let Some(code) = body.get("error").and_then(|v| v.as_str()) {
                    let known = SafeError::new(code);
                    if known.code != "unavailable" {
                        error = known;
                    }
                }
            }
        }
        error.retry_after_seconds = retry;
        return Err(error);
    }
    if !response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| {
            v.split(';')
                .next()
                .is_some_and(|m| m.trim() == "application/json")
        })
    {
        return Err(SafeError::new("unavailable"));
    }
    let bytes = crate::net::read_capped(response, limit)
        .await
        .map_err(|_| SafeError::new("unavailable"))?;
    serde_json::from_slice(&bytes).map_err(|_| SafeError::new("unavailable"))
}

pub struct AccessContext {
    pub origin: String,
    pub token: String,
    pub device_id: String,
    pub epoch: u64,
}
pub async fn access_context(shared: &Shared) -> Result<AccessContext, SafeError> {
    serialized(&shared.companion_auth_lock, async {
        let (origin, device_id, stopped) = {
            let settings = shared
                .settings
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            (
                settings.companion_api_origin.clone(),
                settings.companion_device_id.clone(),
                settings.companion_revocation_pending,
            )
        };
        if stopped {
            return Err(SafeError::new("revocation_pending"));
        }
        if let Some(seconds) = shared.novo_account.lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .transport_retry.remaining_seconds(std::time::Instant::now()) {
            let mut error = SafeError::new("unavailable");
            error.retry_after_seconds = Some(seconds);
            return Err(error);
        }
        let origin = companion::validate_origin(&origin).map_err(|_| SafeError::new("demo"))?;
        let token = companion::companion_access_token_locked(&origin)
            .await
            .map_err(|e| SafeError::new(&e))?;
        let epoch = shared
            .novo_account
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .epoch;
        Ok(AccessContext {
            origin,
            token,
            device_id,
            epoch,
        })
    })
    .await
}
pub async fn verify_account(shared: &Shared) -> Result<CompanionAuthorization, SafeError> {
    let access = access_context(shared).await?;
    let result = async {
        let response = client(15)?
            .get(format!("{}/api/companion/authorization", access.origin))
            .bearer_auth(&access.token)
            .header("X-Novo-Device-Id", &access.device_id)
            .send()
            .await
            .map_err(|_| SafeError::new("offline"))?;
        let authorization: CompanionAuthorization = read_json(response, 65536).await?;
        authorization.validate(&access.device_id)?;
        Ok::<_, SafeError>(authorization)
    }.await;
    let mut runtime = shared
        .novo_account
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    if runtime.epoch != access.epoch {
        return Err(SafeError::new("cancelled"));
    }
    let authorization = match result {
        Ok(authorization) => authorization,
        Err(error) => { runtime.fail(&error); return Err(error); }
    };
    runtime.transport_retry.reset();
    runtime.status = NativeAccountStatus {
        state: AccountState::Connected,
        authorization: Some(authorization.clone()),
        last_verified_at: Some(Utc::now()),
        revocation_pending: false,
    };
    Ok(authorization)
}
#[tauri::command]
pub async fn novo_account_status(
    shared: State<'_, Shared>,
) -> Result<NativeAccountStatus, SafeError> {
    if shared
        .pending_companion_authorization
        .lock()
        .await
        .is_some()
        || companion::staged_authorization_pending()
    {
        let mut state = shared
            .novo_account
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .status
            .clone();
        state.state = AccountState::AuthorizationPending;
        return Ok(state);
    }
    let epoch = shared
        .novo_account
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .epoch;
    if let Err(error) = verify_account(&shared).await {
        if error.code != "cancelled" {
            shared
                .novo_account
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner)
                .fail_if_current(epoch, &error);
        }
    }
    let mut status = shared
        .novo_account
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .status
        .clone();
    status.revocation_pending = shared
        .settings
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .companion_revocation_pending
        || companion::old_revocation_pending();
    Ok(status)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex,
    };

    #[test]
    fn missing_new_capabilities_from_older_server_responses_default_to_denied() {
        let capabilities: Capabilities = serde_json::from_value(serde_json::json!({
            "deviceConnect": true,
            "aiChat": true,
            "twinRead": false,
            "integrationsRead": false,
            "activityWrite": false,
        }))
        .unwrap();

        assert!(!capabilities.activity_read);
        assert!(!capabilities.work_context_read);
        assert!(!capabilities.work_context_write);
    }

    #[test]
    fn personal_token_preflight_requires_account_and_companion_permissions() {
        let mut preflight = CompanionAuthorization {
            version: 1,
            state: "permission_required".into(),
            user: AccountUser { id: "account-1".into(), display_name: Some("Novo user".into()) },
            device: None,
            capabilities: Capabilities {
                device_connect: true,
                ai_chat: true,
                twin_read: true,
                integrations_read: false,
                activity_write: true,
                activity_read: false,
                work_context_read: false,
                work_context_write: false,
            },
        };
        assert!(preflight.validate_preflight().is_ok());
        preflight.capabilities.ai_chat = false;
        assert!(preflight.validate_preflight().is_err());
        preflight.capabilities.ai_chat = true;
        preflight.state = "connected".into();
        assert!(preflight.validate_preflight().is_err());
    }

    #[test]
    fn html_and_cross_origin_metadata_are_rejected() {
        let metadata = br#"{"issuer":"https://novo.test","registration_endpoint":"https://other.test/register","device_authorization_endpoint":"https://novo.test/device","token_endpoint":"https://novo.test/token","revocation_endpoint":"https://novo.test/revoke"}"#;
        assert!(validate_metadata("https://novo.test", "application/json", metadata).is_err());
        assert!(
            validate_metadata("https://novo.test", "text/html", b"<html>login</html>").is_err()
        );
        let valid = String::from_utf8(metadata.to_vec())
            .unwrap()
            .replace("https://other.test/register", "https://novo.test/register");
        assert!(validate_metadata(
            "https://novo.test",
            "application/json; charset=utf-8",
            valid.as_bytes()
        )
        .is_ok());
        assert!(
            validate_metadata("https://else.test", "application/json", valid.as_bytes()).is_err()
        );
    }

    #[test]
    fn reauthorization_keeps_old_credential_until_verified() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let vault = Mutex::new("old-grant".to_string());
        runtime.block_on(async {
            let result =
                verify_before_commit(async { Err::<(), _>(SafeError::new("offline")) }, || {
                    *vault.lock().unwrap() = "new-grant".into();
                    Ok(())
                })
                .await;
            assert!(result.is_err());
            assert_eq!(*vault.lock().unwrap(), "old-grant");
            verify_before_commit(async { Ok(()) }, || {
                *vault.lock().unwrap() = "new-grant".into();
                Ok(())
            })
            .await
            .unwrap();
            assert_eq!(*vault.lock().unwrap(), "new-grant");
        });
    }

    #[test]
    fn refresh_rotation_is_serialized() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        runtime.block_on(async {
            let lock = Arc::new(tokio::sync::Mutex::new(()));
            let rotated = Arc::new(Mutex::new(false));
            let calls = Arc::new(AtomicUsize::new(0));
            let mut handles = vec![];
            for _ in 0..2 {
                let (lock, rotated, calls) = (lock.clone(), rotated.clone(), calls.clone());
                handles.push(tokio::spawn(async move {
                    serialized(&lock, async {
                        if !*rotated.lock().unwrap() {
                            calls.fetch_add(1, Ordering::SeqCst);
                            tokio::task::yield_now().await;
                            *rotated.lock().unwrap() = true;
                        }
                    })
                    .await;
                }));
            }
            for handle in handles {
                handle.await.unwrap();
            }
            assert_eq!(calls.load(Ordering::SeqCst), 1);
        });
    }

    #[test]
    fn account_switch_cancels_old_stream() {
        let mut account = AccountRuntime::default();
        let ticket = account.begin_stream("old-request".into()).unwrap();
        assert!(account.accepts(&ticket));
        account.invalidate();
        assert!(!account.accepts(&ticket));
        assert_eq!(account.status.state, AccountState::Demo);
        let json = serde_json::to_string(&account.status).unwrap();
        assert!(!json.contains("refresh_token"));
        assert!(!json.contains("access_token"));
    }

    #[test]
    fn stale_verification_error_cannot_invalidate_the_new_account() {
        let mut account = AccountRuntime::default();
        let old_epoch = account.epoch;
        account.invalidate();
        account.status.state = AccountState::Connected;
        let current = account.begin_stream("new-request".into()).unwrap();

        assert!(!account.fail_if_current(old_epoch, &SafeError::new("revoked")));
        assert_eq!(account.status.state, AccountState::Connected);
        assert!(account.accepts(&current));
        assert!(account.fail_if_current(current.epoch, &SafeError::new("revoked")));
        assert_eq!(account.status.state, AccountState::Revoked);
        assert!(!account.accepts(&current));
    }

    #[test]
    fn transient_failure_waits_without_replacing_account_or_cancelling_the_current_turn() {
        let mut account = AccountRuntime::default();
        let ticket = account.begin_stream("current-request".into()).unwrap();
        assert!(account.fail_if_current(ticket.epoch, &SafeError::new("unavailable")));
        assert_eq!(account.status.state, AccountState::Offline);
        assert!(account.accepts(&ticket));
        assert!(account.transport_retry.remaining_seconds(std::time::Instant::now()).is_some());
        account.invalidate();
        assert!(account.transport_retry.remaining_seconds(std::time::Instant::now()).is_none());
    }

    #[test]
    fn transport_errors_are_allowlisted_and_distinct() {
        for (http, code) in [
            (401, "expired"),
            (403, "permission_required"),
            (409, "request_conflict"),
            (429, "rate_limited"),
            (503, "unavailable"),
        ] {
            assert_eq!(SafeError::from_status(http).code, code);
        }
        assert_eq!(
            SafeError::new("provider-secret-message").code,
            "unavailable"
        );
    }

    fn fixture_response(status: u16, headers: &str, body: &str) -> String {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let response=format!("HTTP/1.1 {status} Fixture\r\nContent-Length: {}\r\nConnection: close\r\n{headers}\r\n{body}",body.len());
        std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            let mut request = [0; 4096];
            let _ = socket.read(&mut request);
            socket.write_all(response.as_bytes()).unwrap();
        });
        url
    }
    #[test]
    fn credential_redirects_are_not_followed() {
        let destination = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        destination.set_nonblocking(true).unwrap();
        let url = fixture_response(
            307,
            &format!("Location: http://{}\r\n", destination.local_addr().unwrap()),
            "",
        );
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        runtime.block_on(async {
            let response = client(3)
                .unwrap()
                .post(url)
                .bearer_auth("synthetic-access")
                .form(&[("refresh_token", "synthetic-refresh")])
                .send()
                .await
                .unwrap();
            assert_eq!(response.status().as_u16(), 307);
        });
        assert!(
            matches!(destination.accept(),Err(error) if error.kind()==std::io::ErrorKind::WouldBlock)
        );
    }
    #[test]
    fn http_fixtures_bound_errors_and_preserve_retry_after() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        runtime.block_on(async {
            for (status, code) in [
                (401, "expired"),
                (403, "permission_required"),
                (409, "request_conflict"),
                (429, "rate_limited"),
                (503, "unavailable"),
            ] {
                let url = fixture_response(
                    status,
                    "Content-Type: application/json\r\nRetry-After: 90\r\n",
                    r#"{"error":"sensitive-provider-text","refresh_token":"synthetic-secret"}"#,
                );
                let error = read_json::<serde_json::Value>(
                    client(3).unwrap().get(url).send().await.unwrap(),
                    65536,
                )
                .await
                .unwrap_err();
                assert_eq!(error.code, code);
                assert_eq!(error.retry_after_seconds, Some(90));
                assert!(!serde_json::to_string(&error)
                    .unwrap()
                    .contains("synthetic-secret"));
            }
            let url = fixture_response(200, "Content-Type: text/html\r\n", "<html>signin</html>");
            assert!(read_json::<serde_json::Value>(
                client(3).unwrap().get(url).send().await.unwrap(),
                65536
            )
            .await
            .is_err());
        });
    }
}
