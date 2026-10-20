//! Narrow Codex-to-Twin context bridge.
//!
//! Hook payloads stay local except for a hashed session key, a project folder
//! name, and one short summary from a user prompt or assistant completion.
//! Tool inputs, tool outputs, full paths, and transcripts are never forwarded.

use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

use crate::Shared;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodexContextInput {
    session_key: String,
    event: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    project_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    summary: Option<String>,
    observed_at: String,
}

fn hash_session(session: &str) -> String {
    let digest = Sha256::digest(session.as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn project_label(cwd: Option<&str>) -> Option<String> {
    let path = cwd?.trim_end_matches(&['\\', '/'][..]);
    let name = path.rsplit(&['\\', '/'][..]).next()?.trim();
    if name.is_empty()
        || name.chars().count() > 80
        || name
            .chars()
            .any(|c| !(c.is_alphanumeric() || " ._-()[]".contains(c)))
        || name.to_ascii_lowercase().contains("token")
        || name.to_ascii_lowercase().contains("secret")
    {
        return None;
    }
    Some(name.to_owned())
}

fn safe_summary(raw: &str) -> Option<String> {
    // Summaries are intentionally one-line and short. Ignore fenced code
    // blocks and inline code before looking for accidental paths or secrets.
    let mut in_fence = false;
    let mut first_line = None;
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_fence = !in_fence;
            continue;
        }
        let lower = trimmed.to_ascii_lowercase();
        if in_fence
            || trimmed.is_empty()
            || trimmed.starts_with("- ")
            || trimmed.starts_with("* ")
            || [
                "tool output:",
                "stdout:",
                "stderr:",
                "diff --git ",
                "+++ ",
                "--- ",
                "import ",
                "export ",
                "const ",
                "let ",
                "function ",
                "class ",
                "return ",
                "def ",
                "fn ",
            ]
            .iter()
            .any(|prefix| lower.starts_with(prefix))
        {
            continue;
        }
        first_line = Some(trimmed);
        break;
    }
    let line = first_line?;

    let mut plain = String::with_capacity(line.len());
    let mut inline_code = false;
    for character in line.chars() {
        if character == '`' {
            inline_code = !inline_code;
            continue;
        }
        if !inline_code {
            plain.push(character);
        }
    }

    let mut tokens = Vec::new();
    let mut hide_next = false;
    for token in plain.split_whitespace() {
        if hide_next {
            tokens.push("[dato omitido]");
            hide_next = false;
            continue;
        }
        let lower = token.to_ascii_lowercase();
        if [
            "api_key",
            "api-key",
            "access_token",
            "access-token",
            "password",
            "passwd",
            "secret",
            "bearer",
        ]
        .iter()
        .any(|key| lower.starts_with(&format!("{key}=")) || lower.starts_with(&format!("{key}:")))
        {
            tokens.push("[dato omitido]");
            continue;
        }
        if [
            "api_key",
            "api-key",
            "access_token",
            "access-token",
            "password",
            "passwd",
            "secret",
            "bearer",
        ]
        .iter()
        .any(|key| {
            lower
                .trim_matches(|c: char| !c.is_alphanumeric() && c != '_' && c != '-')
                .eq(*key)
        }) {
            tokens.push("[dato omitido]");
            hide_next = true;
            continue;
        }
        let token_core = token
            .trim_matches(|c: char| !c.is_alphanumeric() && c != '_' && c != '-')
            .to_ascii_lowercase();
        let looks_secret = token_core.starts_with("sk-")
            || token_core.starts_with("ghp_")
            || token_core.starts_with("gho_")
            || token_core.starts_with("ghu_")
            || token_core.starts_with("ghs_")
            || token_core.starts_with("ghr_")
            || token_core.starts_with("github_pat_")
            || token_core.starts_with("novo_mcp_")
            || (token_core.len() >= 40
                && token_core
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || "_-".contains(c)));
        let looks_like_path_or_code = token.contains("/")
            || token.contains('\\')
            || token.contains("://")
            || token.contains("=>")
            || token.contains('{')
            || token.contains('}')
            || token.contains(';')
            || token.contains('=')
            || token.contains('<')
            || token.contains('>')
            || [
                ".rs", ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".py", ".sql", ".env",
            ]
            .iter()
            .any(|extension| token_core.ends_with(extension));
        if looks_secret || looks_like_path_or_code {
            tokens.push("[dato omitido]");
        } else {
            tokens.push(token);
        }
    }
    let summary = tokens
        .join(" ")
        .trim()
        .chars()
        .take(240)
        .collect::<String>();
    (!summary.is_empty()).then_some(summary)
}

