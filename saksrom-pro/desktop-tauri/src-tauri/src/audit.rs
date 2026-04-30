use anyhow::Result;
use chrono::Utc;
use rusqlite::{params, Connection};
use uuid::Uuid;

pub fn append_audit_event(
    conn: &Connection,
    case_id: Option<&str>,
    actor: &str,
    action: &str,
    target_type: &str,
    target_id: &str,
    result: &str,
    details_json: Option<&str>,
) -> Result<String> {
    let id = format!("AUD-{}", Uuid::new_v4());
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO audit_events
         (id, case_id, actor, action, target_type, target_id, result, details_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![id, case_id, actor, action, target_type, target_id, result, details_json, now],
    )?;

    Ok(id)
}
