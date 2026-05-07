use crate::domain::{
    ArgumentItem, AuditEvent, CaseAiMessage, CaseAiMessageSource, CaseSummary,
    ChronologyEvent, ContradictionItem, DatabaseSecurityStatus, DocumentIngestionReport,
    DocumentSummary, EvidenceItem, MaintenanceReport, ReindexReport, RiskItem,
    SourceObjectSummary, WorkItems,
};
use crate::ingestion::DocumentExtraction;
use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::{params, Connection};
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub fn default_db_path() -> Result<PathBuf> {
    Ok(default_data_dir()?.join("evida.local.sqlite3"))
}

pub fn default_data_dir() -> Result<PathBuf> {
    let base = dirs::data_local_dir()
        .context("Could not resolve local data directory")?
        .join("Evida");
    std::fs::create_dir_all(&base)?;
    Ok(base)
}

pub fn open_connection() -> Result<Connection> {
    let path = default_db_path()?;
    let conn = Connection::open(path)?;
    apply_schema(&conn)?;
    Ok(conn)
}

pub fn database_security_status() -> Result<DatabaseSecurityStatus> {
    let key_source = crate::db_key::resolve_db_key()?.source;
    let data_dir = default_data_dir()?;
    let plaintext_backups = std::fs::read_dir(&data_dir)?
        .filter_map(std::result::Result::ok)
        .filter(|entry| entry.file_name().to_string_lossy().contains("plaintext-backup"))
        .count() as i64;
    let encrypted_at_rest = true;
    let mut warnings = Vec::new();
    if key_source == "environment" {
        warnings.push("Database field key comes from environment variable; use OS credential store for production.".to_string());
    }
    if key_source.starts_with("local_key_file_fallback") {
        warnings.push("OS credential store was unavailable; field key is stored in local app data and should be moved before production rollout.".to_string());
    }
    if plaintext_backups > 0 {
        warnings.push("Plaintext database backup exists from migration; review and delete after validation.".to_string());
    }
    warnings.push("Sensitive legal text fields use AES-256-GCM; full-file SQLCipher is still required before broad production rollout.".to_string());

    Ok(DatabaseSecurityStatus {
        encrypted_at_rest,
        cipher: "AES-256-GCM field encryption".to_string(),
        key_source,
        database_path: default_db_path()?.display().to_string(),
        plaintext_backups,
        warnings,
    })
}

