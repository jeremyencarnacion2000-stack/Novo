//! Privacy-bounded activity capture and synchronization for Novo Companion.
//!
//! Only normalized executable identifiers and time segments are ever stored.
//! Window text, paths, URLs, input and process command lines are deliberately
//! not represented in the data model.

use std::collections::BTreeMap;
use std::fs;
use std::sync::MutexGuard;
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::{platform, secrets, settings, Shared};

const RETENTION: chrono::Duration = chrono::Duration::days(7);
const MAX_SEGMENT: chrono::Duration = chrono::Duration::minutes(10);
const MAX_EVENTS_PER_SYNC: usize = 200;
const TOKEN_KEY: &str = "novo-device-token";
const OAUTH_CLIENT_ID_KEY: &str = "novo-oauth-client-id";
const OAUTH_CLIENT_ORIGIN_KEY: &str = "novo-oauth-client-origin";
const OAUTH_CREDENTIALS_KEY: &str = "novo-oauth-credentials";
const OAUTH_CLIENT_SCOPES_KEY: &str = "novo-oauth-client-scopes";
const OAUTH_REVOCATIONS_KEY: &str = "novo-oauth-pending-revocations";
const OAUTH_STAGED_KEY: &str = "novo-oauth-staged-authorization";
const DEVICE_CODE_GRANT: &str = "urn:ietf:params:oauth:grant-type:device_code";
const COMPANION_OAUTH_SCOPES: &str = "device:connect ai:chat twin:read projects:read device:activity:read device:activity:write device:work-context:read device:work-context:write integrations:read";
const IDLE_AFTER_SECONDS: u64 = 300;