fn input_from_hook(payload: &Value) -> Option<CodexContextInput> {
    if payload.get("coucou_agent").and_then(Value::as_str) != Some("codex") {
        return None;
    }
    let session = payload.get("session_id").and_then(Value::as_str)?.trim();
    if session.is_empty() || session.len() > 1024 {
        return None;
    }
    let event = match payload.get("hook_event_name").and_then(Value::as_str)? {
        "SessionStart" => "start",
        "UserPromptSubmit" => "prompt",
        "Stop" => "stop",
        "StopFailure" => "stop_failure",
        "SessionEnd" => "end",
        _ => return None,
    };
    let summary_field = match event {
        "prompt" => "prompt",
        "stop" | "stop_failure" => "last_assistant_message",
        _ => {
            return Some(CodexContextInput {
                session_key: hash_session(session),
                event,
                project_label: project_label(payload.get("cwd").and_then(Value::as_str)),
                summary: None,
                observed_at: chrono::Utc::now().to_rfc3339(),
            })
        }
    };

    Some(CodexContextInput {
        session_key: hash_session(session),
        event,
        project_label: project_label(payload.get("cwd").and_then(Value::as_str)),
        summary: payload
            .get(summary_field)
            .and_then(Value::as_str)
            .and_then(safe_summary),
        observed_at: chrono::Utc::now().to_rfc3339(),
    })
}

/// Starts a best-effort network write without delaying the coding agent.
pub fn sync_hook_event(app: &AppHandle, payload: &Value) {
    let Some(input) = input_from_hook(payload) else {
        return;
    };
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let shared = app.state::<Shared>();
        let access = match crate::novo_account::access_context(shared.inner()).await {
            Ok(access) => access,
            Err(error) => { crate::log::line(format!("Codex context sync blocked: {}", error.code)); return; }
        };
        let Ok(client) = crate::novo_account::client(8) else {
            return;
        };
        let response = access.send_json::<serde_json::Value>(client
            .post(format!(
                "{}/api/companion/codex-context",
                access.origin.trim_end_matches('/')
            ))
            .bearer_auth(&access.token)
            .header("X-Novo-Device-Id", &access.device_id)
            .json(&input), 65536).await;
        // Log only a fixed status, never the response body, summary or token.
        // Missing work-context scopes must not look like a successful sync.
        let status = match response {
            Ok(_) => "synced",
            Err(error) if error.code == "expired" => "authorization_expired",
            Err(error) if error.code == "permission_required" => "work_context_permission_required",
            Err(error) if error.code == "rate_limited" => "rate_limited",
            _ => "temporarily_unavailable",
        };
        crate::log::line(format!("Codex context sync: {status}"));
    });
}

#[cfg(test)]
mod tests {
    use super::{input_from_hook, safe_summary};
    use serde_json::json;

    #[test]
    fn only_codex_lifecycle_hooks_become_small_hashed_context_records() {
        let input = input_from_hook(&json!({
            "coucou_agent": "codex",
            "hook_event_name": "UserPromptSubmit",
            "session_id": "private-raw-session-id",
            "cwd": "C:\\Users\\Angel\\Downloads\\novo-web",
            "prompt": "Fix the Twin context bridge and explain the result",
            "tool_input": { "command": "private command" },
            "tool_output": "private output"
        }))
        .unwrap();

        assert_eq!(input.event, "prompt");
        assert_eq!(input.project_label.as_deref(), Some("novo-web"));
        assert_eq!(
            input.summary.as_deref(),
            Some("Fix the Twin context bridge and explain the result")
        );
        assert_eq!(input.session_key.len(), 64);
        let serialized = serde_json::to_string(&input).unwrap();
        assert!(!serialized.contains("private-raw-session-id"));
        assert!(!serialized.contains("C:\\\\Users"));
        assert!(!serialized.contains("private command"));
        assert!(!serialized.contains("private output"));
    }

    #[test]
    fn non_codex_and_tool_events_never_upload() {
        for payload in [
            json!({ "coucou_agent": "claude", "hook_event_name": "UserPromptSubmit", "session_id": "s" }),
            json!({ "coucou_agent": "codex", "hook_event_name": "PostToolUse", "session_id": "s", "tool_output": "private" }),
        ] {
            assert!(input_from_hook(&payload).is_none());
        }
    }

    #[test]
    fn summaries_omit_code_paths_urls_and_common_credentials() {
        let summary = safe_summary("Completed the task. `secret_value` see C:\\Users\\Angel\\repo\\app.ts and https://private.example/sk-1234567890123456 api_key=private-token").unwrap();
        assert!(summary.starts_with("Completed the task."));
        assert!(!summary.contains("secret_value"));
        assert!(!summary.contains("C:\\Users"));
        assert!(!summary.contains("private.example"));
        assert!(!summary.contains("private-token"));
    }

    #[test]
    fn multiline_code_blocks_are_skipped_instead_of_being_synced() {
        let summary = safe_summary(
            "Updated the requested behavior.\n```ts\nconst secret = 'do not send'\n```",
        )
        .unwrap();
        assert_eq!(summary, "Updated the requested behavior.");
    }
}