pub fn apply_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS cases (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            jurisdiction TEXT NOT NULL DEFAULT 'NO',
            status TEXT NOT NULL DEFAULT 'active',
            source_coverage_percent REAL NOT NULL DEFAULT 0,
            risk_level TEXT NOT NULL DEFAULT 'unknown',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            original_name TEXT NOT NULL,
            local_path TEXT NOT NULL,
            mime_type TEXT,
            sha256 TEXT NOT NULL,
            page_count INTEGER NOT NULL DEFAULT 0,
            ocr_status TEXT NOT NULL DEFAULT 'not_started',
            ocr_quality REAL,
            bates_start TEXT,
            bates_end TEXT,
            exhibit_id TEXT,
            imported_at TEXT NOT NULL,
            UNIQUE(case_id, sha256)
        );

        CREATE TABLE IF NOT EXISTS pages (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            page_number INTEGER NOT NULL,
            sha256 TEXT,
            text_status TEXT NOT NULL DEFAULT 'not_extracted',
            ocr_confidence REAL,
            created_at TEXT NOT NULL,
            UNIQUE(document_id, page_number)
        );

        CREATE TABLE IF NOT EXISTS chunks (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            page_start INTEGER NOT NULL,
            page_end INTEGER NOT NULL,
            text TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS source_objects (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            chunk_id TEXT REFERENCES chunks(id) ON DELETE SET NULL,
            page_start INTEGER NOT NULL,
            page_end INTEGER NOT NULL,
            bates_start TEXT,
            bates_end TEXT,
            text_excerpt TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            ocr_confidence REAL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_events (
            id TEXT PRIMARY KEY,
            case_id TEXT,
            actor TEXT NOT NULL,
            action TEXT NOT NULL,
            target_type TEXT NOT NULL,
            target_id TEXT NOT NULL,
            result TEXT NOT NULL,
            details_json TEXT,
            created_at TEXT NOT NULL,
            sequence_number INTEGER NOT NULL DEFAULT 0,
            previous_event_hash TEXT,
            event_hash TEXT,
            canonical_payload_json TEXT
        );

        CREATE TABLE IF NOT EXISTS chronology_events (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            date_text TEXT NOT NULL,
            event TEXT NOT NULL,
            source_id TEXT NOT NULL,
            status TEXT NOT NULL,
            uncertainty TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS evidence_items (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            claim TEXT NOT NULL,
            supporting_source_ids_json TEXT NOT NULL,
            weakening_source_ids_json TEXT NOT NULL,
            strength TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS argument_items (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            argument TEXT NOT NULL,
            factual_basis TEXT NOT NULL,
            legal_basis TEXT NOT NULL,
            evidence_source_ids_json TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS contradiction_items (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            topic TEXT NOT NULL,
            source_a_id TEXT NOT NULL,
            source_b_id TEXT NOT NULL,
            conflict TEXT NOT NULL,
            significance TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS risk_items (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            risk TEXT NOT NULL,
            severity TEXT NOT NULL,
            affected_arguments TEXT NOT NULL,
            source_basis TEXT NOT NULL,
            recommended_action TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS case_ai_sessions (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS case_ai_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES case_ai_sessions(id) ON DELETE CASCADE,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            answer_json TEXT,
            model_id TEXT,
            prompt_version TEXT,
            source_index_version TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS case_ai_message_sources (
            id TEXT PRIMARY KEY,
            message_id TEXT NOT NULL REFERENCES case_ai_messages(id) ON DELETE CASCADE,
            source_id TEXT NOT NULL,
            document_id TEXT NOT NULL,
            page_number INTEGER,
            validation_status TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_documents_case ON documents(case_id);
        CREATE INDEX IF NOT EXISTS idx_pages_document ON pages(document_id);
        CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
        CREATE INDEX IF NOT EXISTS idx_source_case ON source_objects(case_id);
        CREATE INDEX IF NOT EXISTS idx_source_document ON source_objects(document_id);
        CREATE INDEX IF NOT EXISTS idx_audit_case ON audit_events(case_id);
        CREATE INDEX IF NOT EXISTS idx_chronology_case ON chronology_events(case_id);
        CREATE INDEX IF NOT EXISTS idx_evidence_case ON evidence_items(case_id);
        CREATE INDEX IF NOT EXISTS idx_argument_case ON argument_items(case_id);
        CREATE INDEX IF NOT EXISTS idx_contradiction_case ON contradiction_items(case_id);
        CREATE INDEX IF NOT EXISTS idx_risk_case ON risk_items(case_id);
        CREATE INDEX IF NOT EXISTS idx_case_ai_sessions_case ON case_ai_sessions(case_id);
        CREATE INDEX IF NOT EXISTS idx_case_ai_messages_case ON case_ai_messages(case_id);
        CREATE INDEX IF NOT EXISTS idx_case_ai_message_sources_message ON case_ai_message_sources(message_id);
        "#,
    )?;

    add_column_if_missing(conn, "documents", "mime_type", "TEXT")?;
    add_column_if_missing(conn, "documents", "ocr_quality", "REAL")?;
    add_column_if_missing(conn, "documents", "exhibit_id", "TEXT")?;
    add_column_if_missing(conn, "cases", "deleted_at", "TEXT")?;
    add_column_if_missing(conn, "audit_events", "sequence_number", "INTEGER NOT NULL DEFAULT 0")?;
    add_column_if_missing(conn, "audit_events", "previous_event_hash", "TEXT")?;
    add_column_if_missing(conn, "audit_events", "event_hash", "TEXT")?;
    add_column_if_missing(conn, "audit_events", "canonical_payload_json", "TEXT")?;
    encrypt_existing_sensitive_fields(conn)?;

    Ok(())
}

fn encrypt_existing_sensitive_fields(conn: &Connection) -> Result<()> {
    encrypt_existing_column(conn, "chunks", "text")?;
    encrypt_existing_column(conn, "source_objects", "text_excerpt")?;
    encrypt_existing_column(conn, "chronology_events", "event")?;
    encrypt_existing_column(conn, "evidence_items", "claim")?;
    encrypt_existing_column(conn, "argument_items", "argument")?;
    encrypt_existing_column(conn, "argument_items", "factual_basis")?;
    encrypt_existing_column(conn, "argument_items", "legal_basis")?;
    encrypt_existing_column(conn, "contradiction_items", "topic")?;
    encrypt_existing_column(conn, "contradiction_items", "conflict")?;
    encrypt_existing_column(conn, "risk_items", "risk")?;
    encrypt_existing_column(conn, "risk_items", "source_basis")?;
    encrypt_existing_column(conn, "risk_items", "recommended_action")?;
    encrypt_existing_column(conn, "case_ai_messages", "content")?;
    encrypt_existing_column(conn, "case_ai_messages", "answer_json")?;
    Ok(())
}

fn encrypt_existing_column(conn: &Connection, table: &str, column: &str) -> Result<()> {
    let sql = format!("SELECT id, {column} FROM {table} WHERE {column} NOT LIKE 'enc:v1:%'");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;
    let values = rows.collect::<std::result::Result<Vec<_>, _>>()?;
    drop(stmt);

    let update_sql = format!("UPDATE {table} SET {column} = ?1 WHERE id = ?2");
    for (id, value) in values {
        conn.execute(&update_sql, params![crate::crypto::encrypt_text(&value)?, id])?;
    }
    Ok(())
}

fn add_column_if_missing(conn: &Connection, table: &str, column: &str, definition: &str) -> Result<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let columns = stmt.query_map([], |row| row.get::<_, String>(1))?;
    for existing in columns {
        if existing? == column {
            return Ok(());
        }
    }
    conn.execute(&format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, definition), [])?;
    Ok(())
}

pub fn create_case(conn: &Connection, name: &str, jurisdiction: &str) -> Result<CaseSummary> {
    let id = format!("CASE-{}", Uuid::new_v4());
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO cases (id, name, jurisdiction, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'active', ?4, ?5)",
        params![id, name, jurisdiction, now, now],
    )?;

    crate::audit::append_audit_event(
        conn,
        Some(&id),
        "local-user",
        "case.create",
        "case",
        &id,
        "PASS",
        None,
    )?;

    get_case(conn, &id)
}

pub fn get_case(conn: &Connection, case_id: &str) -> Result<CaseSummary> {
    let mut stmt = conn.prepare(
        r#"
        SELECT
          c.id, c.name, c.jurisdiction, c.status,
          COALESCE(COUNT(d.id), 0) AS document_count,
          COALESCE(SUM(d.page_count), 0) AS page_count,
          c.source_coverage_percent,
          c.risk_level,
          c.updated_at
        FROM cases c
        LEFT JOIN documents d ON d.case_id = c.id
        WHERE c.id = ?1 AND c.deleted_at IS NULL
        GROUP BY c.id
        "#,
    )?;

    let item = stmt.query_row(params![case_id], |row| {
        Ok(CaseSummary {
            id: row.get(0)?,
            name: row.get(1)?,
            jurisdiction: row.get(2)?,
            status: row.get(3)?,
            document_count: row.get(4)?,
            page_count: row.get(5)?,
            source_coverage_percent: row.get(6)?,
            risk_level: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })?;

    Ok(item)
}

pub fn list_cases(conn: &Connection) -> Result<Vec<CaseSummary>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT
          c.id, c.name, c.jurisdiction, c.status,
          COALESCE(COUNT(d.id), 0) AS document_count,
          COALESCE(SUM(d.page_count), 0) AS page_count,
          c.source_coverage_percent,
          c.risk_level,
          c.updated_at
        FROM cases c
        LEFT JOIN documents d ON d.case_id = c.id
        WHERE c.deleted_at IS NULL
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(CaseSummary {
            id: row.get(0)?,
            name: row.get(1)?,
            jurisdiction: row.get(2)?,
            status: row.get(3)?,
            document_count: row.get(4)?,
            page_count: row.get(5)?,
            source_coverage_percent: row.get(6)?,
            risk_level: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })?;

    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn soft_delete_case(conn: &Connection, case_id: &str) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE cases SET status = 'deleted', deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        params![now, case_id],
    )?;

    crate::audit::append_audit_event(
        conn,
        Some(case_id),
        "local-user",
        "CASE_SOFT_DELETED",
        "case",
        case_id,
        "PASS",
        Some(r#"{"mode":"soft_delete"}"#),
    )?;

    Ok(())
}

pub fn reset_test_data(conn: &Connection) -> Result<MaintenanceReport> {
    let cases_deleted = count_table(conn, "cases")?;
    let documents_deleted = count_table(conn, "documents")?;
    let sources_deleted = count_table(conn, "source_objects")?;

    conn.execute("DELETE FROM source_objects", [])?;
    conn.execute("DELETE FROM chronology_events", [])?;
    conn.execute("DELETE FROM evidence_items", [])?;
    conn.execute("DELETE FROM argument_items", [])?;
    conn.execute("DELETE FROM contradiction_items", [])?;
    conn.execute("DELETE FROM risk_items", [])?;
    conn.execute("DELETE FROM case_ai_message_sources", [])?;
    conn.execute("DELETE FROM case_ai_messages", [])?;
    conn.execute("DELETE FROM case_ai_sessions", [])?;
    conn.execute("DELETE FROM chunks", [])?;
    conn.execute("DELETE FROM pages", [])?;
    conn.execute("DELETE FROM documents", [])?;
    conn.execute("DELETE FROM cases", [])?;
    conn.execute("DELETE FROM audit_events", [])?;

    Ok(MaintenanceReport {
        message: "Alle lokale testdata er slettet.".to_string(),
        path: Some(default_data_dir()?.display().to_string()),
        cases_deleted: Some(cases_deleted),
        documents_deleted: Some(documents_deleted),
        sources_deleted: Some(sources_deleted),
    })
}

pub fn export_diagnostics(conn: &Connection) -> Result<MaintenanceReport> {
    let dir = default_data_dir()?.join("diagnostics");
    std::fs::create_dir_all(&dir)?;
    let path = dir.join(format!(
        "evida-diagnostics-{}.json",
        Utc::now().format("%Y%m%d-%H%M%S")
    ));
    let payload = serde_json::json!({
        "generated_at": Utc::now().to_rfc3339(),
        "mode": "evaluation_build",
        "database_path": default_db_path()?.display().to_string(),
        "security": database_security_status()?,
        "counts": {
            "active_cases": list_cases(conn)?.len(),
            "total_cases": count_table(conn, "cases")?,
            "documents": count_table(conn, "documents")?,
            "pages": count_table(conn, "pages")?,
            "source_objects": count_table(conn, "source_objects")?,
            "chronology_events": count_table(conn, "chronology_events")?,
            "evidence_items": count_table(conn, "evidence_items")?,
            "argument_items": count_table(conn, "argument_items")?,
            "contradiction_items": count_table(conn, "contradiction_items")?,
            "risk_items": count_table(conn, "risk_items")?,
            "case_ai_messages": count_table(conn, "case_ai_messages")?,
            "audit_events": count_table(conn, "audit_events")?
        }
    });
    std::fs::write(&path, serde_json::to_string_pretty(&payload)?)?;

    Ok(MaintenanceReport {
        message: "Diagnosepakke eksportert.".to_string(),
        path: Some(path.display().to_string()),
        cases_deleted: None,
        documents_deleted: None,
        sources_deleted: None,
    })
}

fn count_table(conn: &Connection, table: &str) -> Result<i64> {
    let sql = format!("SELECT COUNT(*) FROM {}", table);
    Ok(conn.query_row(&sql, [], |row| row.get(0))?)
}

pub fn insert_document(
    conn: &Connection,
    case_id: &str,
    original_name: &str,
    local_path: &str,
    sha256: &str,
    extraction: &DocumentExtraction,
) -> Result<DocumentIngestionReport> {
    let id = format!("DOC-{}", Uuid::new_v4());
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO documents
         (id, case_id, original_name, local_path, mime_type, sha256, page_count, ocr_status, imported_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            case_id,
            original_name,
            local_path,
            extraction.mime_type.as_deref(),
            sha256,
            extraction.page_count,
            extraction.ocr_status.as_str(),
            now
        ],
    )?;

    let mut pages_created = 0;
    for page in &extraction.pages {
        conn.execute(
            "INSERT INTO pages (id, document_id, page_number, sha256, text_status, ocr_confidence, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                format!("PAG-{}", Uuid::new_v4()),
                id,
                page.page_number,
                page.sha256,
                page.text_status,
                None::<f64>,
                now
            ],
        )?;
        pages_created += 1;
    }

    let mut chunks_created = 0;
    let mut sources_created = 0;
    for chunk in &extraction.chunks {
        let chunk_id = format!("CHK-{}", Uuid::new_v4());
        conn.execute(
            "INSERT INTO chunks (id, document_id, page_start, page_end, text, sha256, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                chunk_id,
                id,
                chunk.page_start,
                chunk.page_end,
                crate::crypto::encrypt_text(&chunk.text)?,
                chunk.sha256,
                now
            ],
        )?;
        chunks_created += 1;

        let source_hash = crate::hash::sha256_text(&format!(
            "{}:{}:{}:{}",
            id, chunk.page_start, chunk.page_end, chunk.sha256
        ));
        conn.execute(
            "INSERT INTO source_objects
             (id, case_id, document_id, chunk_id, page_start, page_end, text_excerpt, sha256, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                format!("SRC-{}", Uuid::new_v4()),
                case_id,
                id,
                chunk_id,
                chunk.page_start,
                chunk.page_end,
                crate::crypto::encrypt_text(&truncate_excerpt(&chunk.text))?,
                source_hash,
                now
            ],
        )?;
        sources_created += 1;
    }

    conn.execute(
        "UPDATE cases
         SET updated_at = ?1,
             source_coverage_percent = (
                SELECT CASE
                  WHEN COALESCE(SUM(page_count), 0) = 0 THEN 0
                  ELSE MIN(100, ROUND((COUNT(DISTINCT source_objects.document_id || ':' || source_objects.page_start) * 100.0) / SUM(documents.page_count), 2))
                END
                FROM documents
                LEFT JOIN source_objects ON source_objects.document_id = documents.id
                WHERE documents.case_id = ?2
             )
         WHERE id = ?2",
        params![now, case_id],
    )?;

    crate::audit::append_audit_event(
        conn,
        Some(case_id),
        "local-user",
        "document.register",
        "document",
        &id,
        "PASS",
        Some(&format!(
            r#"{{"sha256":"{}","page_count":{},"sources_created":{},"ocr_status":"{}"}}"#,
            sha256, extraction.page_count, sources_created, extraction.ocr_status
        )),
    )?;

    Ok(DocumentIngestionReport {
        document: get_document(conn, &id)?,
        sources_created,
        pages_created,
        chunks_created,
        warnings: extraction.warnings.clone(),
    })
}

pub fn reindex_case_documents(conn: &Connection, case_id: &str) -> Result<ReindexReport> {
    let mut stmt = conn.prepare(
        "SELECT id, local_path FROM documents WHERE case_id = ?1 ORDER BY imported_at ASC",
    )?;
    let document_rows = stmt.query_map(params![case_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    let documents = document_rows.collect::<std::result::Result<Vec<_>, _>>()?;

    let mut report = ReindexReport {
        documents_processed: 0,
        sources_created: 0,
        pages_created: 0,
        chunks_created: 0,
        warnings: vec![],
    };

    for (document_id, local_path) in documents {
        match crate::ingestion::extract_document(Path::new(&local_path)) {
            Ok(extraction) => {
                let next = replace_document_extraction(conn, case_id, &document_id, &extraction)?;
                report.documents_processed += 1;
                report.sources_created += next.sources_created;
                report.pages_created += next.pages_created;
                report.chunks_created += next.chunks_created;
                report.warnings.extend(next.warnings);
            }
            Err(error) => report.warnings.push(format!("{}: {}", document_id, error)),
        }
    }

    let now = Utc::now().to_rfc3339();
    update_case_source_coverage(conn, case_id, &now)?;
    crate::audit::append_audit_event(
        conn,
        Some(case_id),
        "local-user",
        "document.reindex",
        "case",
        case_id,
        if report.warnings.is_empty() { "PASS" } else { "WARN" },
        Some(&format!(
            r#"{{"documents_processed":{},"sources_created":{},"warnings":{}}}"#,
            report.documents_processed,
            report.sources_created,
            report.warnings.len()
        )),
    )?;

    Ok(report)
}

fn replace_document_extraction(
    conn: &Connection,
    case_id: &str,
    document_id: &str,
    extraction: &DocumentExtraction,
) -> Result<ReindexReport> {
    let now = Utc::now().to_rfc3339();
    conn.execute("DELETE FROM source_objects WHERE document_id = ?1", params![document_id])?;
    conn.execute("DELETE FROM chunks WHERE document_id = ?1", params![document_id])?;
    conn.execute("DELETE FROM pages WHERE document_id = ?1", params![document_id])?;
    conn.execute(
        "UPDATE documents SET mime_type = ?1, page_count = ?2, ocr_status = ?3 WHERE id = ?4",
        params![
            extraction.mime_type.as_deref(),
            extraction.page_count,
            extraction.ocr_status.as_str(),
            document_id
        ],
    )?;

    let mut pages_created = 0;
    for page in &extraction.pages {
        conn.execute(
            "INSERT INTO pages (id, document_id, page_number, sha256, text_status, ocr_confidence, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                format!("PAG-{}", Uuid::new_v4()),
                document_id,
                page.page_number,
                page.sha256,
                page.text_status,
                None::<f64>,
                now
            ],
        )?;
        pages_created += 1;
    }

    let mut chunks_created = 0;
    let mut sources_created = 0;
    for chunk in &extraction.chunks {
        let chunk_id = format!("CHK-{}", Uuid::new_v4());
        conn.execute(
            "INSERT INTO chunks (id, document_id, page_start, page_end, text, sha256, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                chunk_id,
                document_id,
                chunk.page_start,
                chunk.page_end,
                crate::crypto::encrypt_text(&chunk.text)?,
                chunk.sha256,
                now
            ],
        )?;
        chunks_created += 1;

        let source_hash = crate::hash::sha256_text(&format!(
            "{}:{}:{}:{}",
            document_id, chunk.page_start, chunk.page_end, chunk.sha256
        ));
        conn.execute(
            "INSERT INTO source_objects
             (id, case_id, document_id, chunk_id, page_start, page_end, text_excerpt, sha256, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                format!("SRC-{}", Uuid::new_v4()),
                case_id,
                document_id,
                chunk_id,
                chunk.page_start,
                chunk.page_end,
                crate::crypto::encrypt_text(&truncate_excerpt(&chunk.text))?,
                source_hash,
                now
            ],
        )?;
        sources_created += 1;
    }

    Ok(ReindexReport {
        documents_processed: 1,
        sources_created,
        pages_created,
        chunks_created,
        warnings: extraction.warnings.clone(),
    })
}

fn update_case_source_coverage(conn: &Connection, case_id: &str, now: &str) -> Result<()> {
    conn.execute(
        "UPDATE cases
         SET updated_at = ?1,
             source_coverage_percent = (
                SELECT CASE
                  WHEN COALESCE(SUM(page_count), 0) = 0 THEN 0
                  ELSE MIN(100, ROUND((COUNT(DISTINCT source_objects.document_id || ':' || source_objects.page_start) * 100.0) / SUM(documents.page_count), 2))
                END
                FROM documents
                LEFT JOIN source_objects ON source_objects.document_id = documents.id
                WHERE documents.case_id = ?2
             )
         WHERE id = ?2",
        params![now, case_id],
    )?;
    Ok(())
}

fn truncate_excerpt(value: &str) -> String {
    let max_chars = 500;
    value.chars().take(max_chars).collect()
}

pub fn get_document(conn: &Connection, document_id: &str) -> Result<DocumentSummary> {
    let mut stmt = conn.prepare(
        r#"
        SELECT
          d.id, d.case_id, d.original_name, d.local_path, d.mime_type, d.sha256,
          d.page_count, d.ocr_status,
          COALESCE(COUNT(s.id), 0) AS source_count,
          CASE WHEN d.page_count = 0 THEN 0 ELSE MIN(100, ROUND((COUNT(DISTINCT s.page_start) * 100.0) / d.page_count, 2)) END AS source_coverage_percent,
          (SELECT COUNT(DISTINCT s2.page_start) FROM source_objects s2 WHERE s2.document_id = d.id) AS analyzed_page_count,
          (SELECT COUNT(*) FROM pages p WHERE p.document_id = d.id AND p.text_status = 'needs_ocr') AS pending_ocr_page_count,
          d.bates_start, d.bates_end, d.exhibit_id, d.imported_at
        FROM documents d
        LEFT JOIN source_objects s ON s.document_id = d.id
        WHERE d.id = ?1
        GROUP BY d.id
        "#,
    )?;

    let item = stmt.query_row(params![document_id], |row| {
        Ok(DocumentSummary {
            id: row.get(0)?,
            case_id: row.get(1)?,
            original_name: row.get(2)?,
            local_path: row.get(3)?,
            mime_type: row.get(4)?,
            sha256: row.get(5)?,
            page_count: row.get(6)?,
            ocr_status: row.get(7)?,
            source_count: row.get(8)?,
            source_coverage_percent: row.get(9)?,
            analyzed_page_count: row.get(10)?,
            pending_ocr_page_count: row.get(11)?,
            bates_start: row.get(12)?,
            bates_end: row.get(13)?,
            exhibit_id: row.get(14)?,
            imported_at: row.get(15)?,
        })
    })?;

    Ok(item)
}

pub fn list_documents(conn: &Connection, case_id: &str) -> Result<Vec<DocumentSummary>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT
          d.id, d.case_id, d.original_name, d.local_path, d.mime_type, d.sha256,
          d.page_count, d.ocr_status,
          COALESCE(COUNT(s.id), 0) AS source_count,
          CASE WHEN d.page_count = 0 THEN 0 ELSE MIN(100, ROUND((COUNT(DISTINCT s.page_start) * 100.0) / d.page_count, 2)) END AS source_coverage_percent,
          (SELECT COUNT(DISTINCT s2.page_start) FROM source_objects s2 WHERE s2.document_id = d.id) AS analyzed_page_count,
          (SELECT COUNT(*) FROM pages p WHERE p.document_id = d.id AND p.text_status = 'needs_ocr') AS pending_ocr_page_count,
          d.bates_start, d.bates_end, d.exhibit_id, d.imported_at
        FROM documents d
        LEFT JOIN source_objects s ON s.document_id = d.id
        WHERE d.case_id = ?1
        GROUP BY d.id
        ORDER BY d.imported_at DESC
        "#,
    )?;

    let rows = stmt.query_map(params![case_id], |row| {
        Ok(DocumentSummary {
            id: row.get(0)?,
            case_id: row.get(1)?,
            original_name: row.get(2)?,
            local_path: row.get(3)?,
            mime_type: row.get(4)?,
            sha256: row.get(5)?,
            page_count: row.get(6)?,
            ocr_status: row.get(7)?,
            source_count: row.get(8)?,
            source_coverage_percent: row.get(9)?,
            analyzed_page_count: row.get(10)?,
            pending_ocr_page_count: row.get(11)?,
            bates_start: row.get(12)?,
            bates_end: row.get(13)?,
            exhibit_id: row.get(14)?,
            imported_at: row.get(15)?,
        })
    })?;

    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn list_audit_events(conn: &Connection, case_id: Option<&str>) -> Result<Vec<AuditEvent>> {
    let sql = if case_id.is_some() {
        "SELECT id, case_id, actor, action, target_type, target_id, result, created_at
         FROM audit_events WHERE case_id = ?1 ORDER BY created_at DESC LIMIT 200"
    } else {
        "SELECT id, case_id, actor, action, target_type, target_id, result, created_at
         FROM audit_events ORDER BY created_at DESC LIMIT 200"
    };

    let mut stmt = conn.prepare(sql)?;

    let mapper = |row: &rusqlite::Row<'_>| {
        Ok(AuditEvent {
            id: row.get(0)?,
            case_id: row.get(1)?,
            actor: row.get(2)?,
            action: row.get(3)?,
            target_type: row.get(4)?,
            target_id: row.get(5)?,
            result: row.get(6)?,
            created_at: row.get(7)?,
        })
    };

    let rows = if let Some(case_id) = case_id {
        stmt.query_map(params![case_id], mapper)?
            .collect::<std::result::Result<Vec<_>, _>>()?
    } else {
        stmt.query_map([], mapper)?
            .collect::<std::result::Result<Vec<_>, _>>()?
    };

    Ok(rows)
}