#[derive(Clone,Serialize,Deserialize)]
pub struct PendingDeviceAuthorization {
    api_origin: String,
    client_id: String,
    device_code: String,
    token_endpoint: String,
    revocation_endpoint: String,
    device_name: String,
    reconnect: bool,
    attempt: u64,
    expires_at: DateTime<Utc>,
    interval_seconds: u64,
    next_poll_at: DateTime<Utc>,
    candidate: Option<OAuthCredentials>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceAuthorizationPrompt {
    verification_uri: String,
    user_code: String,
    interval_seconds: u64,
    expires_at: DateTime<Utc>,
    opened_in_browser: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceAuthorizationPoll {
    state: &'static str,
    interval_seconds: u64,
}

#[derive(Debug, Deserialize)]
struct OAuthClientRegistration {
    client_id: String,
}

#[derive(Debug, Deserialize)]
struct DeviceAuthorizationResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    #[serde(default)]
    verification_uri_complete: Option<String>,
    expires_in: u64,
    #[serde(default)]
    interval: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct OAuthErrorResponse {
    error: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
struct OAuthCredentials {
    // Private durable identity survives token rotation and recovery after a crash.
    #[serde(default)]
    installation_id: Option<Uuid>,
    access_token: String,
    refresh_token: String,
    client_id: String,
    token_endpoint: String,
    revocation_endpoint: String,
    expires_at: DateTime<Utc>,
    #[serde(default)]
    api_origin: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredPersonalAccessToken {
    token: String,
    api_origin: String,
}

#[derive(Debug, Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    expires_in: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEvent {
    id: String,
    application_id: String,
    state: ActivityState,
    started_at: DateTime<Utc>,
    ended_at: DateTime<Utc>,
    #[serde(default)]
    synced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum ActivityState {
    Active,
    Idle,
    Locked,
}

impl ActivityState {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Idle => "idle",
            Self::Locked => "locked",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ActivityDailySummary {
    day: String,
    application_id: String,
    state: ActivityState,
    duration_seconds: u64,
}

#[derive(Debug)]
struct OpenSegment {
    id: String,
    application_id: String,
    state: ActivityState,
    started_at: DateTime<Utc>,
    last_seen: DateTime<Utc>,
}

#[derive(Debug, Default)]
pub struct ActivityRecorder {
    events: Vec<ActivityEvent>,
    current: Option<OpenSegment>,
    next_archive_check: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompanionStatus {
    device_id: String,
    enabled: bool,
    paused: bool,
    api_origin: String,
    token_present: bool,
    account_connected: bool,
    excluded_applications: Vec<String>,
    active_minutes_today: u64,
    app_minutes_today: BTreeMap<String, u64>,
    queued_events: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivitySnapshot {
    application_id: String,
    state: ActivityState,
    idle_seconds: u64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResponse {
    pub accepted: usize,
    pub skipped: usize,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ContextResponse {
    #[serde(default)]
    signals: Vec<ContextSignal>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextSignal {
    pub source_ref: String,
    pub signal_type: String,
    pub label: String,
    pub observed_at: DateTime<Utc>,
    pub reliability: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WorkContextInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_label: Option<String>,
    pub focus_summary: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkContextSummary {
    pub project_label: Option<String>,
    pub focus_summary: String,
    pub source: String,
    pub status: String,
    pub observed_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub can_clear: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkContextEnvelope {
    pub context: Option<WorkContextSummary>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkContextClearResult {
    pub cleared: bool,
}

fn work_context_request_error(status: u16) -> &'static str {
    match status {
        401 => "authorization_expired",
        403 => "work_context_permission_required",
        _ => "work_context_unavailable",
    }
}

fn ensure_account_epoch(shared: &Shared, epoch: u64) -> Result<(), String> {
    let current = shared.novo_account.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    if current.epoch == epoch { Ok(()) } else { Err("cancelled".into()) }
}

#[tauri::command]
pub async fn companion_work_context_get(shared: State<'_, Shared>) -> Result<WorkContextEnvelope, String> {
    let access = crate::novo_account::access_context(shared.inner()).await.map_err(|error| error.code)?;
    let response = crate::novo_account::client(15).map_err(|_| "work_context_unavailable".to_string())?
        .get(format!("{}/api/companion/work-context", access.origin.trim_end_matches('/')))
        .bearer_auth(&access.token).header("X-Novo-Device-Id", &access.device_id)
        .send().await.map_err(|_| "connection_unavailable".to_string())?;
    if !response.status().is_success() { return Err(work_context_request_error(response.status().as_u16()).into()); }
    let payload = crate::novo_account::read_json(response, 65536).await.map_err(|error| error.code)?;
    ensure_account_epoch(shared.inner(), access.epoch)?;
    Ok(payload)
}

#[tauri::command]
pub async fn companion_work_context_save(shared: State<'_, Shared>, input: WorkContextInput) -> Result<WorkContextEnvelope, String> {
    let focus = input.focus_summary.trim();
    let project = input.project_label.as_deref().map(str::trim).filter(|value| !value.is_empty());
    if focus.is_empty() || focus.chars().count() > 240 || project.is_some_and(|value| value.chars().count() > 100) {
        return Err("invalid_request".into());
    }
    let normalized = WorkContextInput {
        project_label: project.map(ToOwned::to_owned),
        focus_summary: focus.to_owned(),
    };
    let access = crate::novo_account::access_context(shared.inner()).await.map_err(|error| error.code)?;
    let response = crate::novo_account::client(15).map_err(|_| "work_context_unavailable".to_string())?
        .post(format!("{}/api/companion/work-context", access.origin.trim_end_matches('/')))
        .bearer_auth(&access.token).header("X-Novo-Device-Id", &access.device_id).json(&normalized)
        .send().await.map_err(|_| "connection_unavailable".to_string())?;
    if !response.status().is_success() { return Err(work_context_request_error(response.status().as_u16()).into()); }
    let payload = crate::novo_account::read_json(response, 65536).await.map_err(|error| error.code)?;
    ensure_account_epoch(shared.inner(), access.epoch)?;
    Ok(payload)
}

#[tauri::command]
pub async fn companion_work_context_clear(shared: State<'_, Shared>) -> Result<WorkContextClearResult, String> {
    let access = crate::novo_account::access_context(shared.inner()).await.map_err(|error| error.code)?;
    let response = crate::novo_account::client(15).map_err(|_| "work_context_unavailable".to_string())?
        .delete(format!("{}/api/companion/work-context", access.origin.trim_end_matches('/')))
        .bearer_auth(&access.token).header("X-Novo-Device-Id", &access.device_id)
        .send().await.map_err(|_| "connection_unavailable".to_string())?;
    if !response.status().is_success() { return Err(work_context_request_error(response.status().as_u16()).into()); }
    let payload = crate::novo_account::read_json(response, 65536).await.map_err(|error| error.code)?;
    ensure_account_epoch(shared.inner(), access.epoch)?;
    Ok(payload)
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeveloperContextResponse {
    #[serde(default)]
    pub github: serde_json::Value,
    #[serde(default)]
    pub vercel: serde_json::Value,
    #[serde(default)]
    pub error: Option<String>,
}

impl ActivityRecorder {
    pub fn load() -> Self {
        let path = event_path();
        let events = fs::read(&path)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<Vec<ActivityEvent>>(&bytes).ok())
            .unwrap_or_default();
        let mut recorder = Self { events, ..Self::default() };
        let _ = recorder.maintain_retention_at(&path, Utc::now());
        recorder
    }

    fn observe(&mut self, application_id: String, state: ActivityState, now: DateTime<Utc>) {
        self.prune(now);
        let same_segment = self.current.as_ref().is_some_and(|segment| {
            segment.application_id == application_id
                && segment.state == state
                && now - segment.started_at < MAX_SEGMENT
        });
        if same_segment {
            if let Some(segment) = self.current.as_mut() {
                segment.last_seen = now;
            }
            return;
        }

        self.close_current(now);
        self.current = Some(OpenSegment {
            id: Uuid::new_v4().to_string(),
            application_id,
            state,
            started_at: now,
            last_seen: now,
        });
    }

    fn close_current(&mut self, ended_at: DateTime<Utc>) {
        let Some(segment) = self.current.take() else { return };
        let end = ended_at.min(segment.last_seen + chrono::Duration::seconds(20));
        if end <= segment.started_at {
            return;
        }
        self.events.push(ActivityEvent {
            id: segment.id,
            application_id: segment.application_id,
            state: segment.state,
            started_at: segment.started_at,
            ended_at: end,
            synced: false,
        });
    }

    fn prune(&mut self, now: DateTime<Utc>) {
        self.events.retain(|event| event.ended_at >= now - RETENTION);
    }

    fn save(&self) -> Result<(), String> {
        let dir = settings::local_dir();
        platform::ensure_private_dir(&dir).map_err(|_| "local_store_unavailable".to_string())?;
        write_activity_events(&event_path(), &self.events)
    }

    fn maintain_retention_at(&mut self, path: &std::path::Path, now: DateTime<Utc>) -> Result<(), String> {
        let retained:Vec<_>=self.events.iter().filter(|event|event.ended_at>=now-RETENTION).cloned().collect();
        if retained.len()!=self.events.len() {
            write_activity_events(path,&retained)?;
            self.events=retained;
        }
        // Reuse status/sample calls, not a new polling loop or animation tick.
        // Archive IO is due at its earliest expiry (or once per hour when empty).
        if self.next_archive_check.is_some_and(|due|now<due && due-now<=chrono::Duration::hours(1)) {return Ok(());}
        let archive=path.with_file_name("activity-quarantine.json");
        let events:Vec<ActivityEvent>=match fs::read(&archive) {
            Ok(bytes)=>serde_json::from_slice(&bytes).map_err(|_|"local_store_unavailable".to_string())?,
            Err(error) if error.kind()==std::io::ErrorKind::NotFound=>Vec::new(),
            Err(_)=>return Err("local_store_unavailable".into()),
        };
        let retained:Vec<_>=events.iter().filter(|event|event.ended_at>=now-RETENTION).cloned().collect();
        if retained.len()!=events.len() {write_activity_events(&archive,&retained)?;}
        self.next_archive_check=Some(retained.iter().map(|event|event.ended_at+RETENTION+chrono::Duration::milliseconds(1)).min().unwrap_or(now+chrono::Duration::hours(1)).min(now+chrono::Duration::hours(1)));
        Ok(())
    }

    fn today_summary(&self, now: DateTime<Utc>) -> (u64, BTreeMap<String, u64>) {
        let day_start = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();
        let mut apps = BTreeMap::new();
        for event in self.events.iter().filter(|event| event.state == ActivityState::Active) {
            let start = event.started_at.max(day_start);
            let end = event.ended_at.min(now);
            if end <= start { continue }
            *apps.entry(event.application_id.clone()).or_insert(0) += (end - start).num_seconds() as u64;
        }
        let total = apps.values().copied().sum::<u64>() / 60;
        let apps = apps.into_iter().map(|(app, seconds)| (app, seconds / 60)).collect();
        (total, apps)
    }

    fn pending_daily_summaries(&self) -> Vec<ActivityDailySummary> {
        let mut grouped: BTreeMap<(String, String, String), (u64, bool)> = BTreeMap::new();
        for event in &self.events {
            for (day, seconds) in split_event_by_utc_day(event) {
                let key = (day, event.application_id.clone(), event.state.as_str().to_string());
                let entry = grouped.entry(key).or_default();
                entry.0 = (entry.0 + seconds).min(86_400);
                entry.1 |= !event.synced;
            }
        }

        grouped.into_iter().filter_map(|((day, application_id, state), (duration_seconds, pending))| {
            if !pending || duration_seconds == 0 { return None; }
            let state = match state.as_str() {
                "active" => ActivityState::Active,
                "idle" => ActivityState::Idle,
                "locked" => ActivityState::Locked,
                _ => return None,
            };
            Some(ActivityDailySummary { day, application_id, state, duration_seconds })
        }).collect()
    }

    fn mark_daily_summaries_synced(&mut self, summaries: &[ActivityDailySummary]) {
        let included: std::collections::HashSet<(String, String, String)> = summaries.iter()
            .map(|summary| (summary.day.clone(), summary.application_id.clone(), summary.state.as_str().to_string()))
            .collect();
        for event in self.events.iter_mut().filter(|event| !event.synced) {
            let keys = split_event_by_utc_day(event).into_iter()
                .map(|(day, _)| (day, event.application_id.clone(), event.state.as_str().to_string()))
                .collect::<Vec<_>>();
            if !keys.is_empty() && keys.iter().all(|key| included.contains(key)) {
                event.synced = true;
            }
        }
    }
}

fn split_event_by_utc_day(event: &ActivityEvent) -> Vec<(String, u64)> {
    let mut result = Vec::new();
    let mut cursor = event.started_at;
    while cursor < event.ended_at {
        let day = cursor.date_naive();
        let next_day = day.succ_opt().unwrap_or(day).and_hms_opt(0, 0, 0).unwrap().and_utc();
        let boundary = event.ended_at.min(next_day);
        let seconds = (boundary - cursor).num_seconds().max(0) as u64;
        if seconds > 0 { result.push((day.format("%Y-%m-%d").to_string(), seconds)); }
        cursor = boundary;
    }
    result
}

fn recorder<'a>(state: &'a State<Shared>) -> MutexGuard<'a, ActivityRecorder> {
    state.activity.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

async fn activity_history_guard(shared: &Shared) -> tokio::sync::MutexGuard<'_, ()> {
    shared.activity_history_lock.lock().await
}

fn event_path() -> std::path::PathBuf {
    settings::local_dir().join("activity.json")
}

fn clear_local_history(recorder: &mut ActivityRecorder, path: &std::path::Path) -> Result<(), String> {
    let temporary_path = path.with_extension("json.tmp");
    for target in [path, temporary_path.as_path()] {
        match fs::remove_file(target) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err("local_store_unavailable".into()),
        }
    }
    recorder.events.clear();
    recorder.current = None;
    Ok(())
}

fn quarantine_history(recorder:&mut ActivityRecorder,path:&std::path::Path)->Result<(),String>{
    recorder.close_current(Utc::now());
    recorder.prune(Utc::now());
    let target=path.with_file_name("activity-quarantine.json");
    let mut previous:Vec<ActivityEvent>=match fs::read(&target){
        Ok(bytes)=>serde_json::from_slice(&bytes).map_err(|_|"local_store_unavailable".to_string())?,
        Err(error) if error.kind()==std::io::ErrorKind::NotFound=>vec![],
        Err(_)=>return Err("local_store_unavailable".into()),
    };
    previous.extend(recorder.events.iter().cloned());
    let mut by_id=BTreeMap::new();
    for event in previous {if event.ended_at>=Utc::now()-RETENTION {by_id.insert(event.id.clone(),event);}}
    let temporary=target.with_extension("json.tmp");
    fs::write(&temporary,serde_json::to_vec(&by_id.into_values().collect::<Vec<_>>()).map_err(|_|"local_store_unavailable".to_string())?).map_err(|_|"local_store_unavailable".to_string())?;
    fs::rename(&temporary,&target).map_err(|_|"local_store_unavailable".to_string())?;
    // The file is archived, never read by the synchronizer. Empty active file
    // is published before memory clears, so a restart cannot change its owner.
    let empty=path.with_extension("json.tmp");
    fs::write(&empty,b"[]").map_err(|_|"local_store_unavailable".to_string())?;
    fs::rename(empty,path).map_err(|_|"local_store_unavailable".to_string())?;
    recorder.events.clear();recorder.current=None;recorder.next_archive_check=None;
    Ok(())
}
fn write_activity_events(path:&std::path::Path,events:&[ActivityEvent])->Result<(),String>{
    let temporary=path.with_extension("json.tmp");
    let bytes=serde_json::to_vec(events).map_err(|_|"local_store_unavailable".to_string())?;
    fs::write(&temporary,bytes).map_err(|_|"local_store_unavailable".to_string())?;
    fs::rename(temporary,path).map_err(|_|"local_store_unavailable".to_string())
}
fn same_installation(a: &OAuthCredentials, b: &OAuthCredentials) -> bool {
    match (a.installation_id, b.installation_id) {
        (Some(a), Some(b)) => a == b,
        _ => a.client_id == b.client_id && a.refresh_token == b.refresh_token,
    }
}
fn replaced_credentials(previous: Option<OAuthCredentials>, installed: &OAuthCredentials, mut queue: Vec<OAuthCredentials>) -> Vec<OAuthCredentials> {
    if let Some(previous) = previous { queue.push(previous); }
    queue.retain(|credential| !same_installation(credential, installed));
    let mut distinct = Vec::new();
    for credential in queue {
        if !distinct.iter().any(|old| same_installation(old, &credential)) { distinct.push(credential); }
    }
    distinct
}
fn poll_delay(interval: u64, slow_down: bool, retry_after: Option<&str>, now: DateTime<Utc>) -> u64 {
    let interval = if slow_down { interval.saturating_add(5) } else { interval };
    let retry = retry_after.and_then(|value| value.parse::<u64>().ok().or_else(|| {
        DateTime::parse_from_rfc2822(value).ok().map(|date| {
            ((date.with_timezone(&Utc) - now).num_milliseconds().max(0) as u64 + 999) / 1000
        })
    })).unwrap_or(0);
    interval.max(retry).max(5).min(86400)
}
fn stop_local_account(settings: &mut settings::Settings, account: &mut crate::novo_account::AccountRuntime) {
    settings.companion_capture_enabled = false;
    settings.companion_capture_paused = false;
    settings.companion_revocation_pending = true;
    account.invalidate();
}
fn load_old_revocations()->Result<Vec<OAuthCredentials>,String>{match secrets::get(OAUTH_REVOCATIONS_KEY){Some(raw)=>serde_json::from_str(&raw).map_err(|_|"credential_store_unavailable".to_string()),None=>Ok(vec![])}}
fn save_old_revocations(values:&[OAuthCredentials])->Result<(),String>{let raw=serde_json::to_string(values).map_err(|_|"credential_store_unavailable".to_string())?;secrets::set(OAUTH_REVOCATIONS_KEY,&raw).map_err(|_|"credential_store_unavailable".to_string())}
pub(crate) fn old_revocation_pending()->bool{load_old_revocations().map(|v|!v.is_empty()).unwrap_or(true)}
pub(crate) fn staged_authorization_pending()->bool{secrets::present(OAUTH_STAGED_KEY)}

fn persist_settings(shared: &State<Shared>) -> Result<(), String> {
    let current = shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner).clone();
    settings::save(&current).map_err(|_| "settings_unavailable".to_string())
}

fn normalized_application(value: &str) -> Option<String> {
    let candidate = value.strip_suffix(".exe").or_else(|| value.strip_suffix(".EXE")).unwrap_or(value);
    if candidate.is_empty() || candidate.len() > 80 || !candidate.bytes().all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b)) {
        return None;
    }
    Some(candidate.to_ascii_lowercase())
}

pub(crate) fn validate_origin(value: &str) -> Result<String, String> {
    let parsed = reqwest::Url::parse(value.trim()).map_err(|_| "invalid_origin".to_string())?;
    if parsed.scheme() != "https"
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || !matches!(parsed.path(), "" | "/")
    {
        return Err("invalid_origin".into());
    }
    Ok(parsed.origin().ascii_serialization().trim_end_matches('/').to_string())
}

fn is_novo_personal_access_token(value:&str)->bool {
    value.strip_prefix("novo_mcp_").is_some_and(|secret| {
        secret.len() >= 32 && secret.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
    })
}

fn personal_token_origin_matches(stored_origin: Option<&str>, requested_origin: &str) -> bool {
    stored_origin == Some(requested_origin)
}

fn read_personal_access_token(raw: Option<String>) -> Option<StoredPersonalAccessToken> {
    let raw = raw?;
    let stored: StoredPersonalAccessToken = serde_json::from_str(&raw).ok()?;
    let safe_origin = validate_origin(&stored.api_origin).ok()?;
    if !is_novo_personal_access_token(&stored.token) || safe_origin != stored.api_origin {
        return None;
    }
    Some(stored)
}

pub(crate) fn validate_oauth_endpoint(origin: &str, value: &str) -> Result<String, String> {
    let parsed = reqwest::Url::parse(value).map_err(|_| "authorization_unavailable".to_string())?;
    if parsed.scheme() != "https"
        || parsed.origin().ascii_serialization() != origin
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.fragment().is_some()
    {
        return Err("authorization_unavailable".into());
    }
    Ok(parsed.to_string())
}

fn oauth_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "authorization_unavailable".to_string())
}

fn open_external_url(value: &str) -> bool {
    #[cfg(windows)]
    {
        use std::ffi::c_void;
        use std::os::windows::ffi::OsStrExt;

        #[link(name = "shell32")]
        extern "system" {
            fn ShellExecuteW(
                window: *mut c_void,
                operation: *const u16,
                file: *const u16,
                parameters: *const u16,
                directory: *const u16,
                show_command: i32,
            ) -> *mut c_void;
        }

        let operation: Vec<u16> = std::ffi::OsStr::new("open").encode_wide().chain(Some(0)).collect();
        let url: Vec<u16> = std::ffi::OsStr::new(value).encode_wide().chain(Some(0)).collect();
        let result = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(), operation.as_ptr(), url.as_ptr(),
                std::ptr::null(), std::ptr::null(), 1,
            )
        };
        return (result as isize) > 32;
    }

    #[cfg(target_os = "macos")]
    { return std::process::Command::new("open").arg(value).spawn().is_ok(); }

    #[cfg(target_os = "linux")]
    { return std::process::Command::new("xdg-open").arg(value).spawn().is_ok(); }

    #[allow(unreachable_code)]
    false
}

// Caller owns companion_auth_lock. The vault is re-read after taking it,
// so concurrent callers use a single rotated refresh token.
pub(crate) async fn oauth_access_token_locked(origin: &str) -> Result<String, String> {
    if let Some(raw) = secrets::get(OAUTH_CREDENTIALS_KEY) {
        let mut credentials: OAuthCredentials = serde_json::from_str(&raw)
            .map_err(|_| "credential_store_unavailable".to_string())?;
        let credential_origin = if credentials.api_origin.is_empty() {
            return Err("permission_required".into());
        } else { credentials.api_origin.clone() };
        if credential_origin != origin {return Err("permission_required".into());}
        validate_oauth_endpoint(origin, &credentials.token_endpoint)?;
        validate_oauth_endpoint(origin, &credentials.revocation_endpoint)?;
        if credentials.expires_at > Utc::now() + chrono::Duration::seconds(60) {
            return Ok(credentials.access_token);
        }

        let client = oauth_client()?;
        let response = client.post(&credentials.token_endpoint)
            .form(&[
                ("grant_type", "refresh_token"),
                ("refresh_token", credentials.refresh_token.as_str()),
                ("client_id", credentials.client_id.as_str()),
            ])
            .send().await.map_err(|_| "offline".to_string())?;
        if !response.status().is_success() {
            return Err(if response.status().is_server_error() || response.status().as_u16()==429 {"offline"} else {"expired"}.into());
        }
        let refreshed: OAuthTokenResponse = crate::novo_account::read_json(response, 65536).await.map_err(|_| "authorization_expired".to_string())?;
        if refreshed.access_token.is_empty() || refreshed.expires_in == 0 {
            return Err("authorization_expired".into());
        }
        credentials.access_token = refreshed.access_token;
        if refreshed.refresh_token.as_ref().is_some_and(|t|t.is_empty()){return Err("authorization_expired".into());}
        credentials.refresh_token = refreshed.refresh_token.unwrap_or(credentials.refresh_token);
        credentials.expires_at = Utc::now() + chrono::Duration::seconds(refreshed.expires_in.min(86400) as i64);
        let access_token = credentials.access_token.clone();
        let serialized = serde_json::to_string(&credentials).map_err(|_| "credential_store_unavailable".to_string())?;
        secrets::set(OAUTH_CREDENTIALS_KEY, &serialized).map_err(|_| "credential_store_unavailable".to_string())?;
        return Ok(access_token);
    }

    Err("demo".into())
}

async fn companion_access_token(shared: &Shared, origin:&str) -> Result<String,String> {
    crate::novo_account::serialized(&shared.companion_auth_lock, async {
        if shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner).companion_revocation_pending {return Err("revocation_pending".into());}
        companion_access_token_locked(origin).await
    }).await
}

// Caller owns companion_auth_lock. OAuth refresh remains unchanged; a Novo
// personal token is the other first-party credential supported by Companion.
pub(crate) async fn companion_access_token_locked(origin:&str) -> Result<String,String> {
    if secrets::present(OAUTH_CREDENTIALS_KEY) {oauth_access_token_locked(origin).await}
    else {
        let stored = read_personal_access_token(secrets::get(TOKEN_KEY))
            .ok_or_else(|| "permission_required".to_string())?;
        if !personal_token_origin_matches(Some(&stored.api_origin), origin) {
            return Err("permission_required".into());
        }
        Ok(stored.token)
    }
}

#[tauri::command]
pub async fn companion_status(shared: State<'_, Shared>) -> Result<CompanionStatus,String> {
    let _history_guard=activity_history_guard(&shared).await;
    let current = shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let now = Utc::now();
    let mut recorder = recorder(&shared);
    recorder.maintain_retention_at(&event_path(),now)?;
    let (active_minutes_today, app_minutes_today) = recorder.today_summary(now);
    Ok(CompanionStatus {
        device_id: current.companion_device_id.clone(),
        enabled: current.companion_capture_enabled,
        paused: current.companion_capture_paused,
        api_origin: current.companion_api_origin.clone(),
        token_present: secrets::present(OAUTH_CREDENTIALS_KEY)
            || read_personal_access_token(secrets::get(TOKEN_KEY)).is_some(),
        account_connected: shared.novo_account.lock().unwrap_or_else(std::sync::PoisonError::into_inner).status.state == crate::novo_account::AccountState::Connected,
        excluded_applications: current.companion_excluded_apps.clone(),
        active_minutes_today,
        app_minutes_today,
        queued_events: recorder.events.iter().filter(|event| !event.synced).count(),
    })
}

#[tauri::command]
pub fn companion_capture_set(shared: State<Shared>, enabled: bool) -> Result<(), String> {
    {
        let mut current = shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        current.companion_capture_enabled = enabled;
        if !enabled { current.companion_capture_paused = false; }
    }
    persist_settings(&shared)?;
    if !enabled {
        let mut recorder = recorder(&shared);
        recorder.close_current(Utc::now());
        recorder.prune(Utc::now());
        recorder.save()?;
    }
    Ok(())
}

#[tauri::command]
pub fn companion_pause_set(shared: State<Shared>, paused: bool) -> Result<(), String> {
    {
        let mut current = shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        current.companion_capture_paused = paused;
    }
    persist_settings(&shared)?;
    if paused {
        let mut recorder = recorder(&shared);
        recorder.close_current(Utc::now());
        recorder.save()?;
    }
    Ok(())
}

#[tauri::command]
pub fn companion_exclusions_set(shared: State<Shared>, applications: Vec<String>) -> Result<(), String> {
    if applications.len() > 50 { return Err("too_many_exclusions".into()) }
    let mut normalized: Vec<String> = applications.iter().filter_map(|value| normalized_application(value)).collect();
    normalized.sort();
    normalized.dedup();
    if !normalized.iter().any(|value| value == "novo-companion") {
        normalized.push("novo-companion".into());
    }
    shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner).companion_excluded_apps = normalized;
    persist_settings(&shared)
}

