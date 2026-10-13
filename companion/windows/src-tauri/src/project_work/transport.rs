use super::protocol::Claim;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs, path::PathBuf};
pub(super) fn root() -> PathBuf {
    crate::settings::config_dir().join("project-work")
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Receipt {
    pub origin: String,
    pub user_id: String,
    pub device_id: String,
    pub claim: Claim,
    pub execution_id: String,
    pub base: String,
    pub started_at: String,
    pub sequence: u64,
    pub pending: Option<Value>,
    pub outcome: Option<Value>,
    pub finished_at: Option<String>,
    pub acknowledged: bool,
}
impl Receipt {
    pub fn new(
        access: &crate::novo_account::AccessContext,
        user_id: String,
        claim: Claim,
        base: String,
    ) -> Self {
        Self {
            origin: access.origin.clone(),
            user_id,
            device_id: access.device_id.clone(),
            claim,
            execution_id: uuid::Uuid::new_v4().to_string(),
            base,
            started_at: chrono::Utc::now().to_rfc3339(),
            sequence: 0,
            pending: None,
            outcome: None,
            finished_at: None,
            acknowledged: false,
        }
    }
}
pub(super) fn save(receipt: &Receipt) -> Result<(), String> {
    let dir = root().join("receipts");
    crate::platform::ensure_private_dir(&dir).map_err(|_| "receipt_missing")?;
    if uuid::Uuid::parse_str(&receipt.execution_id).is_err() {
        return Err("receipt_missing".into());
    }
    let temp = dir.join(format!("{}.tmp", uuid::Uuid::new_v4()));
    let file = dir.join(format!("{}.json", receipt.execution_id));
    fs::write(
        &temp,
        serde_json::to_vec(receipt).map_err(|_| "receipt_missing")?,
    )
    .map_err(|_| "receipt_missing")?;
    fs::rename(temp, file).map_err(|_| "receipt_missing".into())
}
pub(super) fn saved() -> Vec<Receipt> {
    fs::read_dir(root().join("receipts"))
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .take(100)
        .filter_map(|file| {
            if !file.file_name().to_string_lossy().ends_with(".json")
                || file.metadata().ok()?.len() > 128 * 1024
            {
                return None;
            }
            serde_json::from_slice(&fs::read(file.path()).ok()?).ok()
        })
        .collect()
}
pub(super) async fn request(
    access: &crate::novo_account::AccessContext,
    id: Option<&str>,
    body: Value,
) -> Result<Value, String> {
    let suffix = id.map(|id| format!("/{id}")).unwrap_or_default();
    let response = crate::novo_account::client(10)
        .map_err(|_| "offline")?
        .post(format!("{}/api/companion/work{suffix}", access.origin))
        .bearer_auth(&access.token)
        .header("X-Novo-Device-Id", &access.device_id)
        .json(&body)
        .send()
        .await
        .map_err(|_| "offline")?;
    crate::novo_account::read_json(response, 128 * 1024)
        .await
        .map_err(|_| "work_not_running".into())
}
pub(super) async fn report(
    access: &crate::novo_account::AccessContext,
    receipt: &mut Receipt,
    event: Value,
) -> Result<(), String> {
    if receipt.pending.is_none() {
        receipt.pending = Some(
            json!({"action":"report","report":{"leaseToken":receipt.claim.lease_token,"sequence":receipt.sequence+1,"event":event}}),
        );
        save(receipt)?;
    }
    request(
        access,
        Some(&receipt.claim.id),
        receipt.pending.clone().ok_or("receipt_missing")?,
    )
    .await?;
    receipt.sequence += 1;
    receipt.pending = None;
    save(receipt)
}
pub(super) async fn step(
    access: &crate::novo_account::AccessContext,
    receipt: &Receipt,
) -> Result<(), String> {
    let response = request(
        access,
        Some(&receipt.claim.id),
        json!({"action":"step","leaseToken":receipt.claim.lease_token}),
    )
    .await?;
    if response["scope"]
        != serde_json::to_value(&receipt.claim.scope).map_err(|_| "invalid_work_request")?
    {
        return Err("work_not_running".into());
    }
    Ok(())
}
pub(super) async fn recover(access: &crate::novo_account::AccessContext, receipt: &mut Receipt) {
    if receipt.acknowledged {
        return;
    }
    // Restart never relaunches an agent, even after an unacknowledged start.
    if receipt.outcome.is_none() {
        receipt.outcome = Some(json!({"type":"failed","reason":"receipt_missing"}));
        receipt.finished_at = Some(chrono::Utc::now().to_rfc3339());
        let _ = save(receipt);
    }
    if receipt.pending.is_some()
        && report(access, receipt, Value::Null).await.is_ok()
        && receipt.sequence > 1
    {
        receipt.acknowledged = true;
        let _ = save(receipt);
        return;
    }
    if let (Some(outcome), Some(finished)) = (receipt.outcome.clone(), receipt.finished_at.clone())
    {
        if request(access,Some(&receipt.claim.id),json!({"action":"reconcile","receipt":{"leaseToken":receipt.claim.lease_token,"executionId":receipt.execution_id,"finishedAt":finished,"outcome":outcome}})).await.is_ok(){receipt.acknowledged=true;receipt.pending=None;let _=save(receipt);}
    }
}
