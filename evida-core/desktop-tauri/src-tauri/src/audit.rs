use anyhow::Result;
use chrono::Utc;
use rusqlite::{params, Connection};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuditVerificationReport {
    pub status: String,
    pub events_checked: usize,
    pub broken_at: Option<String>,
    pub reason: Option<String>,
}

type AuditChainRow = (
    String,
    Option<String>,
    String,
    String,
    String,
    String,
    String,
    String,
    String,
    i64,
    Option<String>,
    String,
);

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
    let (sequence_number, previous_event_hash) = last_chain_state(conn, case_id)?;
    let sequence_number = sequence_number + 1;
    let canonical_payload_json = canonical_payload(details_json)?;
    let event_hash = calculate_event_hash(
        case_id,
        sequence_number,
        actor,
        action,
        target_type,
        target_id,
        result,
        &canonical_payload_json,
        previous_event_hash.as_deref(),
        &now,
    );

    conn.execute(
        "INSERT INTO audit_events
         (id, case_id, actor, action, target_type, target_id, result, details_json, created_at,
          sequence_number, previous_event_hash, event_hash, canonical_payload_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            id,
            case_id,
            actor,
            action,
            target_type,
            target_id,
            result,
            details_json,
            now,
            sequence_number,
            previous_event_hash,
            event_hash,
            canonical_payload_json
        ],
    )?;

    Ok(id)
}

pub fn verify_audit_chain(
    conn: &Connection,
    case_id: Option<&str>,
) -> Result<AuditVerificationReport> {
    let mut stmt = if case_id.is_some() {
        conn.prepare(
            "SELECT id, case_id, actor, action, target_type, target_id, result,
                    canonical_payload_json, created_at, sequence_number, previous_event_hash, event_hash
             FROM audit_events WHERE case_id = ?1 ORDER BY sequence_number ASC"
        )?
    } else {
        conn.prepare(
            "SELECT id, case_id, actor, action, target_type, target_id, result,
                    canonical_payload_json, created_at, sequence_number, previous_event_hash, event_hash
             FROM audit_events WHERE case_id IS NULL ORDER BY sequence_number ASC"
        )?
    };

    let rows: Vec<AuditChainRow> = if let Some(case_id) = case_id {
        stmt.query_map([case_id], map_chain_row)?
            .collect::<std::result::Result<Vec<_>, _>>()?
    } else {
        stmt.query_map([], map_chain_row)?
            .collect::<std::result::Result<Vec<_>, _>>()?
    };

    let mut expected_previous: Option<String> = None;
    let mut expected_sequence = 1_i64;
    let mut checked = 0_usize;
    for row in rows {
        let (
            id,
            row_case_id,
            actor,
            action,
            target_type,
            target_id,
            result,
            canonical_payload_json,
            created_at,
            sequence_number,
            previous_event_hash,
            event_hash,
        ) = row;
        checked += 1;

        if sequence_number != expected_sequence {
            return Ok(failed(checked, id, "sequence_number_gap"));
        }
        if previous_event_hash != expected_previous {
            return Ok(failed(checked, id, "previous_event_hash_mismatch"));
        }

        let calculated = calculate_event_hash(
            row_case_id.as_deref(),
            sequence_number,
            &actor,
            &action,
            &target_type,
            &target_id,
            &result,
            &canonical_payload_json,
            previous_event_hash.as_deref(),
            &created_at,
        );
        if calculated != event_hash {
            return Ok(failed(checked, id, "event_hash_mismatch"));
        }

        expected_previous = Some(event_hash);
        expected_sequence += 1;
    }

    Ok(AuditVerificationReport {
        status: "PASS".to_string(),
        events_checked: checked,
        broken_at: None,
        reason: None,
    })
}

fn map_chain_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<AuditChainRow> {
    Ok((
        row.get::<_, String>(0)?,
        row.get::<_, Option<String>>(1)?,
        row.get::<_, String>(2)?,
        row.get::<_, String>(3)?,
        row.get::<_, String>(4)?,
        row.get::<_, String>(5)?,
        row.get::<_, String>(6)?,
        row.get::<_, String>(7)?,
        row.get::<_, String>(8)?,
        row.get::<_, i64>(9)?,
        row.get::<_, Option<String>>(10)?,
        row.get::<_, String>(11)?,
    ))
}