#[tauri::command]
pub async fn companion_history_clear(app: AppHandle, shared: State<'_, Shared>) -> Result<(), String> {
    let _history_guard = activity_history_guard(&shared).await;
    let quarantine=event_path().with_file_name("activity-quarantine.json");
    for path in [&quarantine,&quarantine.with_extension("json.tmp")] {match fs::remove_file(path){Ok(())=>{},Err(e) if e.kind()==std::io::ErrorKind::NotFound=>{},Err(_)=>return Err("local_store_unavailable".into())}}
    let mut recorder = recorder(&shared);
    clear_local_history(&mut recorder, &event_path())?;
    let _ = app.emit("companion-history-cleared", ());
    Ok(())
}

#[tauri::command]
pub async fn companion_connect(shared: State<'_, Shared>, origin: String, token: Option<String>) -> Result<(), String> {
    let _history_guard=activity_history_guard(&shared).await;
    let _auth_guard=shared.companion_auth_lock.lock().await;
    // Keep OAuth and manually pasted PAT credentials mutually exclusive; the
    // user must explicitly disconnect before changing credential type.
    if secrets::present(OAUTH_CREDENTIALS_KEY) {return Err("disconnect_account_first".into());}
    let safe_origin = validate_origin(&origin)?;
    let stored_raw = secrets::get(TOKEN_KEY);
    let stored = read_personal_access_token(stored_raw.clone());
    let supplied_token = token
        .as_ref()
        .filter(|value| !value.trim().is_empty())
        .cloned();
    if stored.as_ref().is_some_and(|value| {
        !personal_token_origin_matches(Some(&value.api_origin), &safe_origin)
    }) && supplied_token.is_none() {
        return Err("token_origin_mismatch".into());
    }
    let candidate = supplied_token
        .or_else(|| stored.as_ref().map(|value| value.token.clone()))
        .ok_or_else(|| "token_required".to_string())?;
    if !is_novo_personal_access_token(&candidate) {return Err("token_invalid_or_expired".into());}
    let device_id=shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner).companion_device_id.clone();
    let mut device_name=shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner).companion_device_name.trim().to_string();
    if device_name.is_empty() || device_name.chars().count()>80 || device_name.chars().any(char::is_control) {device_name="Novo PC".into();}
    let client = crate::novo_account::client(15).map_err(|_|"connection_unavailable".to_string())?;

    // Check account identity and permissions before registering the device.
    let preflight=client.get(format!("{safe_origin}/api/companion/authorization"))
        .bearer_auth(&candidate).header("X-Novo-Authorization-Preflight","1")
        .send().await.map_err(|_|"connection_unavailable".to_string())?;
    let authorization:crate::novo_account::CompanionAuthorization=crate::novo_account::read_json(preflight,65536).await.map_err(|error|error.code)?;
    authorization.validate_preflight().map_err(|error|error.code)?;

    let registration=client.post(format!("{safe_origin}/api/companion/devices"))
        .bearer_auth(&candidate).header("X-Novo-Device-Id",&device_id)
        .json(&serde_json::json!({"deviceId":device_id,"name":device_name,"platform":"windows","reconnect":true}))
        .send().await.map_err(|_|"connection_unavailable".to_string())?;
    let _:crate::novo_account::DeviceView=crate::novo_account::read_json(registration,65536).await.map_err(|error|error.code)?;

    // Trust only the server's final registry lookup, not the registration
    // response alone, before reporting the account as connected locally.
    let verified=client.get(format!("{safe_origin}/api/companion/authorization"))
        .bearer_auth(&candidate).header("X-Novo-Device-Id",&device_id)
        .send().await.map_err(|_|"connection_unavailable".to_string())?;
    let verified:crate::novo_account::CompanionAuthorization=crate::novo_account::read_json(verified,65536).await.map_err(|error|error.code)?;
    verified.validate(&device_id).map_err(|error|error.code)?;

    let credential_changed = stored.as_ref().map_or(true, |value| {
        value.token != candidate || value.api_origin != safe_origin
    });
    if credential_changed {
        quarantine_history(&mut recorder(&shared),&event_path())?;
        let credential = serde_json::to_string(&StoredPersonalAccessToken {
            token: candidate.clone(),
            api_origin: safe_origin.clone(),
        })
        .map_err(|_| "credential_store_unavailable".to_string())?;
        secrets::set(TOKEN_KEY, &credential).map_err(|_| "credential_store_unavailable".to_string())?;
    }
    let old_settings=shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner).clone();
    {
        let mut current = shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        current.companion_api_origin = safe_origin;
        current.companion_device_name = device_name;
        current.companion_revocation_pending = false;
        current.companion_capture_enabled = false;
        current.companion_capture_paused = false;
    }
    if let Err(error)=persist_settings(&shared) {
        *shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner)=old_settings;
        match stored_raw.as_deref() {
            Some(previous) => {
                let _ = secrets::set(TOKEN_KEY, previous);
            }
            None => {
                let _ = secrets::clear(TOKEN_KEY);
            }
        }
        return Err(error);
    }
    let mut runtime=shared.novo_account.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    runtime.invalidate();
    runtime.status=crate::novo_account::NativeAccountStatus {
        state:crate::novo_account::AccountState::Connected,
        authorization:Some(verified),
        last_verified_at:Some(Utc::now()),
        revocation_pending:false,
    };
    Ok(())
}

