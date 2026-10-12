//! Bounded typed Novo SSE; never feeds the legacy provider orchestrator.

use crate::novo_account::SafeError;
use crate::novo_account::{access_context, client, read_json, verify_account, StreamTicket};
use crate::Shared;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CompanionChatRequest {
    pub request_id: String,
    pub conversation_id: Option<String>,
    pub conversation_revision: Option<u64>,
    pub message: String,
    pub model: String,
    pub twin_mode: bool,
    #[serde(default)]
    pub local_context: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_hints: Option<Vec<crate::context_folders::ProjectHint>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local_connections: Option<std::collections::BTreeMap<String,String>>,
}
impl CompanionChatRequest {
    fn validate(&self) -> Result<(), SafeError> {
        if uuid::Uuid::parse_str(&self.request_id).is_err()
            || self.message.trim().is_empty()
            || self.message.chars().count() > 12000
            || self.model.trim().is_empty()
            || self.model.len() > 120
            || self.local_context.as_ref().is_some_and(|text|text.chars().count()>16_000)
            || self.project_hints.as_ref().is_some_and(|hints|hints.len()>32)
            || self.conversation_id.is_some() != self.conversation_revision.is_some()
            || self
                .conversation_id
                .as_ref()
                .is_some_and(|id| id.is_empty() || id.len() > 200)
        {
            Err(SafeError::new("invalid_request"))
        } else {
            Ok(())
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NovoChatModel {
    pub id: String,
    pub label: String,
    pub allows_twin_mode: bool,
}
#[derive(Deserialize)]
struct Models {
    models: Vec<NovoChatModel>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConversationSummary {
    pub id: String,
    pub title: String,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub revision: u64,
}
#[derive(Deserialize)]
struct Conversations {
    conversations: Vec<ConversationSummary>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AccountConversation {
    pub id: String,
    pub title: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub revision: u64,
    pub messages: Vec<ConversationMessage>,
}

async fn account_get<T: serde::de::DeserializeOwned>(
    shared: &Shared,
    path: &[&str],
    limit: usize,
) -> Result<T, SafeError> {
    verify_account(shared).await?;
    let access = access_context(shared).await?;
    let mut url = reqwest::Url::parse(&access.origin).map_err(|_| SafeError::new("unavailable"))?;
    {
        let mut segments = url
            .path_segments_mut()
            .map_err(|_| SafeError::new("unavailable"))?;
        for part in path {
            segments.push(part);
        }
    }
    let response = client(15)?
        .get(url)
        .bearer_auth(&access.token)
        .header("X-Novo-Device-Id", &access.device_id)
        .send()
        .await
        .map_err(|_| SafeError::new("offline"))?;
    let result = read_json(response, limit).await?;
    if shared
        .novo_account
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .epoch
        != access.epoch
    {
        return Err(SafeError::new("cancelled"));
    }
    Ok(result)
}
#[tauri::command]
pub async fn novo_chat_models(shared: State<'_, Shared>) -> Result<Vec<NovoChatModel>, SafeError> {
    let result: Models = account_get(&shared, &["api", "companion", "models"], 65536).await?;
    if result.models.len() > 100
        || result.models.iter().any(|m| {
            m.id.is_empty() || m.id.len() > 120 || m.label.is_empty() || m.label.len() > 120
        })
    {
        return Err(SafeError::new("unavailable"));
    }
    Ok(result.models)
}
#[tauri::command]
pub async fn novo_conversations(
    shared: State<'_, Shared>,
) -> Result<Vec<ConversationSummary>, SafeError> {
    let result: Conversations =
        account_get(&shared, &["api", "companion", "conversations"], 256 * 1024).await?;
    if result.conversations.len() > 200
        || result
            .conversations
            .iter()
            .any(|c| c.id.is_empty() || c.id.len() > 200 || c.title.len() > 2000)
    {
        return Err(SafeError::new("unavailable"));
    }
    Ok(result.conversations)
}
#[tauri::command]
pub async fn novo_conversation_get(
    shared: State<'_, Shared>,
    id: String,
) -> Result<AccountConversation, SafeError> {
    if id.is_empty() || id.len() > 200 {
        return Err(SafeError::new("invalid_request"));
    }
    let result: AccountConversation = account_get(
        &shared,
        &["api", "companion", "conversations", &id],
        8 * 1024 * 1024,
    )
    .await?;
    if result.id != id
        || result.messages.len() > 2000
        || result.messages.iter().any(|m| {
            m.id.is_empty()
                || m.id.len() > 200
                || !["user", "assistant", "system"].contains(&m.role.as_str())
                || m.content.chars().count() > 500000
        })
    {
        return Err(SafeError::new("unavailable"));
    }
    Ok(result)
}

// Race a read/send against local cancellation without polling, new runtime
// dependencies, or keeping a settings lock across the network.
async fn until_cancel<T>(
    future: impl std::future::Future<Output = T>,
    cancel: &mut tokio::sync::watch::Receiver<bool>,
) -> Result<T, SafeError> {
    use std::future::Future;
    use std::task::Poll;
    if *cancel.borrow() {
        return Err(SafeError::new("cancelled"));
    }
    let mut future = std::pin::pin!(future);
    let mut changed = std::pin::pin!(cancel.changed());
    std::future::poll_fn(|cx| {
        if changed.as_mut().poll(cx).is_ready() {
            Poll::Ready(Err(SafeError::new("cancelled")))
        } else {
            future.as_mut().poll(cx).map(Ok)
        }
    })
    .await
}
fn emit(
    app: &AppHandle,
    shared: &Shared,
    ticket: &StreamTicket,
    event: &CompanionChatEvent,
) -> Result<(), SafeError> {
    let runtime = shared
        .novo_account
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    if !runtime.accepts(ticket) {
        return Err(SafeError::new("cancelled"));
    }
    app.emit("novo-chat-event", event)
        .map_err(|_| SafeError::new("unavailable"))
}
#[tauri::command]
pub async fn novo_chat_start(
    app: AppHandle,
    shared: State<'_, Shared>,
    input: CompanionChatRequest,
) -> Result<(), SafeError> {
    input.validate()?;
    let authorization = verify_account(&shared).await?;
    if input.twin_mode && !authorization.capabilities.twin_read {
        return Err(SafeError::new("permission_required"));
    }
    let access = access_context(&shared).await?;
    let mut ticket = {
        let mut runtime = shared
            .novo_account
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if runtime.epoch != access.epoch {
            return Err(SafeError::new("cancelled"));
        }
        runtime.begin_stream(input.request_id.clone())?
    };
    let result = async {
        let request = client(120)?
            .post(format!("{}/api/companion/chat", access.origin))
            .bearer_auth(&access.token)
            .header("X-Novo-Device-Id", &access.device_id)
            .json(&input);
        let mut response = until_cancel(request.send(), &mut ticket.cancelled)
            .await?
            .map_err(|_| SafeError::new("offline"))?;
        if response.status().as_u16() == 202 {
            return Err(SafeError::new("pending"));
        }
        if !response.status().is_success() {
            let error = read_json::<serde_json::Value>(response, 65536)
                .await
                .err()
                .unwrap_or_else(|| SafeError::new("unavailable"));
            if error.code == "rate_limited" {
                let seconds = error.retry_after_seconds.unwrap_or(60);
                shared
                    .novo_account
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner)
                    .retry_at =
                    Some(std::time::Instant::now() + std::time::Duration::from_secs(seconds));
            }
            return Err(error);
        }
        if !response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .is_some_and(|v| {
                v.split(';')
                    .next()
                    .is_some_and(|mime| mime.trim() == "text/event-stream")
            })
        {
            return Err(SafeError::new("stream_interrupted"));
        }
        let mut decoder = SseDecoder::new(input.request_id.clone());
        let mut stream_error = None;
        loop {
            let chunk = until_cancel(response.chunk(), &mut ticket.cancelled)
                .await?
                .map_err(|_| SafeError::new("stream_interrupted"))?;
            let Some(chunk) = chunk else { break };
            for event in decoder.push(&chunk)? {
                if let CompanionChatEvent::Error { code, .. } = &event {
                    stream_error = Some(SafeError::new(code));
                }
                emit(&app, &shared, &ticket, &event)?;
            }
        }
        decoder.finish()?;
        if let Some(error) = stream_error {
            return Err(error);
        }
        Ok(())
    }
    .await;
    shared
        .novo_account
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .finish_stream(&ticket);
    result
}
#[tauri::command]
pub async fn novo_chat_cancel(
    shared: State<'_, Shared>,
    request_id: String,
) -> Result<(), SafeError> {
    if uuid::Uuid::parse_str(&request_id).is_err() {
        return Err(SafeError::new("invalid_request"));
    }
    // Local stream stops even when the server cannot be reached.
    shared
        .novo_account
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .cancel(&request_id);
    let access = access_context(&shared).await?;
    let response = client(12)?
        .post(format!(
            "{}/api/companion/chat/{}/cancel",
            access.origin, request_id
        ))
        .bearer_auth(&access.token)
        .header("X-Novo-Device-Id", &access.device_id)
        .send()
        .await
        .map_err(|_| SafeError::new("offline"))?;
    let _: serde_json::Value = read_json(response, 65536).await?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "lowercase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum CompanionChatEvent {
    Metadata {
        request_id: String,
        conversation_id: String,
        revision: u64,
        user_message_id: String,
    },
    Phase {
        request_id: String,
        phase: String,
    },
    Delta {
        request_id: String,
        text: String,
    },
    Complete {
        request_id: String,
        assistant_message_id: String,
        revision: u64,
        model_id: String,
    },
    Error {
        request_id: String,
        code: String,
    },
}
impl CompanionChatEvent {
    fn id(&self) -> &str {
        match self {
            Self::Metadata { request_id, .. }
            | Self::Phase { request_id, .. }
            | Self::Delta { request_id, .. }
            | Self::Complete { request_id, .. }
            | Self::Error { request_id, .. } => request_id,
        }
    }
    fn validate(&self, id: &str) -> Result<(), SafeError> {
        let valid = self.id() == id
            && uuid::Uuid::parse_str(id).is_ok()
            && match self {
                Self::Metadata {
                    conversation_id,
                    user_message_id,
                    ..
                } => {
                    !conversation_id.is_empty()
                        && conversation_id.len() <= 200
                        && uuid::Uuid::parse_str(user_message_id).is_ok()
                }
                Self::Phase { phase, .. } => [
                    "initializing",
                    "retrieving_context",
                    "interpreting_signals",
                    "composing_response",
                    "completed",
                    "failed",
                    "cancelled",
                ]
                .contains(&phase.as_str()),
                Self::Delta { text, .. } => text.len() <= 65536,
                Self::Complete {
                    assistant_message_id,
                    model_id,
                    ..
                } => {
                    uuid::Uuid::parse_str(assistant_message_id).is_ok()
                        && !model_id.is_empty()
                        && model_id.len() <= 120
                }
                Self::Error { code, .. } => [
                    "unauthorized",
                    "permission_required",
                    "device_revoked",
                    "model_unavailable",
                    "twin_permission_required",
                    "revision_conflict",
                    "request_conflict",
                    "turn_active",
                    "provider_unavailable",
                    "stream_interrupted",
                    "cancelled",
                    "request_expired",
                    "chat_disabled",
                    "internal_error",
                ]
                .contains(&code.as_str()),
            };
        if valid {
            Ok(())
        } else {
            Err(SafeError::new("stream_interrupted"))
        }
    }
}
pub struct SseDecoder {
    id: String,
    frame: Vec<u8>,
    terminal: bool,
    total_text: usize,
}
impl SseDecoder {
    pub fn new(id: String) -> Self {
        Self {
            id,
            frame: vec![],
            terminal: false,
            total_text: 0,
        }
    }
    pub fn push(&mut self, chunk: &[u8]) -> Result<Vec<CompanionChatEvent>, SafeError> {
        let mut events = vec![];
        for byte in chunk {
            self.frame.push(*byte);
            if self.frame.len() > 65536 {
                return Err(SafeError::new("stream_interrupted"));
            }
            if !self.frame.ends_with(b"\n\n") && !self.frame.ends_with(b"\r\n\r\n") {
                continue;
            }
            let frame = std::str::from_utf8(&self.frame)
                .map_err(|_| SafeError::new("stream_interrupted"))?;
            let data = frame
                .lines()
                .filter_map(|line| line.strip_prefix("data:").map(str::trim_start))
                .collect::<Vec<_>>()
                .join("\n");
            if !data.is_empty() {
                if self.terminal {
                    return Err(SafeError::new("stream_interrupted"));
                }
                let event: CompanionChatEvent = serde_json::from_str(&data)
                    .map_err(|_| SafeError::new("stream_interrupted"))?;
                event.validate(&self.id)?;
                if let CompanionChatEvent::Delta { text, .. } = &event {
                    self.total_text += text.len();
                    if self.total_text > 2_000_000 {
                        return Err(SafeError::new("stream_interrupted"));
                    }
                }
                self.terminal = matches!(
                    event,
                    CompanionChatEvent::Complete { .. } | CompanionChatEvent::Error { .. }
                );
                events.push(event);
            }
            self.frame.clear();
        }
        Ok(events)
    }
    pub fn finish(&self) -> Result<(), SafeError> {
        if self.terminal && self.frame.iter().all(u8::is_ascii_whitespace) {
            Ok(())
        } else {
            Err(SafeError::new("stream_interrupted"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn chunks_split_at_utf8_and_sse_boundaries() {
        let id = "e9d8a6f2-0ca4-45bb-9d60-9007ad9c6bdf";
        let bytes = format!("data: {{\"type\":\"delta\",\"requestId\":\"{id}\",\"text\":\"Hola, Ángel\"}}\r\n\r\ndata: {{\"type\":\"complete\",\"requestId\":\"{id}\",\"assistantMessageId\":\"{id}\",\"revision\":2,\"modelId\":\"auto\"}}\n\n").into_bytes();
        for split in 1..bytes.len() {
            let mut decoder = SseDecoder::new(id.into());
            let mut events = decoder.push(&bytes[..split]).unwrap();
            events.extend(decoder.push(&bytes[split..]).unwrap());
            decoder.finish().unwrap();
            assert_eq!(events.len(), 2);
            assert!(
                matches!(&events[0], CompanionChatEvent::Delta{text,..} if text == "Hola, Ángel")
            );
        }
    }
    #[test]
    fn rejects_private_fields_wrong_request_and_incomplete_stream() {
        let id = "e9d8a6f2-0ca4-45bb-9d60-9007ad9c6bdf";
        for data in [format!("data: {{\"type\":\"delta\",\"requestId\":\"{id}\",\"text\":\"x\",\"refresh_token\":\"secret\"}}\n\n"), "data: {\"type\":\"phase\",\"requestId\":\"wrong\",\"phase\":\"provider-secret\"}\n\n".into()] {
            assert!(SseDecoder::new(id.into()).push(data.as_bytes()).is_err());
        }
        assert!(SseDecoder::new(id.into()).finish().is_err());
        assert!(SseDecoder::new(id.into()).push(&vec![b'x'; 65537]).is_err());
    }
    #[test]
    fn cancellation_wakes_a_stream_that_has_no_chunks() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        runtime.block_on(async {
            let (sender, mut receiver) = tokio::sync::watch::channel(false);
            tokio::spawn(async move {
                tokio::task::yield_now().await;
                sender.send(true).unwrap();
            });
            let result = tokio::time::timeout(
                std::time::Duration::from_secs(1),
                until_cancel(std::future::pending::<()>(), &mut receiver),
            )
            .await
            .unwrap();
            assert_eq!(result.unwrap_err().code, "cancelled");
        });
    }
    #[test]
    fn requests_cannot_carry_user_history_files_or_window_context() {
        let json = r#"{"requestId":"e9d8a6f2-0ca4-45bb-9d60-9007ad9c6bdf","conversationId":null,"conversationRevision":null,"message":"chosen text","model":"auto","twinMode":false}"#;
        let input: CompanionChatRequest = serde_json::from_str(json).unwrap();
        input.validate().unwrap();
        for field in [
            "userId",
            "history",
            "attachments",
            "windowTitle",
            "refresh_token",
        ] {
            let mut value: serde_json::Value = serde_json::from_str(json).unwrap();
            value[field] = serde_json::json!("not-sent");
            assert!(serde_json::from_value::<CompanionChatRequest>(value).is_err());
        }
    }
}
