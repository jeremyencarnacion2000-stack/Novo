//! Only transport identities and independently collected evidence leave the PC.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Verification {
    pub kind: String,
    pub script: String,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Scope {
    pub memory_id: String,
    pub device_id: String,
    pub workspace_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repository: Option<String>,
    pub verification: Vec<Verification>,
    pub timeout_seconds: u64,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Claim {
    pub id: String,
    pub capability: String,
    pub objective: String,
    pub scope: Scope,
    pub rule_version: u64,
    pub lease_token: String,
    pub lease_version: u64,
    pub lease_expires_at: String,
    pub sequence: u64,
}
impl Claim {
    pub fn validate(&self) -> Result<(), String> {
        if !safe_id(&self.id)
            || Uuid::parse_str(&self.lease_token).is_err()
            || Uuid::parse_str(&self.scope.workspace_id).is_err()
            || Uuid::parse_str(&self.scope.device_id).is_err()
            || !(60..=900).contains(&self.scope.timeout_seconds)
            || self.sequence != 0
            || self.objective.len() > 1920
            || self.objective.chars().any(char::is_control)
            || ![
                "project.diagnose",
                "codex.prepare_fix",
                "claude.prepare_fix",
            ]
            .contains(&self.capability.as_str())
            || self.scope.verification.len() > 4
        {
            return Err("invalid_work_request".into());
        }
        for step in &self.scope.verification {
            if step.kind != "npm_script"
                || step.script.is_empty()
                || step.script.len() > 80
                || !step
                    .script
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || "_.:-".contains(c))
            {
                return Err("invalid_work_request".into());
            }
        }
        if self.capability.ends_with("prepare_fix") && self.scope.verification.is_empty() {
            return Err("verification_failed".into());
        }
        Ok(())
    }
}
pub fn safe_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "_.:-".contains(c))
}
#[derive(Default)]
pub struct JsonlDecoder {
    total: usize,
    session: Option<String>,
    complete: bool,
    failed: bool,
}
impl JsonlDecoder {
    pub fn line(&mut self, line: &[u8]) -> Result<(), String> {
        self.total += line.len();
        if line.len() > 65536 || self.total > 8 * 1024 * 1024 {
            self.failed = true;
            return Err("execution_failed".into());
        }
        let value: Value = serde_json::from_slice(line).map_err(|_| "execution_failed")?;
        match value["type"].as_str() {
            Some("thread.started") => {
                let id = value["thread_id"]
                    .as_str()
                    .filter(|id| Uuid::parse_str(id).is_ok())
                    .ok_or("execution_failed")?;
                if self.session.is_some() {
                    self.failed = true;
                    return Err("execution_failed".into());
                }
                self.session = Some(id.into())
            }
            Some("turn.completed") => self.complete = true,
            Some("turn.failed") | Some("error") => {
                self.failed = true;
                return Err("execution_failed".into());
            }
            // Item contents and provider errors are deliberately never forwarded.
            Some(_) => {}
            None => {
                self.failed = true;
                return Err("execution_failed".into());
            }
        }
        Ok(())
    }
    pub fn finish(&self) -> Result<String, String> {
        if self.complete && !self.failed {
            self.session.clone().ok_or("receipt_missing".into())
        } else {
            Err("receipt_missing".into())
        }
    }
}