#[tauri::command]
pub async fn companion_authorization_start(
    shared: State<'_, Shared>,
    origin: String,
    reconnect: Option<bool>,
    device_name: Option<String>,
) -> Result<DeviceAuthorizationPrompt, String> {
    let _auth_guard = shared.companion_auth_lock.lock().await;
    if staged_authorization_pending(){return Err("authorization_pending".into());}
    if load_old_revocations()?.len()>=4{return Err("revocation_pending".into());}
    let reconnect = reconnect.unwrap_or(false);
    if secrets::present(OAUTH_CREDENTIALS_KEY) && !reconnect {
        return Err("already_connected".into());
    }
    let name = device_name.unwrap_or_else(|| shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner).companion_device_name.clone());
    let name = name.trim().to_string();
    if name.is_empty() || name.chars().count()>80 || name.chars().any(char::is_control) {return Err("invalid_device_name".into());}
    let safe_origin = validate_origin(&origin)?;
    let client = oauth_client()?;
    let metadata_response = client.get(format!("{safe_origin}/.well-known/oauth-authorization-server"))
        .send().await.map_err(|_| "authorization_unavailable".to_string())?
        .error_for_status().map_err(|_| "authorization_unavailable".to_string())?;
    let mime = metadata_response.headers().get("content-type").and_then(|v|v.to_str().ok()).unwrap_or("").to_string();
    let metadata_bytes = crate::net::read_capped(metadata_response,65536).await.map_err(|_|"authorization_unavailable".to_string())?;
    let metadata = crate::novo_account::validate_metadata(&safe_origin,&mime,&metadata_bytes).map_err(|_|"authorization_unavailable".to_string())?;
    let registration_endpoint = validate_oauth_endpoint(&safe_origin, &metadata.registration_endpoint)?;
    let device_endpoint = validate_oauth_endpoint(&safe_origin, &metadata.device_authorization_endpoint)?;
    let token_endpoint = validate_oauth_endpoint(&safe_origin, &metadata.token_endpoint)?;
    let revocation_endpoint = validate_oauth_endpoint(&safe_origin, &metadata.revocation_endpoint)?;

    let saved_origin = secrets::get(OAUTH_CLIENT_ORIGIN_KEY);
    let client_id = if saved_origin.as_deref() == Some(safe_origin.as_str()) && secrets::get(OAUTH_CLIENT_SCOPES_KEY).as_deref()==Some(COMPANION_OAUTH_SCOPES) {
        secrets::get(OAUTH_CLIENT_ID_KEY)
    } else {
        None
    };
    let client_id = if let Some(existing) = client_id {
        existing
    } else {
        let registration = client.post(registration_endpoint)
            .json(&serde_json::json!({
                "client_name": "Novo Companion",
                "grant_types": [DEVICE_CODE_GRANT, "refresh_token"],
                "response_types": [],
                "redirect_uris": [],
                "token_endpoint_auth_method": "none",
                "scope": COMPANION_OAUTH_SCOPES,
            }))
            .send().await.map_err(|_| "authorization_unavailable".to_string())?;
        if !registration.status().is_success() {
            return Err("authorization_unavailable".into());
        }
        let registered: OAuthClientRegistration = crate::novo_account::read_json(registration,65536).await.map_err(|_| "authorization_unavailable".to_string())?;
        if registered.client_id.trim().is_empty() || registered.client_id.len() > 256 {
            return Err("authorization_unavailable".into());
        }
        secrets::set(OAUTH_CLIENT_ID_KEY, &registered.client_id).map_err(|_| "credential_store_unavailable".to_string())?;
        secrets::set(OAUTH_CLIENT_ORIGIN_KEY, &safe_origin).map_err(|_| "credential_store_unavailable".to_string())?;
        secrets::set(OAUTH_CLIENT_SCOPES_KEY, COMPANION_OAUTH_SCOPES).map_err(|_| "credential_store_unavailable".to_string())?;
        registered.client_id
    };

    let resource = format!("{safe_origin}/api/mcp");
    let device_response = client.post(device_endpoint)
        .form(&[
            ("client_id", client_id.as_str()),
            ("scope", COMPANION_OAUTH_SCOPES),
            ("resource", resource.as_str()),
        ])
        .send().await.map_err(|_| "authorization_unavailable".to_string())?;
    if !device_response.status().is_success() {
        return Err("authorization_unavailable".into());
    }
    let response: DeviceAuthorizationResponse = crate::novo_account::read_json(device_response,65536).await.map_err(|_| "authorization_unavailable".to_string())?;
    if response.device_code.is_empty() || response.device_code.len()>4096 || response.user_code.is_empty() || response.user_code.len()>100 || response.expires_in == 0 {
        return Err("authorization_unavailable".into());
    }
    let verification_uri = response.verification_uri_complete.as_deref().unwrap_or(&response.verification_uri);
    let verification_uri = validate_oauth_endpoint(&safe_origin, verification_uri)?;
    let interval_seconds = response.interval.unwrap_or(5).max(5);
    if interval_seconds > 86400 { return Err("authorization_unavailable".into()); }
    let expires_at = Utc::now() + chrono::Duration::seconds(response.expires_in.min(600) as i64);

    let mut pending = shared.pending_companion_authorization.lock().await;
    let attempt={let mut account=shared.novo_account.lock().unwrap_or_else(std::sync::PoisonError::into_inner);account.authorization_attempt=account.authorization_attempt.wrapping_add(1);account.authorization_attempt};
    *pending = Some(PendingDeviceAuthorization {
        api_origin: safe_origin,
        client_id,
        device_code: response.device_code,
        token_endpoint,
        revocation_endpoint,
        device_name: name,
        reconnect,
        attempt,
        expires_at,
        interval_seconds,
        next_poll_at: Utc::now(),
        candidate: None,
    });
    drop(pending);

    Ok(DeviceAuthorizationPrompt {
        opened_in_browser: open_external_url(&verification_uri),
        verification_uri,
        user_code: response.user_code,
        interval_seconds,
        expires_at,
    })
}