fn failed(events_checked: usize, id: String, reason: &str) -> AuditVerificationReport {
    AuditVerificationReport {
        status: "FAIL".to_string(),
        events_checked,
        broken_at: Some(id),
        reason: Some(reason.to_string()),
    }
}

fn last_chain_state(conn: &Connection, case_id: Option<&str>) -> Result<(i64, Option<String>)> {
    if let Some(case_id) = case_id {
        let mut stmt = conn.prepare(
            "SELECT sequence_number, event_hash FROM audit_events
             WHERE case_id = ?1 ORDER BY sequence_number DESC LIMIT 1",
        )?;
        let mut rows = stmt.query([case_id])?;
        if let Some(row) = rows.next()? {
            return Ok((row.get(0)?, row.get(1)?));
        }
    } else {
        let mut stmt = conn.prepare(
            "SELECT sequence_number, event_hash FROM audit_events
             WHERE case_id IS NULL ORDER BY sequence_number DESC LIMIT 1",
        )?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            return Ok((row.get(0)?, row.get(1)?));
        }
    }
    Ok((0, None))
}

fn canonical_payload(details_json: Option<&str>) -> Result<String> {
    let Some(raw) = details_json else {
        return Ok("{}".to_string());
    };
    let value: Value = serde_json::from_str(raw)?;
    Ok(serde_json::to_string(&value)?)
}

fn calculate_event_hash(
    case_id: Option<&str>,
    sequence_number: i64,
    actor: &str,
    action: &str,
    target_type: &str,
    target_id: &str,
    result: &str,
    canonical_payload_json: &str,
    previous_event_hash: Option<&str>,
    created_at: &str,
) -> String {
    crate::hash::sha256_text(
        &[
            case_id.unwrap_or(""),
            &sequence_number.to_string(),
            actor,
            action,
            target_type,
            target_id,
            result,
            canonical_payload_json,
            previous_event_hash.unwrap_or(""),
            created_at,
        ]
        .join("\n"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().expect("open");
        conn.execute_batch(
            r#"
            CREATE TABLE audit_events (
                id TEXT PRIMARY KEY,
                case_id TEXT,
                actor TEXT NOT NULL,
                action TEXT NOT NULL,
                target_type TEXT NOT NULL,
                target_id TEXT NOT NULL,
                result TEXT NOT NULL,
                details_json TEXT,
                created_at TEXT NOT NULL,
                sequence_number INTEGER NOT NULL,
                previous_event_hash TEXT,
                event_hash TEXT NOT NULL,
                canonical_payload_json TEXT NOT NULL
            );
            "#,
        )
        .expect("schema");
        conn
    }

    #[test]
    fn audit_chain_passes_and_detects_tampering() {
        let conn = setup();
        append_audit_event(
            &conn,
            Some("CASE-1"),
            "user",
            "CASE_CREATED",
            "CASE",
            "CASE-1",
            "OK",
            Some(r#"{"b":2,"a":1}"#),
        )
        .expect("append 1");
        append_audit_event(
            &conn,
            Some("CASE-1"),
            "user",
            "DOCUMENT_IMPORTED",
            "DOCUMENT",
            "DOC-1",
            "OK",
            Some(r#"{"name":"doc"}"#),
        )
        .expect("append 2");

        let pass = verify_audit_chain(&conn, Some("CASE-1")).expect("verify");
        assert_eq!("PASS", pass.status);
        assert_eq!(2, pass.events_checked);

        conn.execute(
            "UPDATE audit_events SET result = 'CHANGED' WHERE sequence_number = 1",
            [],
        )
        .expect("tamper");
        let fail = verify_audit_chain(&conn, Some("CASE-1")).expect("verify tampered");
        assert_eq!("FAIL", fail.status);
        assert_eq!(Some("event_hash_mismatch".to_string()), fail.reason);
    }
}