pub fn list_source_objects(conn: &Connection, case_id: &str) -> Result<Vec<SourceObjectSummary>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT id, case_id, document_id, chunk_id, page_start, page_end, text_excerpt, sha256, created_at
        FROM source_objects
        WHERE case_id = ?1
        ORDER BY created_at DESC
        LIMIT 500
        "#,
    )?;

    let rows = stmt.query_map(params![case_id], |row| {
        Ok(SourceObjectSummary {
            id: row.get(0)?,
            case_id: row.get(1)?,
            document_id: row.get(2)?,
            chunk_id: row.get(3)?,
            page_start: row.get(4)?,
            page_end: row.get(5)?,
            text_excerpt: crate::crypto::decrypt_text(&row.get::<_, String>(6)?),
            sha256: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?;

    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn list_work_items(conn: &Connection, case_id: &str) -> Result<WorkItems> {
    Ok(WorkItems {
        chronology: list_chronology_events(conn, case_id)?,
        evidence: list_evidence_items(conn, case_id)?,
        arguments: list_argument_items(conn, case_id)?,
        contradictions: list_contradiction_items(conn, case_id)?,
        risks: list_risk_items(conn, case_id)?,
    })
}

pub fn build_chronology(conn: &Connection, case_id: &str) -> Result<Vec<ChronologyEvent>> {
    let sources = list_source_objects(conn, case_id)?;
    if sources.is_empty() {
        anyhow::bail!("Kronologi trenger kildeobjekter.");
    }
    let now = Utc::now().to_rfc3339();
    conn.execute("DELETE FROM chronology_events WHERE case_id = ?1", params![case_id])?;
    for (index, source) in sources.iter().take(20).enumerate() {
        let date_text = extract_date_text(&source.text_excerpt);
        conn.execute(
            "INSERT INTO chronology_events
             (id, case_id, date_text, event, source_id, status, uncertainty, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                format!("TL-{}", Uuid::new_v4()),
                case_id,
                date_text,
                crate::crypto::encrypt_text(&first_sentence(&source.text_excerpt))?,
                source.id,
                if index == 0 { "Til kontroll" } else { "Utkast" },
                if date_text == "Udatert" { "Høy" } else { "Middels" },
                now,
                now
            ],
        )?;
    }
    append_work_audit(conn, case_id, "work.chronology.build", "chronology")?;
    list_chronology_events(conn, case_id)
}

pub fn build_evidence_matrix(conn: &Connection, case_id: &str) -> Result<Vec<EvidenceItem>> {
    let sources = list_source_objects(conn, case_id)?;
    if sources.is_empty() {
        anyhow::bail!("Bevismatrise trenger kildeobjekter.");
    }
    let now = Utc::now().to_rfc3339();
    let supporting: Vec<String> = sources.iter().take(3).map(|source| source.id.clone()).collect();
    let weakening: Vec<String> = sources.iter().skip(3).take(2).map(|source| source.id.clone()).collect();
    conn.execute("DELETE FROM evidence_items WHERE case_id = ?1", params![case_id])?;
    conn.execute(
        "INSERT INTO evidence_items
         (id, case_id, claim, supporting_source_ids_json, weakening_source_ids_json, strength, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            format!("EV-{}", Uuid::new_v4()),
            case_id,
            crate::crypto::encrypt_text("Foreløpig hovedpåstand basert på importerte kilder")?,
            serde_json::to_string(&supporting)?,
            serde_json::to_string(&weakening)?,
            if supporting.len() >= 2 { "Middels" } else { "Svak" },
            "Utkast",
            now,
            now
        ],
    )?;
    append_work_audit(conn, case_id, "work.evidence.build", "evidence")?;
    list_evidence_items(conn, case_id)
}

pub fn create_argument_item(conn: &Connection, case_id: &str) -> Result<Vec<ArgumentItem>> {
    let sources = list_source_objects(conn, case_id)?;
    if sources.is_empty() {
        anyhow::bail!("Anførsler trenger kildeobjekter.");
    }
    let now = Utc::now().to_rfc3339();
    let linked: Vec<String> = sources.iter().take(2).map(|source| source.id.clone()).collect();
    conn.execute(
        "INSERT INTO argument_items
         (id, case_id, argument, factual_basis, legal_basis, evidence_source_ids_json, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            format!("ARG-{}", Uuid::new_v4()),
            case_id,
            crate::crypto::encrypt_text("Foreløpig anførsel")?,
            crate::crypto::encrypt_text(&first_sentence(&sources[0].text_excerpt))?,
            crate::crypto::encrypt_text("Ikke vurdert")?,
            serde_json::to_string(&linked)?,
            "Må kvalitetssikres",
            now,
            now
        ],
    )?;
    append_work_audit(conn, case_id, "work.argument.create", "argument")?;
    list_argument_items(conn, case_id)
}

pub fn find_contradictions(conn: &Connection, case_id: &str) -> Result<Vec<ContradictionItem>> {
    let sources = list_source_objects(conn, case_id)?;
    if sources.len() < 2 {
        anyhow::bail!("Motstridsanalyse trenger minst to kildeobjekter.");
    }
    let now = Utc::now().to_rfc3339();
    conn.execute("DELETE FROM contradiction_items WHERE case_id = ?1", params![case_id])?;
    conn.execute(
        "INSERT INTO contradiction_items
         (id, case_id, topic, source_a_id, source_b_id, conflict, significance, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            format!("CON-{}", Uuid::new_v4()),
            case_id,
            crate::crypto::encrypt_text("Mulig avvik i faktum")?,
            sources[0].id,
            sources[1].id,
            crate::crypto::encrypt_text("Kildene bør sammenlignes manuelt før konklusjon.")?,
            "Middels",
            "Til kontroll",
            now,
            now
        ],
    )?;
    append_work_audit(conn, case_id, "work.contradictions.find", "contradiction")?;
    list_contradiction_items(conn, case_id)
}

pub fn assess_risk(conn: &Connection, case_id: &str) -> Result<Vec<RiskItem>> {
    let sources = list_source_objects(conn, case_id)?;
    if sources.is_empty() {
        anyhow::bail!("Risikovurdering trenger kildeobjekter.");
    }
    let docs = list_documents(conn, case_id)?;
    let needs_ocr = docs.iter().any(|doc| doc.pending_ocr_page_count > 0);
    let arguments = list_argument_items(conn, case_id)?;
    let now = Utc::now().to_rfc3339();
    conn.execute("DELETE FROM risk_items WHERE case_id = ?1", params![case_id])?;
    conn.execute(
        "INSERT INTO risk_items
         (id, case_id, risk, severity, affected_arguments, source_basis, recommended_action, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            format!("RSK-{}", Uuid::new_v4()),
            case_id,
            crate::crypto::encrypt_text(if needs_ocr { "Ufullstendig tekstgrunnlag" } else { "Kildegrunnlag ikke juridisk kvalitetssikret" })?,
            if needs_ocr { "Høy" } else { "Middels" },
            if arguments.is_empty() {
                "Ikke koblet".to_string()
            } else {
                arguments.iter().map(|item| item.id.clone()).collect::<Vec<_>>().join(", ")
            },
            crate::crypto::encrypt_text(&format!("{} kildeobjekter", sources.len()))?,
            crate::crypto::encrypt_text(if needs_ocr { "Kjør OCR/tekstkontroll før saksarbeid." } else { "Kontroller kilder og knytt dem til påstander." })?,
            now,
            now
        ],
    )?;
    append_work_audit(conn, case_id, "work.risk.assess", "risk")?;
    list_risk_items(conn, case_id)
}

fn list_chronology_events(conn: &Connection, case_id: &str) -> Result<Vec<ChronologyEvent>> {
    let mut stmt = conn.prepare(
        "SELECT id, case_id, date_text, event, source_id, status, uncertainty, updated_at
         FROM chronology_events WHERE case_id = ?1 ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map(params![case_id], |row| {
        Ok(ChronologyEvent {
            id: row.get(0)?,
            case_id: row.get(1)?,
            date_text: row.get(2)?,
            event: crate::crypto::decrypt_text(&row.get::<_, String>(3)?),
            source_id: row.get(4)?,
            status: row.get(5)?,
            uncertainty: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

fn list_evidence_items(conn: &Connection, case_id: &str) -> Result<Vec<EvidenceItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, case_id, claim, supporting_source_ids_json, weakening_source_ids_json, strength, status, updated_at
         FROM evidence_items WHERE case_id = ?1 ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map(params![case_id], |row| {
        Ok(EvidenceItem {
            id: row.get(0)?,
            case_id: row.get(1)?,
            claim: crate::crypto::decrypt_text(&row.get::<_, String>(2)?),
            supporting_source_ids: parse_json_vec(row.get::<_, String>(3)?),
            weakening_source_ids: parse_json_vec(row.get::<_, String>(4)?),
            strength: row.get(5)?,
            status: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

fn list_argument_items(conn: &Connection, case_id: &str) -> Result<Vec<ArgumentItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, case_id, argument, factual_basis, legal_basis, evidence_source_ids_json, status, updated_at
         FROM argument_items WHERE case_id = ?1 ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map(params![case_id], |row| {
        Ok(ArgumentItem {
            id: row.get(0)?,
            case_id: row.get(1)?,
            argument: crate::crypto::decrypt_text(&row.get::<_, String>(2)?),
            factual_basis: crate::crypto::decrypt_text(&row.get::<_, String>(3)?),
            legal_basis: crate::crypto::decrypt_text(&row.get::<_, String>(4)?),
            evidence_source_ids: parse_json_vec(row.get::<_, String>(5)?),
            status: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

fn list_contradiction_items(conn: &Connection, case_id: &str) -> Result<Vec<ContradictionItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, case_id, topic, source_a_id, source_b_id, conflict, significance, status, updated_at
         FROM contradiction_items WHERE case_id = ?1 ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map(params![case_id], |row| {
        Ok(ContradictionItem {
            id: row.get(0)?,
            case_id: row.get(1)?,
            topic: crate::crypto::decrypt_text(&row.get::<_, String>(2)?),
            source_a_id: row.get(3)?,
            source_b_id: row.get(4)?,
            conflict: crate::crypto::decrypt_text(&row.get::<_, String>(5)?),
            significance: row.get(6)?,
            status: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

fn list_risk_items(conn: &Connection, case_id: &str) -> Result<Vec<RiskItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, case_id, risk, severity, affected_arguments, source_basis, recommended_action, updated_at
         FROM risk_items WHERE case_id = ?1 ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map(params![case_id], |row| {
        Ok(RiskItem {
            id: row.get(0)?,
            case_id: row.get(1)?,
            risk: crate::crypto::decrypt_text(&row.get::<_, String>(2)?),
            severity: row.get(3)?,
            affected_arguments: row.get(4)?,
            source_basis: crate::crypto::decrypt_text(&row.get::<_, String>(5)?),
            recommended_action: crate::crypto::decrypt_text(&row.get::<_, String>(6)?),
            updated_at: row.get(7)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

fn parse_json_vec(value: String) -> Vec<String> {
    serde_json::from_str(&value).unwrap_or_default()
}

fn first_sentence(value: &str) -> String {
    let sentence = value
        .split(|character| matches!(character, '.' | '!' | '?'))
        .next()
        .unwrap_or(value)
        .trim();
    let mut output = sentence.chars().take(150).collect::<String>();
    if value.chars().count() > 150 {
        output.push_str("...");
    }
    if output.is_empty() {
        "Kildeutdrag uten tekst".to_string()
    } else {
        output
    }
}

fn extract_date_text(value: &str) -> String {
    for token in value.split_whitespace() {
        let cleaned = token.trim_matches(|c: char| !c.is_ascii_digit() && c != '.' && c != '/' && c != '-');
        let separators = cleaned.matches('.').count() + cleaned.matches('/').count() + cleaned.matches('-').count();
        if separators == 2 && cleaned.chars().filter(|c| c.is_ascii_digit()).count() >= 6 {
            return cleaned.to_string();
        }
    }
    "Udatert".to_string()
}

pub fn record_case_ai_exchange(
    conn: &Connection,
    case_id: &str,
    question: &str,
    answer_json: &str,
    source_ids: &[String],
    model_id: Option<&str>,
    prompt_version: Option<&str>,
    source_index_version: Option<&str>,
) -> Result<CaseAiMessage> {
    let now = Utc::now().to_rfc3339();
    let session_id = ensure_case_ai_session(conn, case_id, &now)?;
    let user_message_id = format!("AIMSG-{}", Uuid::new_v4());
    let answer_message_id = format!("AIMSG-{}", Uuid::new_v4());

    conn.execute(
        "INSERT INTO case_ai_messages
         (id, session_id, case_id, role, content, answer_json, model_id, prompt_version, source_index_version, created_at)
         VALUES (?1, ?2, ?3, 'user', ?4, NULL, ?5, ?6, ?7, ?8)",
        params![
            user_message_id,
            session_id,
            case_id,
            crate::crypto::encrypt_text(question)?,
            model_id,
            prompt_version,
            source_index_version,
            now
        ],
    )?;
    conn.execute(
        "INSERT INTO case_ai_messages
         (id, session_id, case_id, role, content, answer_json, model_id, prompt_version, source_index_version, created_at)
         VALUES (?1, ?2, ?3, 'assistant', ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            answer_message_id,
            session_id,
            case_id,
            crate::crypto::encrypt_text(answer_json)?,
            crate::crypto::encrypt_text(answer_json)?,
            model_id,
            prompt_version,
            source_index_version,
            now
        ],
    )?;

    crate::audit::append_audit_event(
        conn,
        Some(case_id),
        "local-user",
        "CASE_AI_QUESTION_ASKED",
        "case_ai_message",
        &user_message_id,
        "PASS",
        None,
    )?;

    let mut validation_failed = false;
    let mut persisted_sources = Vec::new();
    for source_id in source_ids {
        let validation = validate_source_for_case(conn, case_id, source_id)?;
        if validation.validation_status != "PASS" {
            validation_failed = true;
        }
        let row_id = format!("AIMSRC-{}", Uuid::new_v4());
        conn.execute(
            "INSERT INTO case_ai_message_sources
             (id, message_id, source_id, document_id, page_number, validation_status, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                row_id,
                answer_message_id,
                source_id,
                validation.document_id,
                validation.page_number,
                validation.validation_status,
                now
            ],
        )?;
        crate::audit::append_audit_event(
            conn,
            Some(case_id),
            "local-user",
            if validation.validation_status == "PASS" {
                "CASE_AI_SOURCE_VALIDATED"
            } else {
                "CASE_AI_SOURCE_VALIDATION_FAILED"
            },
            "source_object",
            source_id,
            if validation.validation_status == "PASS" { "PASS" } else { "FAIL" },
            None,
        )?;
        persisted_sources.push(CaseAiMessageSource {
            id: row_id,
            message_id: answer_message_id.clone(),
            source_id: source_id.clone(),
            document_id: validation.document_id,
            page_number: validation.page_number,
            validation_status: validation.validation_status,
            created_at: now.clone(),
        });
    }

    crate::audit::append_audit_event(
        conn,
        Some(case_id),
        "local-user",
        "CASE_AI_ANSWER_GENERATED",
        "case_ai_message",
        &answer_message_id,
        if validation_failed { "WARN" } else { "PASS" },
        Some(&serde_json::json!({
            "model_id": model_id,
            "prompt_version": prompt_version,
            "source_index_version": source_index_version,
            "sources": source_ids.len(),
            "validation": if validation_failed { "failed" } else { "passed" }
        }).to_string()),
    )?;

    Ok(CaseAiMessage {
        id: answer_message_id,
        session_id,
        case_id: case_id.to_string(),
        role: "assistant".to_string(),
        content: answer_json.to_string(),
        answer_json: Some(answer_json.to_string()),
        model_id: model_id.map(ToString::to_string),
        prompt_version: prompt_version.map(ToString::to_string),
        source_index_version: source_index_version.map(ToString::to_string),
        created_at: now,
        sources: persisted_sources,
    })
}

pub fn list_case_ai_messages(conn: &Connection, case_id: &str) -> Result<Vec<CaseAiMessage>> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, case_id, role, content, answer_json, model_id, prompt_version, source_index_version, created_at
         FROM case_ai_messages
         WHERE case_id = ?1 AND role = 'assistant'
         ORDER BY created_at DESC
         LIMIT 50",
    )?;
    let rows = stmt.query_map(params![case_id], |row| {
        let message_id: String = row.get(0)?;
        Ok(CaseAiMessage {
            id: message_id.clone(),
            session_id: row.get(1)?,
            case_id: row.get(2)?,
            role: row.get(3)?,
            content: crate::crypto::decrypt_text(&row.get::<_, String>(4)?),
            answer_json: row
                .get::<_, Option<String>>(5)?
                .map(|value| crate::crypto::decrypt_text(&value)),
            model_id: row.get(6)?,
            prompt_version: row.get(7)?,
            source_index_version: row.get(8)?,
            created_at: row.get(9)?,
            sources: list_case_ai_message_sources(conn, &message_id).unwrap_or_default(),
        })
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

struct SourceValidation {
    document_id: String,
    page_number: Option<i64>,
    validation_status: String,
}

fn ensure_case_ai_session(conn: &Connection, case_id: &str, now: &str) -> Result<String> {
    if let Ok(id) = conn.query_row(
        "SELECT id FROM case_ai_sessions WHERE case_id = ?1 ORDER BY updated_at DESC LIMIT 1",
        params![case_id],
        |row| row.get::<_, String>(0),
    ) {
        conn.execute("UPDATE case_ai_sessions SET updated_at = ?1 WHERE id = ?2", params![now, id])?;
        return Ok(id);
    }
    let id = format!("AISES-{}", Uuid::new_v4());
    conn.execute(
        "INSERT INTO case_ai_sessions (id, case_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
        params![id, case_id, now],
    )?;
    Ok(id)
}

fn validate_source_for_case(conn: &Connection, case_id: &str, source_id: &str) -> Result<SourceValidation> {
    let found = conn.query_row(
        "SELECT document_id, page_start FROM source_objects WHERE id = ?1 AND case_id = ?2",
        params![source_id, case_id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
    );
    match found {
        Ok((document_id, page_number)) => Ok(SourceValidation {
            document_id,
            page_number: Some(page_number),
            validation_status: "PASS".to_string(),
        }),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(SourceValidation {
            document_id: "MISSING".to_string(),
            page_number: None,
            validation_status: "FAIL".to_string(),
        }),
        Err(error) => Err(error.into()),
    }
}

fn list_case_ai_message_sources(conn: &Connection, message_id: &str) -> Result<Vec<CaseAiMessageSource>> {
    let mut stmt = conn.prepare(
        "SELECT id, message_id, source_id, document_id, page_number, validation_status, created_at
         FROM case_ai_message_sources
         WHERE message_id = ?1
         ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(params![message_id], |row| {
        Ok(CaseAiMessageSource {
            id: row.get(0)?,
            message_id: row.get(1)?,
            source_id: row.get(2)?,
            document_id: row.get(3)?,
            page_number: row.get(4)?,
            validation_status: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

fn append_work_audit(conn: &Connection, case_id: &str, action: &str, target_type: &str) -> Result<()> {
    crate::audit::append_audit_event(
        conn,
        Some(case_id),
        "local-user",
        action,
        target_type,
        case_id,
        "PASS",
        None,
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn smoke_case_document_source_and_reindex_workflow() {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        apply_schema(&conn).expect("apply schema");
        let case = create_case(&conn, "Smoke sak", "NO").expect("create case");

        let path = std::env::temp_dir().join(format!("evida-smoke-{}.txt", Uuid::new_v4()));
        std::fs::write(
            &path,
            "Faktum: avtalen ble signert 12.03.2024. Beviset viser levering og reklamasjon.",
        )
        .expect("write smoke file");

        let sha256 = crate::hash::sha256_file(&path).expect("hash file");
        let extraction = crate::ingestion::extract_document(&path).expect("extract document");
        let report = insert_document(
            &conn,
            &case.id,
            "smoke.txt",
            path.to_str().expect("path utf8"),
            &sha256,
            &extraction,
        )
        .expect("insert document");

        assert_eq!(report.pages_created, 1);
        assert!(report.sources_created > 0);
        assert_eq!(list_documents(&conn, &case.id).expect("documents").len(), 1);
        assert!(!list_source_objects(&conn, &case.id).expect("sources").is_empty());
        assert!(!list_audit_events(&conn, Some(&case.id)).expect("audit").is_empty());
        let raw_excerpt: String = conn
            .query_row("SELECT text_excerpt FROM source_objects LIMIT 1", [], |row| row.get(0))
            .expect("raw encrypted excerpt");
        assert!(raw_excerpt.starts_with("enc:v1:"));

        let reindex = reindex_case_documents(&conn, &case.id).expect("reindex");
        assert_eq!(reindex.documents_processed, 1);
        assert!(reindex.sources_created > 0);

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn soft_delete_hides_case_and_writes_audit_event() {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        apply_schema(&conn).expect("apply schema");
        let case = create_case(&conn, "Slettbar sak", "NO").expect("create case");

        assert_eq!(list_cases(&conn).expect("list cases").len(), 1);
        soft_delete_case(&conn, &case.id).expect("soft delete");

        assert!(list_cases(&conn).expect("list cases after delete").is_empty());
        let audit = list_audit_events(&conn, Some(&case.id)).expect("audit");
        assert!(audit.iter().any(|event| event.action == "CASE_SOFT_DELETED"));
    }

    #[test]
    fn reset_test_data_clears_local_tables() {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        apply_schema(&conn).expect("apply schema");
        create_case(&conn, "Reset sak", "NO").expect("create case");

        let report = reset_test_data(&conn).expect("reset");
        assert_eq!(report.cases_deleted, Some(1));
        assert!(list_cases(&conn).expect("cases").is_empty());
        assert!(list_audit_events(&conn, None).expect("audit").is_empty());
    }

    #[test]
    fn work_items_are_persisted_for_case() {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        apply_schema(&conn).expect("apply schema");
        let case = create_case(&conn, "Arbeidsobjekter", "NO").expect("create case");

        let path = std::env::temp_dir().join(format!("evida-work-{}.txt", Uuid::new_v4()));
        std::fs::write(
            &path,
            "Dato 12.03.2024: levering dokumentert. Dato 15.03.2024: reklamasjon sendt.",
        )
        .expect("write smoke file");
        let sha256 = crate::hash::sha256_file(&path).expect("hash file");
        let extraction = crate::ingestion::extract_document(&path).expect("extract document");
        insert_document(
            &conn,
            &case.id,
            "work.txt",
            path.to_str().expect("path utf8"),
            &sha256,
            &extraction,
        )
        .expect("insert document");

        assert!(!build_chronology(&conn, &case.id).expect("chronology").is_empty());
        assert!(!build_evidence_matrix(&conn, &case.id).expect("evidence").is_empty());
        assert!(!create_argument_item(&conn, &case.id).expect("argument").is_empty());
        assert!(!assess_risk(&conn, &case.id).expect("risk").is_empty());
        let work = list_work_items(&conn, &case.id).expect("work items");
        assert_eq!(work.chronology.len(), 1);
        assert_eq!(work.evidence.len(), 1);
        assert_eq!(work.arguments.len(), 1);
        assert_eq!(work.risks.len(), 1);

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn case_ai_exchange_is_persisted_and_audited() {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        apply_schema(&conn).expect("apply schema");
        let case = create_case(&conn, "Evida AI", "NO").expect("create case");

        let path = std::env::temp_dir().join(format!("evida-ai-{}.txt", Uuid::new_v4()));
        std::fs::write(
            &path,
            "Saken omtaler betaling, faktura og selskapsstruktur. Dokumentet viser flere transaksjoner.",
        )
        .expect("write ai smoke file");
        let sha256 = crate::hash::sha256_file(&path).expect("hash file");
        let extraction = crate::ingestion::extract_document(&path).expect("extract document");
        insert_document(
            &conn,
            &case.id,
            "ai.txt",
            path.to_str().expect("path utf8"),
            &sha256,
            &extraction,
        )
        .expect("insert document");

        let source = list_source_objects(&conn, &case.id)
            .expect("sources")
            .into_iter()
            .next()
            .expect("one source");
        let answer = serde_json::json!({
            "answer": "Foreløpig svar",
            "sources": [source.id],
            "uncertainty": ["Middels"],
            "missing": ["Bevismatrise"],
            "next_action": { "label": "Bygg bevismatrise" }
        })
        .to_string();
        let message = record_case_ai_exchange(
            &conn,
            &case.id,
            "Hva bør kontrolleres først?",
            &answer,
            std::slice::from_ref(&source.id),
            Some("local-source-fallback"),
            Some("case_room_fallback_v1"),
            Some("sources-1"),
        )
        .expect("record ai exchange");

        assert_eq!(message.sources.len(), 1);
        assert_eq!(message.sources[0].validation_status, "PASS");
        assert_eq!(list_case_ai_messages(&conn, &case.id).expect("messages").len(), 1);
        let audit = list_audit_events(&conn, Some(&case.id)).expect("audit");
        assert!(audit.iter().any(|event| event.action == "CASE_AI_QUESTION_ASKED"));
        assert!(audit.iter().any(|event| event.action == "CASE_AI_ANSWER_GENERATED"));
        assert!(audit.iter().any(|event| event.action == "CASE_AI_SOURCE_VALIDATED"));

        let _ = std::fs::remove_file(path);
    }
}