#[tauri::command]
pub async fn companion_authorization_poll(app:AppHandle,shared: State<'_, Shared>) -> Result<DeviceAuthorizationPoll, String> {
    let _history_guard=activity_history_guard(&shared).await;
    let _auth_guard=shared.companion_auth_lock.lock().await;
    let mut pending = match shared.pending_companion_authorization.lock().await.take(){
        Some(pending)=>pending,
        None=>match secrets::get(OAUTH_STAGED_KEY){Some(raw)=>serde_json::from_str(&raw).map_err(|_|"credential_store_unavailable".to_string())?,None=>return Err("authorization_not_pending".into())},
    };
    {
        let mut account=shared.novo_account.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        if account.authorization_attempt==0 {account.authorization_attempt=pending.attempt;}
    }
    // Credential replacement may have succeeded before cleanup was interrupted.
    // Complete local settings/cleanup without re-exchanging or revoking that grant.
    let already_installed = pending.candidate.as_ref().is_some_and(|candidate| {
        secrets::get(OAUTH_CREDENTIALS_KEY).and_then(|raw| serde_json::from_str::<OAuthCredentials>(&raw).ok()).is_some_and(|active| same_installation(&active,candidate))
    });
    if already_installed {
        {
            let mut current=shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
            if current.companion_revocation_pending { return Err("revocation_pending".into()); }
            current.companion_api_origin=pending.api_origin.clone();
            current.companion_device_name=pending.device_name.clone();
            current.companion_capture_enabled=false;
            current.companion_capture_paused=false;
        }
        persist_settings(&shared)?;
        secrets::clear(OAUTH_STAGED_KEY).map_err(|_|"credential_store_unavailable".to_string())?;
        shared.novo_account.lock().unwrap_or_else(std::sync::PoisonError::into_inner).invalidate();
        let _=app.emit("novo-account-changed",());
        return Ok(DeviceAuthorizationPoll { state:"authorized", interval_seconds:pending.interval_seconds });
    }
    if Utc::now() >= pending.expires_at {
        if let Some(candidate)=pending.candidate.as_ref(){if revoke_oauth_credentials(candidate).await.is_err(){return Err("revocation_pending".into());}}
        let _=secrets::clear(OAUTH_STAGED_KEY);
        return Err("authorization_expired".into());
    }
    if Utc::now() < pending.next_poll_at {
        let interval_seconds = pending.interval_seconds;
        *shared.pending_companion_authorization.lock().await = Some(pending);
        return Ok(DeviceAuthorizationPoll { state: "pending", interval_seconds });
    }

    let client = oauth_client()?;
    let credentials=if let Some(candidate)=pending.candidate.clone(){candidate}else{
    let response = client.post(&pending.token_endpoint)
        .form(&[
            ("grant_type", DEVICE_CODE_GRANT),
            ("device_code", pending.device_code.as_str()),
            ("client_id", pending.client_id.as_str()),
        ])
        .send().await.map_err(|_| {
            // Keep the pending state so a temporary network outage can be retried.
            "authorization_unavailable".to_string()
        });
    let response = match response {
        Ok(response) => response,
        Err(error) => {
            pending.next_poll_at = Utc::now() + chrono::Duration::seconds(pending.interval_seconds as i64);
            *shared.pending_companion_authorization.lock().await = Some(pending);
            return Err(error);
        }
    };

    if !response.status().is_success() {
        let status = response.status();
        let retry_after=poll_delay(pending.interval_seconds,false,response.headers().get("retry-after").and_then(|v|v.to_str().ok()),Utc::now());
        let error = crate::net::read_capped(response,65536).await.ok().and_then(|b|serde_json::from_slice::<OAuthErrorResponse>(&b).ok()).map(|body| body.error).unwrap_or_default();
        if error == "authorization_pending" || error == "slow_down" {
            pending.interval_seconds=poll_delay(pending.interval_seconds,error=="slow_down",None,Utc::now());
            pending.next_poll_at = Utc::now() + chrono::Duration::seconds(pending.interval_seconds as i64);
            let interval_seconds = pending.interval_seconds;
            *shared.pending_companion_authorization.lock().await = Some(pending);
            return Ok(DeviceAuthorizationPoll { state: "pending", interval_seconds });
        }
        if status.is_server_error() || status.as_u16() == 429 {
            pending.next_poll_at = Utc::now() + chrono::Duration::seconds(retry_after as i64);
            let interval_seconds = retry_after;
            *shared.pending_companion_authorization.lock().await = Some(pending);
            return Ok(DeviceAuthorizationPoll { state: "pending", interval_seconds });
        }
        if !matches!(error.as_str(), "access_denied" | "expired_token" | "invalid_grant") {
            pending.next_poll_at = Utc::now() + chrono::Duration::seconds(pending.interval_seconds as i64);
            *shared.pending_companion_authorization.lock().await = Some(pending);
            return Err("authorization_unavailable".into());
        }
        return Err(if error == "access_denied" { "authorization_denied" } else { "authorization_expired" }.into());
    }

    let token: OAuthTokenResponse = crate::novo_account::read_json(response,65536).await.map_err(|_| "authorization_unavailable".to_string())?;
    let refresh_token = token.refresh_token.ok_or_else(|| "authorization_unavailable".to_string())?;
    if token.access_token.is_empty() || refresh_token.is_empty() || token.expires_in == 0 {
        return Err("authorization_unavailable".into());
    }
    let credentials = OAuthCredentials {
        installation_id: Some(Uuid::new_v4()),
        access_token: token.access_token,
        refresh_token,
        client_id: pending.client_id.clone(),
        token_endpoint: pending.token_endpoint.clone(),
        revocation_endpoint: pending.revocation_endpoint.clone(),
        expires_at: Utc::now() + chrono::Duration::seconds(token.expires_in.min(86400) as i64),
        api_origin: pending.api_origin.clone(),
    };
    pending.candidate=Some(credentials.clone());
    let staged=serde_json::to_string(&pending).map_err(|_|"credential_store_unavailable".to_string())?;
    if secrets::set(OAUTH_STAGED_KEY,&staged).is_err(){let _=revoke_oauth_credentials(&credentials).await;return Err("credential_store_unavailable".into());}
    credentials
    };
    let device_id=shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner).companion_device_id.clone();
    let verification=async {
        // Verify candidate owner and capabilities BEFORE the registry switches
        // the grant. The final registry acknowledgment itself is authoritative;
        // no fallible second network call can discard an already-bound grant.
        let preflight_response=client.get(format!("{}/api/companion/authorization",pending.api_origin)).bearer_auth(&credentials.access_token).header("X-Novo-Authorization-Preflight","1").send().await.map_err(|_|crate::novo_account::SafeError::new("offline"))?;
        let mut authorization:crate::novo_account::CompanionAuthorization=crate::novo_account::read_json(preflight_response,65536).await?;
        if authorization.version!=1 || authorization.user.id.is_empty() || authorization.user.id.len()>200 || authorization.device.is_some() || !authorization.capabilities.device_connect || !authorization.capabilities.ai_chat {return Err(crate::novo_account::SafeError::new("permission_required"));}
        if shared.novo_account.lock().unwrap_or_else(std::sync::PoisonError::into_inner).authorization_attempt!=pending.attempt {return Err(crate::novo_account::SafeError::new("cancelled"));}
        let registration=client.post(format!("{}/api/companion/devices",pending.api_origin)).bearer_auth(&credentials.access_token).header("X-Novo-Device-Id",&device_id)
            .json(&serde_json::json!({"deviceId":device_id,"name":pending.device_name,"platform":"windows","reconnect":pending.reconnect})).send().await.map_err(|_|crate::novo_account::SafeError::new("offline"))?;
        let device:crate::novo_account::DeviceView=crate::novo_account::read_json(registration,65536).await?;
        if device.id!=device_id || device.revoked_at.is_some(){return Err(crate::novo_account::SafeError::new("revoked"));}
        authorization.device=Some(device);
        authorization.state="connected".into();
        authorization.validate(&device_id)?;
        Ok(authorization)
    };
    let verified=match crate::novo_account::verify_before_commit(verification,||Ok(())).await {
        Ok(authorization)=>authorization,
        Err(error)=>{
            // A lost registry response is uncertain, not a denial. Preserve
            // the candidate in Credential Manager and retry this idempotent
            // binding, never exchange a consumed device code or destroy the
            // potentially active grant automatically.
            if matches!(error.code.as_str(),"offline"|"unavailable"){
                pending.next_poll_at=Utc::now()+chrono::Duration::seconds(pending.interval_seconds as i64);
                *shared.pending_companion_authorization.lock().await=Some(pending);
                return Err("authorization_unavailable".into());
            }
            let _=revoke_oauth_credentials(&credentials).await;
            let _=secrets::clear(OAUTH_STAGED_KEY);
            return Err(error.code);
        }
    };
    if shared.novo_account.lock().unwrap_or_else(std::sync::PoisonError::into_inner).authorization_attempt!=pending.attempt {
        let _ = revoke_oauth_credentials(&credentials).await;
        return Err("authorization_cancelled".into());
    }
    let previous=secrets::get(OAUTH_CREDENTIALS_KEY);
    // Archive pending observations locally before replacing any account; a new
    // grant never inherits unsent history, including a legacy unbound install.
    quarantine_history(&mut recorder(&shared),&event_path())?;
    let previous_credential=previous.as_ref().map(|raw|serde_json::from_str::<OAuthCredentials>(raw).map_err(|_|"credential_store_unavailable".to_string())).transpose()?;
    let revocations=replaced_credentials(previous_credential,&credentials,load_old_revocations()?);
    if revocations.len()>4{return Err("revocation_pending".into());}
    let old_settings=shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner).clone();
    let serialized=serde_json::to_string(&credentials).map_err(|_|"credential_store_unavailable".to_string())?;
    let previous_revocations=load_old_revocations()?;
    save_old_revocations(&revocations)?;
    shared.novo_account.lock().unwrap_or_else(std::sync::PoisonError::into_inner).invalidate();
    if secrets::set(OAUTH_CREDENTIALS_KEY,&serialized).is_err(){let _=save_old_revocations(&previous_revocations);return Err("credential_store_unavailable".into());}
    {
        let mut current=shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        current.companion_api_origin=pending.api_origin;
        current.companion_device_name=pending.device_name;
        current.companion_revocation_pending=false;
        current.companion_capture_enabled=false;
        current.companion_capture_paused=false;
    }
    if persist_settings(&shared).is_err(){
        if let Some(raw)=previous {let _=secrets::set(OAUTH_CREDENTIALS_KEY,&raw);} else {let _=secrets::clear(OAUTH_CREDENTIALS_KEY);}
        *shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner)=old_settings;
        let _=save_old_revocations(&previous_revocations);
        let _=revoke_oauth_credentials(&credentials).await;
        return Err("settings_save_failed".into());
    }
    // Local PAT is not sent or remotely revoked; retained as advanced legacy
    // compatibility, but it cannot grant Novo account/chat access.
    {
        let mut account=shared.novo_account.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        account.invalidate();
        account.status=crate::novo_account::NativeAccountStatus{state:crate::novo_account::AccountState::Connected,authorization:Some(verified),last_verified_at:Some(Utc::now()),revocation_pending:!revocations.is_empty()};
    }
    let _=app.emit("novo-account-changed",());
    let mut remaining=vec![];
    for old in revocations {if revoke_oauth_credentials(&old).await.is_err(){remaining.push(old);}}
    save_old_revocations(&remaining)?;
    secrets::clear(OAUTH_STAGED_KEY).map_err(|_|"credential_store_unavailable".to_string())?;
    Ok(DeviceAuthorizationPoll { state: "authorized", interval_seconds: pending.interval_seconds })
}

#[tauri::command]
pub async fn companion_authorization_cancel(shared: State<'_, Shared>) -> Result<(), String> {
    let pending=shared.pending_companion_authorization.lock().await.take();
    {
        let mut account=shared.novo_account.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        account.authorization_attempt=account.authorization_attempt.wrapping_add(1);
    }
    let _auth_guard=shared.companion_auth_lock.lock().await;
    let staged=match pending {Some(pending)=>Some(pending),None=>secrets::get(OAUTH_STAGED_KEY).and_then(|s|serde_json::from_str::<PendingDeviceAuthorization>(&s).ok())};
    if let Some(candidate)=staged.and_then(|pending|pending.candidate){
        if revoke_oauth_credentials(&candidate).await.is_err(){let mut queue=load_old_revocations()?;queue.push(candidate);save_old_revocations(&queue)?;}
    }
    secrets::clear(OAUTH_STAGED_KEY).map_err(|_|"credential_store_unavailable".to_string())?;
    Ok(())
}

async fn revoke_oauth_credentials(credentials: &OAuthCredentials) -> Result<(), String> {
    let origin=if credentials.api_origin.is_empty(){reqwest::Url::parse(&credentials.revocation_endpoint).map_err(|_|"revocation_unavailable".to_string())?.origin().ascii_serialization()}else{credentials.api_origin.clone()};
    validate_oauth_endpoint(&origin,&credentials.revocation_endpoint)?;
    let client = oauth_client()?;
    let response = client.post(&credentials.revocation_endpoint)
        .form(&[
            ("token", credentials.refresh_token.as_str()),
            ("token_type_hint", "refresh_token"),
            ("client_id", credentials.client_id.as_str()),
        ])
        .send().await.map_err(|_| "revocation_unavailable".to_string())?;
    if !response.status().is_success() {
        return Err("revocation_unavailable".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn companion_disconnect(app:AppHandle,shared: State<'_, Shared>) -> Result<String, String> {
    // Stop local observation first, even if the network is unavailable. Keep
    // the credential until the server confirms revocation so the UI never
    // reports a remotely revoked session when it could not reach Novo.
    {
        let mut current = shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        let mut account=shared.novo_account.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        stop_local_account(&mut current,&mut account);
    }
    persist_settings(&shared)?;
    let _=app.emit("novo-account-changed",());
    companion_authorization_cancel(shared.clone()).await?;
    let _history_guard=activity_history_guard(&shared).await;
    let _auth_guard=shared.companion_auth_lock.lock().await;
    {
        let mut recorder = recorder(&shared);
        recorder.close_current(Utc::now());
        recorder.save()?;
    }

    let result = if let Some(raw) = secrets::get(OAUTH_CREDENTIALS_KEY) {
        let credentials: OAuthCredentials = serde_json::from_str(&raw)
            .map_err(|_| "credential_store_unavailable".to_string())?;
        if revoke_oauth_credentials(&credentials).await.is_err(){return Ok("revocation_pending".into());}
        secrets::clear(OAUTH_CREDENTIALS_KEY).map_err(|_| "credential_store_unavailable".to_string())?;
        "oauth_revoked"
    } else {
        "token_removed"
    };
    secrets::clear(TOKEN_KEY).map_err(|_| "credential_store_unavailable".to_string())?;
    let mut remaining=vec![];
    for old in load_old_revocations()? {if revoke_oauth_credentials(&old).await.is_err(){remaining.push(old);}}
    save_old_revocations(&remaining)?;
    if !remaining.is_empty(){return Ok("revocation_pending".into());}
    {
        let mut current=shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        current.companion_revocation_pending=false;
        current.companion_api_origin.clear();
    }
    persist_settings(&shared)?;
    Ok(result.into())
}

#[tauri::command]
pub async fn companion_sample(shared: State<'_, Shared>) -> Result<Option<ActivitySnapshot>, String> {
    let _history_guard = activity_history_guard(&shared).await;
    recorder(&shared).maintain_retention_at(&event_path(),Utc::now())?;
    let (enabled, paused, excluded) = {
        let current = shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        (current.companion_capture_enabled && !current.companion_revocation_pending, current.companion_capture_paused, current.companion_excluded_apps.clone())
    };
    if !enabled || paused { return Ok(None) }
    let Some((reported_app, idle_seconds, locked)) = platform::foreground_activity() else { return Ok(None) };
    let app = if locked { "system.locked".to_string() } else if idle_seconds >= IDLE_AFTER_SECONDS { "system.idle".to_string() } else if let Some(app) = normalized_application(&reported_app) { app } else { return Ok(None) };
    if excluded.iter().filter_map(|value| normalized_application(value)).any(|excluded| excluded == app) {
        return Ok(None);
    }
    let state = if locked { ActivityState::Locked } else if idle_seconds >= IDLE_AFTER_SECONDS { ActivityState::Idle } else { ActivityState::Active };
    let now = Utc::now();
    let mut recorder = recorder(&shared);
    recorder.observe(app.clone(), state.clone(), now);
    recorder.prune(now);
    let _ = recorder.save();
    Ok(Some(ActivitySnapshot { application_id: app, state, idle_seconds }))
}

#[tauri::command]
pub async fn companion_sync(shared: State<'_, Shared>) -> Result<SyncResponse, String> {
    let _history_guard = activity_history_guard(&shared).await;
    recorder(&shared).maintain_retention_at(&event_path(),Utc::now())?;
    let (origin, device_id) = {
        let current = shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        (current.companion_api_origin.clone(), current.companion_device_id.clone())
    };
    if origin.is_empty() { return Err("connection_unavailable".into()) }
    let origin=validate_origin(&origin)?;
    let token = companion_access_token(&shared,&origin).await?;
    let summaries = {
        let mut recorder = recorder(&shared);
        recorder.prune(Utc::now());
        recorder.save()?;
        recorder.pending_daily_summaries().into_iter().take(MAX_EVENTS_PER_SYNC).collect::<Vec<_>>()
    };
    if summaries.is_empty() { return Ok(SyncResponse { accepted: 0, skipped: 0 }) }
    let client = crate::novo_account::client(15).map_err(|_|"connection_unavailable".to_string())?;
    let response = client.post(format!("{}/api/companion/activity", origin.trim_end_matches('/')))
        .bearer_auth(token)
        .header("X-Novo-Device-Id",&device_id)
        .json(&serde_json::json!({ "deviceId": device_id, "summaries": summaries }))
        .send().await.map_err(|_| "connection_unavailable".to_string())?;
    if !response.status().is_success() { return Err(if response.status().as_u16() == 403 { "activity_permission_required" } else { "sync_unavailable" }.into()) }
    let result: SyncResponse = crate::novo_account::read_json(response,65536).await.map_err(|_| "sync_unavailable".to_string())?;
    let mut recorder = recorder(&shared);
    recorder.mark_daily_summaries_synced(&summaries);
    recorder.save()?;
    Ok(result)
}

#[tauri::command]
pub async fn companion_context(shared: State<'_, Shared>) -> Result<Vec<ContextSignal>, String> {
    let _history_guard=activity_history_guard(&shared).await;
    let origin = {
        let current = shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        current.companion_api_origin.clone()
    };
    let origin=validate_origin(&origin)?;
    let token = companion_access_token(&shared,&origin).await?;
    let device_id=shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner).companion_device_id.clone();
    let client = oauth_client()?;
    let response = client.get(format!("{}/api/companion/activity", origin.trim_end_matches('/'))).bearer_auth(token).header("X-Novo-Device-Id",&device_id).send().await.map_err(|_| "connection_unavailable".to_string())?;
    if !response.status().is_success() { return Err("context_unavailable".into()) }
    let payload: ContextResponse = crate::novo_account::read_json(response,1024*1024).await.map_err(|_| "context_unavailable".to_string())?;
    Ok(payload.signals)
}

#[tauri::command]
pub async fn companion_developer_context(shared: State<'_, Shared>) -> Result<DeveloperContextResponse, String> {
    let _history_guard=activity_history_guard(&shared).await;
    let origin = {
        let current = shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        current.companion_api_origin.clone()
    };
    let origin=validate_origin(&origin)?;
    let token = companion_access_token(&shared,&origin).await?;
    let device_id=shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner).companion_device_id.clone();
    let client = crate::novo_account::client(15).map_err(|_|"connection_unavailable".to_string())?;
    let response = client.get(format!("{}/api/companion/developer-context", origin.trim_end_matches('/')))
        .bearer_auth(token)
        .header("X-Novo-Device-Id",&device_id)
        .send().await.map_err(|_| "connection_unavailable".to_string())?;
    if !response.status().is_success() {
        return Err(match response.status().as_u16() {
            401 => "token_or_read_permission_invalid",
            403 => "integration_read_permission_required",
            429 => "provider_rate_limited",
            _ => "developer_context_unavailable",
        }.into());
    }
    crate::novo_account::read_json::<DeveloperContextResponse>(response,1024*1024).await.map_err(|_| "developer_context_unavailable".into())
}

#[cfg(test)]
mod tests {
    use super::{
        activity_history_guard, clear_local_history, is_novo_personal_access_token,
        personal_token_origin_matches, read_personal_access_token,
        normalized_application, validate_origin,
        ActivityEvent, ActivityRecorder, ActivityState, OpenSegment, SyncResponse,
    };
    use chrono::{Duration, Utc};
    use crate::{island::PollGate, settings::Settings, Shared};
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    };
    use uuid::Uuid;

    #[test]
    fn personal_token_input_accepts_only_novo_url_safe_pat_secrets() {
        assert!(is_novo_personal_access_token(&format!("novo_mcp_{}", "A".repeat(43))));
        assert!(!is_novo_personal_access_token("oauth-access-token-that-is-long-enough"));
        assert!(!is_novo_personal_access_token("novo_mcp_short"));
        assert!(!is_novo_personal_access_token(&format!("novo_mcp_{}!", "A".repeat(43))));
    }

    #[test]
    fn personal_token_is_bound_to_the_origin_that_validated_it() {
        assert!(personal_token_origin_matches(
            Some("https://novo.example"),
            "https://novo.example"
        ));
        assert!(!personal_token_origin_matches(None, "https://novo.example"));
        assert!(!personal_token_origin_matches(
            Some("https://novo.example"),
            "https://other.example"
        ));
    }

    #[test]
    fn personal_token_storage_requires_a_single_bound_credential_record() {
        let valid = serde_json::json!({
            "token": format!("novo_mcp_{}", "A".repeat(43)),
            "apiOrigin": "https://novo.example",
        }).to_string();
        let stored =
            read_personal_access_token(Some(valid)).expect("valid bound credential");
        assert_eq!(stored.api_origin, "https://novo.example");
        assert!(!stored.token.is_empty());
        assert!(read_personal_access_token(Some(format!("novo_mcp_{}", "A".repeat(43)))).is_none());
    }

    #[test]
    fn identifiers_never_accept_paths_or_window_content() {
        assert_eq!(normalized_application("Code.exe").as_deref(), Some("code"));
        for private in [r"C:\Users\me\secret.txt", "https://example.com", "Draft: layoffs"] {
            assert_eq!(normalized_application(private), None);
        }
    }

    #[test]
    fn device_polling_never_shortens_issuer_interval_or_repeated_slow_down() {
        let now=Utc::now();
        assert_eq!(super::poll_delay(40, true, None, now),45);
        assert_eq!(super::poll_delay(45, true, Some("5"), now),50);
        assert_eq!(super::poll_delay(40, false, Some("120"), now),120);
        assert_eq!(super::poll_delay(40, false, Some(&(now+Duration::seconds(120)).to_rfc2822()), now),120);
    }

    #[test]
    fn recovery_does_not_queue_the_installed_grant_even_after_refresh_rotation() {
        let fixture=|id,refresh:&str|super::OAuthCredentials {
            installation_id:Some(id),access_token:"private-access".into(),refresh_token:refresh.into(),client_id:"client".into(),token_endpoint:"https://novo.example/token".into(),revocation_endpoint:"https://novo.example/revoke".into(),expires_at:Utc::now(),api_origin:"https://novo.example".into()
        };
        let id=Uuid::new_v4();let active=fixture(id,"rotated");let staged=fixture(id,"original");
        let old=fixture(Uuid::new_v4(),"old");
        let queue=super::replaced_credentials(Some(active.clone()),&staged,vec![active,old]);
        assert_eq!(queue.len(),1);
        assert_ne!(queue[0].installation_id,Some(id));
    }

    #[test]
    fn disconnect_local_guard_stops_capture_and_invalidates_live_stream() {
        let mut settings=crate::settings::Settings::default();settings.companion_capture_enabled=true;
        let mut runtime=crate::novo_account::AccountRuntime::default();
        let stream=runtime.begin_stream(Uuid::new_v4().to_string()).unwrap();
        super::stop_local_account(&mut settings,&mut runtime);
        assert!(!settings.companion_capture_enabled);assert!(settings.companion_revocation_pending);
        assert!(*stream.cancelled.borrow());
    }

    #[test]
    fn only_https_origins_without_paths_are_accepted() {
        assert_eq!(validate_origin("https://novo.example/").unwrap(), "https://novo.example");
        for unsafe_url in ["http://novo.example", "https://user@novo.example", "https://novo.example/path", "https://novo.example/?x=1"] {
            assert!(validate_origin(unsafe_url).is_err());
        }
    }

    #[test]
    fn sync_response_can_be_returned_to_the_tauri_frontend() {
        let response = SyncResponse { accepted: 2, skipped: 1 };
        let json = serde_json::to_value(response).unwrap();
        assert_eq!(json, serde_json::json!({ "accepted": 2, "skipped": 1 }));
    }

    #[test]
    fn local_history_expires_after_seven_days_and_counts_active_apps_only() {
        let now = Utc::now();
        let mut recorder = ActivityRecorder::default();
        recorder.events = vec![
            ActivityEvent { id: "fresh".into(), application_id: "code".into(), state: ActivityState::Active, started_at: now - Duration::minutes(4), ended_at: now - Duration::minutes(1), synced: false },
            ActivityEvent { id: "idle".into(), application_id: "system.idle".into(), state: ActivityState::Idle, started_at: now - Duration::minutes(2), ended_at: now - Duration::minutes(1), synced: false },
            ActivityEvent { id: "old".into(), application_id: "code".into(), state: ActivityState::Active, started_at: now - Duration::days(8), ended_at: now - Duration::days(8) + Duration::minutes(2), synced: false },
        ];
        recorder.prune(now);
        let (minutes, apps) = recorder.today_summary(now);
        assert_eq!(recorder.events.len(), 2);
        assert_eq!(minutes, 3);
        assert_eq!(apps.get("code"), Some(&3));
    }

    #[test]
    fn running_retention_expires_active_and_quarantined_history_without_restart() {
        let root=std::env::temp_dir().join(format!("novo-retention-{}",Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let path=root.join("activity.json");
        let archive=root.join("activity-quarantine.json");
        let now=Utc::now();
        let event=ActivityEvent {id:"fixture".into(),application_id:"code".into(),state:ActivityState::Active,started_at:now-Duration::minutes(2),ended_at:now,synced:false};
        let bytes=serde_json::to_vec(&vec![event.clone()]).unwrap();
        std::fs::write(&path,&bytes).unwrap();std::fs::write(&archive,&bytes).unwrap();
        let mut recorder=ActivityRecorder::default();recorder.events.push(event);
        recorder.maintain_retention_at(&path,now).unwrap();
        recorder.maintain_retention_at(&path,now+Duration::days(7)+Duration::seconds(1)).unwrap();
        assert!(recorder.events.is_empty());
        for target in [&path,&archive] {
            let events:Vec<ActivityEvent>=serde_json::from_slice(&std::fs::read(target).unwrap()).unwrap();
            assert!(events.is_empty());
        }
        assert!(recorder.pending_daily_summaries().is_empty());
        std::fs::remove_file(&path).unwrap();std::fs::remove_file(&archive).unwrap();std::fs::remove_dir(&root).unwrap();
    }

    #[test]
    fn failed_history_removal_keeps_events_and_is_reportable() {
        let root = std::env::temp_dir().join(format!("novo-companion-clear-failure-{}", Uuid::new_v4()));
        let event_path = root.join("activity.json");
        std::fs::create_dir_all(&event_path).unwrap();
        let now = Utc::now();
        let mut recorder = ActivityRecorder {
            events: vec![ActivityEvent {
                id: "must-remain-on-error".into(),
                application_id: "code".into(),
                state: ActivityState::Active,
                started_at: now,
                ended_at: now,
                synced: false,
            }],
            current: Some(OpenSegment {
                id: "open".into(),
                application_id: "code".into(),
                state: ActivityState::Active,
                started_at: now,
                last_seen: now,
            }),
            next_archive_check: None,
        };

        assert!(clear_local_history(&mut recorder, &event_path).is_err());
        assert_eq!(recorder.events.len(), 1);
        assert!(recorder.current.is_some());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn history_removal_is_idempotent_and_clears_memory_only_after_file_removal() {
        let root = std::env::temp_dir().join(format!("novo-companion-clear-success-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let event_path = root.join("activity.json");
        let temporary_path = event_path.with_extension("json.tmp");
        std::fs::write(&event_path, b"stored events").unwrap();
        std::fs::write(&temporary_path, b"pending write").unwrap();
        let now = Utc::now();
        let mut recorder = ActivityRecorder {
            events: vec![ActivityEvent {
                id: "stored".into(),
                application_id: "code".into(),
                state: ActivityState::Active,
                started_at: now,
                ended_at: now,
                synced: false,
            }],
            current: Some(OpenSegment {
                id: "open".into(),
                application_id: "code".into(),
                state: ActivityState::Active,
                started_at: now,
                last_seen: now,
            }),
            next_archive_check: None,
        };

        clear_local_history(&mut recorder, &event_path).unwrap();
        assert!(!event_path.exists());
        assert!(!temporary_path.exists());
        assert!(recorder.events.is_empty());
        assert!(recorder.current.is_none());
        clear_local_history(&mut recorder, &event_path).unwrap();
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn history_clear_waits_for_an_in_flight_activity_operation() {
        let shared = Arc::new(Shared {
            settings: Mutex::new(Settings::default()),
            gate: Arc::new(PollGate::new()),
            activity: Mutex::new(ActivityRecorder::default()),
            activity_history_lock: tokio::sync::Mutex::new(()),
            pending_companion_authorization: tokio::sync::Mutex::new(None),
            companion_auth_lock: tokio::sync::Mutex::new(()),
            novo_account: Mutex::new(crate::novo_account::AccountRuntime::default()),
        });
        let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();

        runtime.block_on(async {
            let activity_guard = activity_history_guard(&shared).await;
            let clear_started = Arc::new(AtomicBool::new(false));
            let clear_shared = Arc::clone(&shared);
            let clear_started_in_task = Arc::clone(&clear_started);
            let clear_task = tokio::spawn(async move {
                let _clear_guard = activity_history_guard(&clear_shared).await;
                clear_started_in_task.store(true, Ordering::Release);
            });

            tokio::task::yield_now().await;
            assert!(!clear_started.load(Ordering::Acquire));
            drop(activity_guard);
            clear_task.await.unwrap();
            assert!(clear_started.load(Ordering::Acquire));
        });
    }

    #[test]
    fn account_switch_quarantines_unsent_activity_instead_of_sending_it_as_new_owner() {
        let root=std::env::temp_dir().join(format!("novo-account-switch-{}",Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let path=root.join("activity.json");
        let now=Utc::now();
        let mut recorder=ActivityRecorder{events:vec![ActivityEvent{id:"synthetic-old-account-event".into(),application_id:"code".into(),state:ActivityState::Active,started_at:now-Duration::minutes(2),ended_at:now-Duration::minutes(1),synced:false}],..ActivityRecorder::default()};
        assert_eq!(recorder.pending_daily_summaries().len(),1);
        super::quarantine_history(&mut recorder,&path).unwrap();
        assert!(recorder.pending_daily_summaries().is_empty());
        assert_eq!(std::fs::read(&path).unwrap(),b"[]");
        let archived:Vec<ActivityEvent>=serde_json::from_slice(&std::fs::read(root.join("activity-quarantine.json")).unwrap()).unwrap();
        assert_eq!(archived.len(),1);
        assert_eq!(archived[0].id,"synthetic-old-account-event");
        std::fs::remove_file(root.join("activity-quarantine.json")).unwrap();
        std::fs::remove_file(path).unwrap();
        std::fs::remove_dir(root).unwrap();
    }

    #[test]
    fn sync_sends_only_daily_durations_and_keeps_local_detail_after_acknowledgement() {
        let start = "2026-10-07T23:59:30Z".parse().unwrap();
        let end = "2026-10-08T00:01:00Z".parse().unwrap();
        let mut recorder = ActivityRecorder {
            events: vec![ActivityEvent {
                id: "private-event-id".into(),
                application_id: "code".into(),
                state: ActivityState::Active,
                started_at: start,
                ended_at: end,
                synced: false,
            }],
            current: None,
            next_archive_check: None,
        };

        let summaries = recorder.pending_daily_summaries();
        assert_eq!(summaries.len(), 2);
        assert_eq!(summaries[0].day, "2026-10-07");
        assert_eq!(summaries[0].duration_seconds, 30);
        assert_eq!(summaries[1].day, "2026-10-08");
        assert_eq!(summaries[1].duration_seconds, 60);
        let payload = serde_json::to_string(&summaries).unwrap();
        assert!(!payload.contains("private-event-id"));
        assert!(!payload.contains("startedAt"));
        assert!(!payload.contains("endedAt"));

        recorder.mark_daily_summaries_synced(&summaries);
        assert_eq!(recorder.events.len(), 1);
        assert!(recorder.events[0].synced);
        assert!(recorder.pending_daily_summaries().is_empty());
    }
}
