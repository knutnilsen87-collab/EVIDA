use crate::domain::{
    ArgumentItem, AuditEvent, CaseAiMessage, CaseAiMessageSource, CaseCoverageAudit,
    AppSetting, CaseSummary, ChronologyEvent, ContradictionItem, DatabaseSecurityStatus,
    DocumentCoverageAudit, DocumentIngestionReport, DocumentSummary, EvidenceItem,
    EvidenceQualityReport, ImportHealthSummary, ImportItem, ImportSession,
    ImportVerificationResult, CaseReadinessReport, ManualReviewAction, ManualReviewItem,
    MaintenanceReport, OcrResult, ReindexReport, SourceSearchResult,
    RiskItem, SourceObjectSummary, WorkItems,
};
use crate::ingestion::DocumentExtraction;
use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashSet;
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
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;

        CREATE TABLE IF NOT EXISTS cases (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            case_number TEXT,
            jurisdiction TEXT NOT NULL DEFAULT 'NO',
            status TEXT NOT NULL DEFAULT 'active',
            source_coverage_percent REAL NOT NULL DEFAULT 0,
            risk_level TEXT NOT NULL DEFAULT 'unknown',
            last_opened_at TEXT,
            workspace_path TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
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

        CREATE TABLE IF NOT EXISTS import_sessions (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            workspace_id TEXT,
            actor_id TEXT,
            source_type TEXT NOT NULL DEFAULT 'mixed',
            cancel_requested INTEGER NOT NULL DEFAULT 0,
            pause_requested INTEGER NOT NULL DEFAULT 0,
            started_at TEXT NOT NULL,
            completed_at TEXT,
            total_files_seen INTEGER NOT NULL DEFAULT 0,
            files_ready INTEGER NOT NULL DEFAULT 0,
            files_partial INTEGER NOT NULL DEFAULT 0,
            files_requires_ocr INTEGER NOT NULL DEFAULT 0,
            files_duplicate INTEGER NOT NULL DEFAULT 0,
            files_unsupported INTEGER NOT NULL DEFAULT 0,
            files_failed INTEGER NOT NULL DEFAULT 0,
            pages_total INTEGER NOT NULL DEFAULT 0,
            pages_with_text INTEGER NOT NULL DEFAULT 0,
            pages_requires_ocr INTEGER NOT NULL DEFAULT 0,
            source_objects_created INTEGER NOT NULL DEFAULT 0,
            source_coverage_percent REAL NOT NULL DEFAULT 0,
            summary_counts_json TEXT NOT NULL DEFAULT '{}',
            readiness_state TEXT NOT NULL DEFAULT 'not_ready',
            current_recommendation TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'running'
        );

        CREATE TABLE IF NOT EXISTS import_sources (
            id TEXT PRIMARY KEY,
            import_session_id TEXT NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            source_type TEXT NOT NULL,
            original_path TEXT NOT NULL,
            display_name TEXT NOT NULL,
            discovered_files_count INTEGER NOT NULL DEFAULT 0,
            rejected_objects_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS import_items (
            id TEXT PRIMARY KEY,
            import_session_id TEXT NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            original_path TEXT NOT NULL,
            original_name TEXT NOT NULL,
            extension TEXT,
            detected_mime_type TEXT,
            file_size INTEGER,
            sha256 TEXT,
            status TEXT NOT NULL DEFAULT 'queued',
            phase TEXT NOT NULL DEFAULT 'discovered',
            hash_status TEXT NOT NULL DEFAULT 'not_started',
            detected_file_type TEXT,
            magic_signature TEXT,
            type_mismatch INTEGER NOT NULL DEFAULT 0,
            issue_code TEXT,
            issue_severity TEXT,
            user_message TEXT NOT NULL DEFAULT '',
            technical_message TEXT,
            recommended_action TEXT NOT NULL DEFAULT '',
            can_retry INTEGER NOT NULL DEFAULT 0,
            can_continue INTEGER NOT NULL DEFAULT 1,
            retry_count INTEGER NOT NULL DEFAULT 0,
            ai_usable INTEGER NOT NULL DEFAULT 0,
            verified INTEGER NOT NULL DEFAULT 0,
            manual_review_required INTEGER NOT NULL DEFAULT 0,
            page_count INTEGER NOT NULL DEFAULT 0,
            pages_with_text INTEGER NOT NULL DEFAULT 0,
            pages_requires_ocr INTEGER NOT NULL DEFAULT 0,
            source_count INTEGER NOT NULL DEFAULT 0,
            final_status_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS import_jobs (
            id TEXT PRIMARY KEY,
            import_session_id TEXT NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
            import_item_id TEXT NOT NULL REFERENCES import_items(id) ON DELETE CASCADE,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            job_type TEXT NOT NULL,
            status TEXT NOT NULL,
            priority INTEGER NOT NULL DEFAULT 100,
            attempts INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL DEFAULT 3,
            locked_at TEXT,
            last_error TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS import_events (
            id TEXT PRIMARY KEY,
            import_session_id TEXT NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
            import_item_id TEXT REFERENCES import_items(id) ON DELETE CASCADE,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            event_type TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT,
            issue_code TEXT,
            message TEXT NOT NULL,
            details_json TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS import_verification_results (
            id TEXT PRIMARY KEY,
            import_session_id TEXT NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            status TEXT NOT NULL,
            total_items INTEGER NOT NULL DEFAULT 0,
            terminal_items INTEGER NOT NULL DEFAULT 0,
            processing_items INTEGER NOT NULL DEFAULT 0,
            exception_items INTEGER NOT NULL DEFAULT 0,
            invariant_failures_json TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS case_readiness_reports (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            import_session_id TEXT REFERENCES import_sessions(id) ON DELETE SET NULL,
            readiness_state TEXT NOT NULL,
            source_coverage_percent REAL NOT NULL DEFAULT 0,
            missing_files_count INTEGER NOT NULL DEFAULT 0,
            missing_pages_count INTEGER NOT NULL DEFAULT 0,
            can_open_preliminary INTEGER NOT NULL DEFAULT 0,
            banner_message TEXT NOT NULL,
            recommended_action TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS extraction_results (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            import_item_id TEXT REFERENCES import_items(id) ON DELETE SET NULL,
            document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
            extractor TEXT NOT NULL,
            status TEXT NOT NULL,
            page_count INTEGER NOT NULL DEFAULT 0,
            pages_with_text INTEGER NOT NULL DEFAULT 0,
            pages_requires_ocr INTEGER NOT NULL DEFAULT 0,
            chunks_created INTEGER NOT NULL DEFAULT 0,
            sources_created INTEGER NOT NULL DEFAULT 0,
            warnings_json TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ocr_results (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            import_item_id TEXT REFERENCES import_items(id) ON DELETE SET NULL,
            document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
            page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
            page_number INTEGER,
            engine TEXT NOT NULL,
            status TEXT NOT NULL,
            confidence REAL,
            issue_code TEXT,
            user_message TEXT NOT NULL,
            technical_message TEXT,
            recommended_action TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS manual_review_items (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            import_session_id TEXT REFERENCES import_sessions(id) ON DELETE SET NULL,
            import_item_id TEXT REFERENCES import_items(id) ON DELETE SET NULL,
            document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
            page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
            review_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            reason TEXT NOT NULL,
            recommended_action TEXT NOT NULL,
            ai_usable INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS manual_review_actions (
            id TEXT PRIMARY KEY,
            review_item_id TEXT NOT NULL REFERENCES manual_review_items(id) ON DELETE CASCADE,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            action TEXT NOT NULL,
            note TEXT,
            actor TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS document_families (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            parent_document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
            child_document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            relationship TEXT NOT NULL,
            confidence REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            UNIQUE(case_id, child_document_id, relationship)
        );

        CREATE TABLE IF NOT EXISTS duplicate_groups (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            sha256 TEXT NOT NULL,
            document_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            UNIQUE(case_id, sha256)
        );

        CREATE TABLE IF NOT EXISTS citation_validation_results (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            source_id TEXT REFERENCES source_objects(id) ON DELETE CASCADE,
            document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
            page_number INTEGER,
            status TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_import_sessions_case_started
          ON import_sessions(case_id, started_at DESC);

        CREATE INDEX IF NOT EXISTS idx_import_items_case_status
          ON import_items(case_id, status);

        CREATE INDEX IF NOT EXISTS idx_import_items_session
          ON import_items(import_session_id);

        CREATE INDEX IF NOT EXISTS idx_import_jobs_session_status
          ON import_jobs(import_session_id, status);

        CREATE INDEX IF NOT EXISTS idx_import_events_session
          ON import_events(import_session_id, created_at);

        CREATE INDEX IF NOT EXISTS idx_import_verification_session
          ON import_verification_results(import_session_id, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_case_readiness_case
          ON case_readiness_reports(case_id, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_extraction_results_case
          ON extraction_results(case_id, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_ocr_results_case_status
          ON ocr_results(case_id, status);

        CREATE INDEX IF NOT EXISTS idx_manual_review_case_status
          ON manual_review_items(case_id, status, severity);

        CREATE INDEX IF NOT EXISTS idx_duplicate_groups_case
          ON duplicate_groups(case_id, document_count DESC);

        CREATE INDEX IF NOT EXISTS idx_citation_validation_case
          ON citation_validation_results(case_id, status);

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
    add_column_if_missing(conn, "cases", "case_number", "TEXT")?;
    add_column_if_missing(conn, "cases", "last_opened_at", "TEXT")?;
    add_column_if_missing(conn, "cases", "workspace_path", "TEXT")?;
    add_column_if_missing(conn, "cases", "deleted_at", "TEXT")?;
    add_column_if_missing(conn, "import_sessions", "workspace_id", "TEXT")?;
    add_column_if_missing(conn, "import_sessions", "actor_id", "TEXT")?;
    add_column_if_missing(conn, "import_sessions", "source_type", "TEXT NOT NULL DEFAULT 'mixed'")?;
    add_column_if_missing(conn, "import_sessions", "cancel_requested", "INTEGER NOT NULL DEFAULT 0")?;
    add_column_if_missing(conn, "import_sessions", "pause_requested", "INTEGER NOT NULL DEFAULT 0")?;
    add_column_if_missing(conn, "import_sessions", "summary_counts_json", "TEXT NOT NULL DEFAULT '{}'")?;
    add_column_if_missing(conn, "import_sessions", "readiness_state", "TEXT NOT NULL DEFAULT 'not_ready'")?;
    add_column_if_missing(conn, "import_sessions", "current_recommendation", "TEXT NOT NULL DEFAULT ''")?;
    add_column_if_missing(conn, "import_items", "phase", "TEXT NOT NULL DEFAULT 'discovered'")?;
    add_column_if_missing(conn, "import_items", "hash_status", "TEXT NOT NULL DEFAULT 'not_started'")?;
    add_column_if_missing(conn, "import_items", "detected_file_type", "TEXT")?;
    add_column_if_missing(conn, "import_items", "magic_signature", "TEXT")?;
    add_column_if_missing(conn, "import_items", "type_mismatch", "INTEGER NOT NULL DEFAULT 0")?;
    add_column_if_missing(conn, "import_items", "retry_count", "INTEGER NOT NULL DEFAULT 0")?;
    add_column_if_missing(conn, "import_items", "ai_usable", "INTEGER NOT NULL DEFAULT 0")?;
    add_column_if_missing(conn, "import_items", "verified", "INTEGER NOT NULL DEFAULT 0")?;
    add_column_if_missing(conn, "import_items", "manual_review_required", "INTEGER NOT NULL DEFAULT 0")?;
    add_column_if_missing(conn, "import_items", "final_status_at", "TEXT")?;
    add_column_if_missing(conn, "audit_events", "sequence_number", "INTEGER NOT NULL DEFAULT 0")?;
    add_column_if_missing(conn, "audit_events", "previous_event_hash", "TEXT")?;
    add_column_if_missing(conn, "audit_events", "event_hash", "TEXT")?;
    add_column_if_missing(conn, "audit_events", "canonical_payload_json", "TEXT")?;
    recover_interrupted_imports(conn)?;
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

fn recover_interrupted_imports(conn: &Connection) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    let processing = crate::ingestion_core::PROCESSING_STATUSES
        .iter()
        .map(|status| format!("'{}'", status))
        .collect::<Vec<_>>()
        .join(",");
    conn.execute(
        &format!(
            "UPDATE import_items
             SET status = 'queued',
                 phase = 'recovered_after_restart',
                 user_message = 'Gjenopprettet - importen ble avbrutt og kan kjøres videre.',
                 technical_message = COALESCE(technical_message, 'recovered_after_app_restart'),
                 recommended_action = 'Trykk Retry for å kjøre filen videre, eller fjern den fra saken.',
                 can_retry = 1,
                 can_continue = 0,
                 updated_at = ?1
             WHERE status IN ({processing})"
        ),
        params![now],
    )?;
    conn.execute(
        "UPDATE import_jobs
         SET status = 'queued', locked_at = NULL, last_error = 'recovered_after_app_restart', updated_at = ?1
         WHERE status IN ('running', 'locked')",
        params![now],
    )?;
    conn.execute(
        "UPDATE import_sessions
         SET status = 'recoverable',
             current_recommendation = 'Importen ble avbrutt. Åpne Import Health Center og trykk Retry på kølagte filer.'
         WHERE status = 'running'",
        [],
    )?;
    Ok(())
}

pub fn create_case(conn: &Connection, name: &str, jurisdiction: &str) -> Result<CaseSummary> {
    let id = format!("CASE-{}", Uuid::new_v4());
    let now = Utc::now().to_rfc3339();
    let workspace_path = case_project_dir(&id)?.display().to_string();

    conn.execute(
        "INSERT INTO cases (id, name, jurisdiction, status, last_opened_at, workspace_path, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'active', ?4, ?5, ?6, ?7)",
        params![id, name, jurisdiction, now, workspace_path, now, now],
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

    write_case_project_metadata(&id, name, None)?;

    get_case(conn, &id)
}

pub fn rename_case(conn: &Connection, case_id: &str, name: &str) -> Result<CaseSummary> {
    let cleaned_name = name.trim();
    anyhow::ensure!(!cleaned_name.is_empty(), "Saksnavn kan ikke være tomt.");
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE cases SET name = ?1, updated_at = ?2 WHERE id = ?3 AND deleted_at IS NULL",
        params![cleaned_name, now, case_id],
    )?;

    crate::audit::append_audit_event(
        conn,
        Some(case_id),
        "local-user",
        "CASE_RENAMED",
        "case",
        case_id,
        "PASS",
        Some(&serde_json::json!({ "user_defined_name": true }).to_string()),
    )?;

    write_case_project_metadata(case_id, cleaned_name, Some(cleaned_name))?;

    get_case(conn, case_id)
}

pub fn set_case_number(conn: &Connection, case_id: &str, case_number: Option<&str>) -> Result<CaseSummary> {
    let cleaned = case_number.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    });
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE cases SET case_number = ?1, updated_at = ?2 WHERE id = ?3 AND deleted_at IS NULL",
        params![cleaned, now, case_id],
    )?;
    crate::audit::append_audit_event(
        conn,
        Some(case_id),
        "local-user",
        "CASE_NUMBER_UPDATED",
        "case",
        case_id,
        "PASS",
        None,
    )?;
    get_case(conn, case_id)
}

pub fn update_case_last_opened(conn: &Connection, case_id: &str) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE cases SET last_opened_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        params![now, case_id],
    )?;
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value_json FROM app_settings WHERE key = ?1")?;
    let value = stmt.query_row(params![key], |row| row.get::<_, String>(0));
    match value {
        Ok(value) => Ok(Some(value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(error.into()),
    }
}

pub fn set_setting(conn: &Connection, key: &str, value_json: &str) -> Result<()> {
    serde_json::from_str::<serde_json::Value>(value_json)
        .with_context(|| format!("Ugyldig JSON for innstilling {key}"))?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        r#"
        INSERT INTO app_settings (key, value_json, updated_at)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = excluded.updated_at
        "#,
        params![key, value_json, now],
    )?;
    Ok(())
}

pub fn list_settings(conn: &Connection) -> Result<Vec<AppSetting>> {
    let mut stmt = conn.prepare("SELECT key, value_json, updated_at FROM app_settings ORDER BY key ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(AppSetting {
            key: row.get(0)?,
            value_json: row.get(1)?,
            updated_at: row.get(2)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

fn case_project_dir(case_id: &str) -> Result<PathBuf> {
    Ok(default_data_dir()?.join("cases").join(format!("case_{}", case_id)))
}

fn write_case_project_metadata(case_id: &str, display_name: &str, user_defined_name: Option<&str>) -> Result<()> {
    let dir = case_project_dir(case_id)?;
    for subdir in ["documents", "sources", "exports", "audit", "reports", "cache"] {
        std::fs::create_dir_all(dir.join(subdir))?;
    }
    let now = Utc::now().to_rfc3339();
    let metadata = serde_json::json!({
        "caseId": case_id,
        "displayName": display_name,
        "userDefinedName": user_defined_name,
        "suggestedName": null,
        "caseNumber": null,
        "suggestedCaseNumber": null,
        "caseType": null,
        "parties": [],
        "opponents": [],
        "tags": [],
        "status": "preparing",
        "readiness": "not_ready",
        "documentCount": 0,
        "pageCount": 0,
        "sourceCoveragePercent": 0,
        "createdAt": now,
        "updatedAt": now,
        "lastOpenedAt": now
    });
    std::fs::write(
        dir.join("case.json"),
        serde_json::to_string_pretty(&metadata)?,
    )?;
    Ok(())
}

pub fn get_case(conn: &Connection, case_id: &str) -> Result<CaseSummary> {
    let mut stmt = conn.prepare(
        r#"
        SELECT
          c.id, c.name, c.case_number, c.jurisdiction, c.status,
          COALESCE(COUNT(d.id), 0) AS document_count,
          COALESCE(SUM(d.page_count), 0) AS page_count,
          c.source_coverage_percent,
          c.risk_level,
          c.updated_at,
          c.last_opened_at
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
            case_number: row.get(2)?,
            jurisdiction: row.get(3)?,
            status: row.get(4)?,
            document_count: row.get(5)?,
            page_count: row.get(6)?,
            source_coverage_percent: row.get(7)?,
            risk_level: row.get(8)?,
            updated_at: row.get(9)?,
            last_opened_at: row.get(10)?,
        })
    })?;

    Ok(item)
}

pub fn list_cases(conn: &Connection) -> Result<Vec<CaseSummary>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT
          c.id, c.name, c.case_number, c.jurisdiction, c.status,
          COALESCE(COUNT(d.id), 0) AS document_count,
          COALESCE(SUM(d.page_count), 0) AS page_count,
          c.source_coverage_percent,
          c.risk_level,
          c.updated_at,
          c.last_opened_at
        FROM cases c
        LEFT JOIN documents d ON d.case_id = c.id
        WHERE c.deleted_at IS NULL
        GROUP BY c.id
        ORDER BY COALESCE(c.last_opened_at, c.updated_at) DESC
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(CaseSummary {
            id: row.get(0)?,
            name: row.get(1)?,
            case_number: row.get(2)?,
            jurisdiction: row.get(3)?,
            status: row.get(4)?,
            document_count: row.get(5)?,
            page_count: row.get(6)?,
            source_coverage_percent: row.get(7)?,
            risk_level: row.get(8)?,
            updated_at: row.get(9)?,
            last_opened_at: row.get(10)?,
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
    conn.execute("DELETE FROM citation_validation_results", [])?;
    conn.execute("DELETE FROM duplicate_groups", [])?;
    conn.execute("DELETE FROM document_families", [])?;
    conn.execute("DELETE FROM manual_review_actions", [])?;
    conn.execute("DELETE FROM manual_review_items", [])?;
    conn.execute("DELETE FROM ocr_results", [])?;
    conn.execute("DELETE FROM extraction_results", [])?;
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
    conn.execute("DELETE FROM case_readiness_reports", [])?;
    conn.execute("DELETE FROM import_verification_results", [])?;
    conn.execute("DELETE FROM import_events", [])?;
    conn.execute("DELETE FROM import_jobs", [])?;
    conn.execute("DELETE FROM import_sources", [])?;
    conn.execute("DELETE FROM import_items", [])?;
    conn.execute("DELETE FROM import_sessions", [])?;
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

fn import_item_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ImportItem> {
    Ok(ImportItem {
        id: row.get(0)?,
        import_session_id: row.get(1)?,
        case_id: row.get(2)?,
        original_path: row.get(3)?,
        original_name: row.get(4)?,
        extension: row.get(5)?,
        detected_mime_type: row.get(6)?,
        file_size: row.get(7)?,
        sha256: row.get(8)?,
        status: row.get(9)?,
        issue_code: row.get(10)?,
        issue_severity: row.get(11)?,
        user_message: row.get(12)?,
        technical_message: row.get(13)?,
        recommended_action: row.get(14)?,
        can_retry: row.get::<_, i64>(15)? != 0,
        can_continue: row.get::<_, i64>(16)? != 0,
        page_count: row.get(17)?,
        pages_with_text: row.get(18)?,
        pages_requires_ocr: row.get(19)?,
        source_count: row.get(20)?,
        created_at: row.get(21)?,
        updated_at: row.get(22)?,
    })
}

fn import_session_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ImportSession> {
    Ok(ImportSession {
        id: row.get(0)?,
        case_id: row.get(1)?,
        started_at: row.get(2)?,
        completed_at: row.get(3)?,
        total_files_seen: row.get(4)?,
        files_ready: row.get(5)?,
        files_partial: row.get(6)?,
        files_requires_ocr: row.get(7)?,
        files_duplicate: row.get(8)?,
        files_unsupported: row.get(9)?,
        files_failed: row.get(10)?,
        pages_total: row.get(11)?,
        pages_with_text: row.get(12)?,
        pages_requires_ocr: row.get(13)?,
        source_objects_created: row.get(14)?,
        source_coverage_percent: row.get(15)?,
        status: row.get(16)?,
    })
}

pub fn create_import_session(conn: &Connection, case_id: &str, total_files_seen: i64) -> Result<ImportSession> {
    let id = format!("IMP-{}", Uuid::new_v4());
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO import_sessions
         (id, case_id, actor_id, source_type, started_at, total_files_seen, status, current_recommendation)
         VALUES (?1, ?2, 'local-user', 'mixed', ?3, ?4, 'running',
          'Importen er startet. Evida registrerer alle filer og avvik før Saksrom kan regnes som komplett.')",
        params![id, case_id, now, total_files_seen],
    )?;
    append_import_event(
        conn,
        &id,
        None,
        case_id,
        "session_started",
        None,
        Some("running"),
        None,
        "Importøkt startet.",
        None,
    )?;
    get_import_session(conn, &id)
}

pub fn create_import_source(
    conn: &Connection,
    import_session_id: &str,
    case_id: &str,
    source_type: &str,
    original_path: &str,
    discovered_files_count: i64,
    rejected_objects_count: i64,
) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    let display_name = Path::new(original_path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(original_path)
        .to_string();
    conn.execute(
        "INSERT INTO import_sources
         (id, import_session_id, case_id, source_type, original_path, display_name,
          discovered_files_count, rejected_objects_count, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            format!("IMPSRC-{}", Uuid::new_v4()),
            import_session_id,
            case_id,
            source_type,
            original_path,
            display_name,
            discovered_files_count,
            rejected_objects_count,
            now
        ],
    )?;
    append_import_event(
        conn,
        import_session_id,
        None,
        case_id,
        "source_discovered",
        None,
        None,
        None,
        "Importkilde registrert.",
        Some(&serde_json::json!({
            "source_type": source_type,
            "original_path": original_path,
            "discovered_files_count": discovered_files_count,
            "rejected_objects_count": rejected_objects_count
        }).to_string()),
    )?;
    Ok(())
}

pub fn create_import_item(conn: &Connection, import_session_id: &str, case_id: &str, path: &Path) -> Result<ImportItem> {
    let id = format!("IMI-{}", Uuid::new_v4());
    let now = Utc::now().to_rfc3339();
    let original_path = path.display().to_string();
    let original_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("unknown-file")
        .to_string();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());
    let file_size = std::fs::metadata(path).ok().map(|metadata| metadata.len() as i64);

    conn.execute(
        "INSERT INTO import_items
         (id, import_session_id, case_id, original_path, original_name, extension, file_size,
          status, phase, user_message, recommended_action, can_retry, can_continue, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'queued',
          'discovered',
          'Venter - filen ligger i importkoen.',
          'Vent til importjobben har kontrollert filen.', 0, 1, ?8, ?8)",
        params![id, import_session_id, case_id, original_path, original_name, extension, file_size, now],
    )?;
    conn.execute(
        "INSERT INTO import_jobs
         (id, import_session_id, import_item_id, case_id, job_type, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'ingest_file', 'queued', ?5, ?5)",
        params![format!("IMPJOB-{}", Uuid::new_v4()), import_session_id, id, case_id, now],
    )?;
    append_import_event(
        conn,
        import_session_id,
        Some(&id),
        case_id,
        "item_queued",
        None,
        Some("queued"),
        None,
        "Fil lagt i importkø.",
        Some(&serde_json::json!({
            "original_path": original_path,
            "file_size": file_size
        }).to_string()),
    )?;
    get_import_item(conn, &id)
}

#[allow(clippy::too_many_arguments)]
pub fn update_import_item(
    conn: &Connection,
    item_id: &str,
    status: &str,
    issue_code: Option<&str>,
    issue_severity: Option<&str>,
    user_message: &str,
    technical_message: Option<&str>,
    recommended_action: &str,
    can_retry: bool,
    can_continue: bool,
    detected_mime_type: Option<&str>,
    sha256: Option<&str>,
    page_count: i64,
    pages_with_text: i64,
    pages_requires_ocr: i64,
    source_count: i64,
) -> Result<ImportItem> {
    let now = Utc::now().to_rfc3339();
    let previous_status = conn
        .query_row(
            "SELECT status FROM import_items WHERE id = ?1",
            params![item_id],
            |row| row.get::<_, String>(0),
        )
        .optional()?;
    let phase = phase_for_status(status);
    let hash_status = if sha256.is_some() {
        "hashed"
    } else if status == "hashing" {
        "running"
    } else if status == "failed" && matches!(issue_code, Some("FILE_PERMISSION_DENIED" | "PATH_NOT_FILE")) {
        "failed"
    } else {
        "not_started"
    };
    let final_status_at = if crate::ingestion_core::is_terminal_status(status) {
        Some(now.as_str())
    } else {
        None
    };
    let ai_usable = matches!(status, "ready" | "partial") && source_count > 0;
    let verified = crate::ingestion_core::is_terminal_status(status);
    let manual_review_required = matches!(
        status,
        "partial" | "ocr_required" | "unsupported" | "failed" | "security_blocked" | "manual_review_required"
    );
    conn.execute(
        "UPDATE import_items
         SET status = ?1, issue_code = ?2, issue_severity = ?3, user_message = ?4,
             technical_message = ?5, recommended_action = ?6, can_retry = ?7,
             can_continue = ?8, detected_mime_type = COALESCE(?9, detected_mime_type),
             sha256 = COALESCE(?10, sha256), page_count = ?11, pages_with_text = ?12,
             pages_requires_ocr = ?13, source_count = ?14, updated_at = ?15,
             phase = ?16, hash_status = ?17, final_status_at = COALESCE(?18, final_status_at),
             ai_usable = ?19, verified = ?20, manual_review_required = ?21
         WHERE id = ?22",
        params![
            status,
            issue_code,
            issue_severity,
            user_message,
            technical_message,
            recommended_action,
            if can_retry { 1 } else { 0 },
            if can_continue { 1 } else { 0 },
            detected_mime_type,
            sha256,
            page_count,
            pages_with_text,
            pages_requires_ocr,
            source_count,
            now,
            phase,
            hash_status,
            final_status_at,
            if ai_usable { 1 } else { 0 },
            if verified { 1 } else { 0 },
            if manual_review_required { 1 } else { 0 },
            item_id
        ],
    )?;
    let item = get_import_item(conn, item_id)?;
    conn.execute(
        "UPDATE import_jobs
         SET status = CASE
             WHEN ?1 IN ('ready','partial','ocr_required','duplicate','unsupported','failed','cancelled','security_blocked','manual_review_required') THEN 'done'
             WHEN ?1 = 'paused' THEN 'paused'
             ELSE 'running'
         END,
         attempts = CASE WHEN ?1 IN ('validating','hashing','extracting_text') THEN MAX(attempts, 1) ELSE attempts END,
         last_error = CASE WHEN ?2 IS NOT NULL THEN ?3 ELSE last_error END,
         updated_at = ?4
         WHERE import_item_id = ?5",
        params![status, issue_code, technical_message, now, item_id],
    )?;
    append_import_event(
        conn,
        &item.import_session_id,
        Some(item_id),
        &item.case_id,
        "item_status_changed",
        previous_status.as_deref(),
        Some(status),
        issue_code,
        user_message,
        Some(&serde_json::json!({
            "phase": phase,
            "hash_status": hash_status,
            "page_count": page_count,
            "pages_with_text": pages_with_text,
            "pages_requires_ocr": pages_requires_ocr,
            "source_count": source_count
        }).to_string()),
    )?;
    Ok(item)
}

pub fn update_import_item_detection(
    conn: &Connection,
    item_id: &str,
    detection: &crate::ingestion_core::FileTypeDetection,
) -> Result<ImportItem> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE import_items
         SET detected_mime_type = ?1, detected_file_type = ?2, magic_signature = ?3,
             type_mismatch = ?4, phase = 'type_detected', updated_at = ?5
         WHERE id = ?6",
        params![
            detection.detected_mime_type.as_str(),
            detection.detected_file_type.as_str(),
            detection.magic_signature.as_str(),
            if detection.type_mismatch { 1 } else { 0 },
            now,
            item_id
        ],
    )?;
    get_import_item(conn, item_id)
}

fn phase_for_status(status: &str) -> &'static str {
    match status {
        "queued" => "queued",
        "validating" => "validating",
        "hashing" => "hashing",
        "extracting_text" => "extracting_text",
        "ocr_required" => "ocr_pending",
        "ocr_running" => "ocr_running",
        "chunking" => "chunking",
        "indexed" => "indexing",
        "ready" | "partial" | "duplicate" | "unsupported" | "failed" | "cancelled" => "terminal",
        "security_blocked" => "safety_blocked",
        "manual_review_required" => "manual_review_required",
        _ => "unknown",
    }
}

#[allow(clippy::too_many_arguments)]
pub fn append_import_event(
    conn: &Connection,
    import_session_id: &str,
    import_item_id: Option<&str>,
    case_id: &str,
    event_type: &str,
    from_status: Option<&str>,
    to_status: Option<&str>,
    issue_code: Option<&str>,
    message: &str,
    details_json: Option<&str>,
) -> Result<()> {
    conn.execute(
        "INSERT INTO import_events
         (id, import_session_id, import_item_id, case_id, event_type, from_status, to_status,
          issue_code, message, details_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            format!("IMPEVT-{}", Uuid::new_v4()),
            import_session_id,
            import_item_id,
            case_id,
            event_type,
            from_status,
            to_status,
            issue_code,
            message,
            details_json,
            Utc::now().to_rfc3339()
        ],
    )?;
    Ok(())
}

pub fn get_import_item(conn: &Connection, item_id: &str) -> Result<ImportItem> {
    conn.query_row(
        "SELECT id, import_session_id, case_id, original_path, original_name, extension,
         detected_mime_type, file_size, sha256, status, issue_code, issue_severity,
         user_message, technical_message, recommended_action, can_retry, can_continue,
         page_count, pages_with_text, pages_requires_ocr, source_count, created_at, updated_at
         FROM import_items WHERE id = ?1",
        params![item_id],
        import_item_from_row,
    )
    .map_err(Into::into)
}

pub fn get_import_session(conn: &Connection, session_id: &str) -> Result<ImportSession> {
    conn.query_row(
        "SELECT id, case_id, started_at, completed_at, total_files_seen, files_ready,
         files_partial, files_requires_ocr, files_duplicate, files_unsupported, files_failed,
         pages_total, pages_with_text, pages_requires_ocr, source_objects_created,
         source_coverage_percent, status FROM import_sessions WHERE id = ?1",
        params![session_id],
        import_session_from_row,
    )
    .map_err(Into::into)
}

pub fn latest_import_session(conn: &Connection, case_id: &str) -> Result<Option<ImportSession>> {
    conn.query_row(
        "SELECT id, case_id, started_at, completed_at, total_files_seen, files_ready,
         files_partial, files_requires_ocr, files_duplicate, files_unsupported, files_failed,
         pages_total, pages_with_text, pages_requires_ocr, source_objects_created,
         source_coverage_percent, status
         FROM import_sessions WHERE case_id = ?1 ORDER BY started_at DESC LIMIT 1",
        params![case_id],
        import_session_from_row,
    )
    .optional()
    .map_err(Into::into)
}

pub fn list_import_items(conn: &Connection, case_id: &str) -> Result<Vec<ImportItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, import_session_id, case_id, original_path, original_name, extension,
         detected_mime_type, file_size, sha256, status, issue_code, issue_severity,
         user_message, technical_message, recommended_action, can_retry, can_continue,
         page_count, pages_with_text, pages_requires_ocr, source_count, created_at, updated_at
         FROM import_items WHERE case_id = ?1 ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map(params![case_id], import_item_from_row)?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn document_exists_for_sha(conn: &Connection, case_id: &str, sha256: &str) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM documents WHERE case_id = ?1 AND sha256 = ?2",
        params![case_id, sha256],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

pub fn complete_import_session(conn: &Connection, session_id: &str) -> Result<ImportSession> {
    recalculate_import_session(conn, session_id, true)
}

pub fn pause_import_session(conn: &Connection, session_id: &str) -> Result<ImportSession> {
    conn.execute(
        "UPDATE import_sessions
         SET pause_requested = 1, status = 'paused',
             current_recommendation = 'Importen er satt på pause. Trykk Resume for å fortsette.'
         WHERE id = ?1",
        params![session_id],
    )?;
    conn.execute(
        "UPDATE import_jobs SET status = 'paused', updated_at = ?1
         WHERE import_session_id = ?2 AND status IN ('queued','running')",
        params![Utc::now().to_rfc3339(), session_id],
    )?;
    get_import_session(conn, session_id)
}

pub fn resume_import_session(conn: &Connection, session_id: &str) -> Result<ImportSession> {
    conn.execute(
        "UPDATE import_sessions
         SET pause_requested = 0, status = 'running',
             current_recommendation = 'Importen fortsetter.'
         WHERE id = ?1",
        params![session_id],
    )?;
    conn.execute(
        "UPDATE import_jobs SET status = 'queued', updated_at = ?1
         WHERE import_session_id = ?2 AND status = 'paused'",
        params![Utc::now().to_rfc3339(), session_id],
    )?;
    get_import_session(conn, session_id)
}

pub fn cancel_import_session(conn: &Connection, session_id: &str) -> Result<ImportSession> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE import_sessions
         SET cancel_requested = 1, completed_at = COALESCE(completed_at, ?1), status = 'cancelled',
             current_recommendation = 'Importen er avbrutt. Registrerte filer ligger i Import Health Center.'
         WHERE id = ?2",
        params![now, session_id],
    )?;
    conn.execute(
        "UPDATE import_items
         SET status = 'cancelled', phase = 'terminal', final_status_at = COALESCE(final_status_at, ?1),
             user_message = 'Avbrutt - filen ble ikke ferdig behandlet.',
             recommended_action = 'Start importen på nytt eller fjern filen fra saken.',
             can_retry = 1, can_continue = 0, updated_at = ?1
         WHERE import_session_id = ?2
           AND status IN ('queued','validating','hashing','type_detecting','safety_pending','extracting_text','ocr_running','chunking','indexed')",
        params![now, session_id],
    )?;
    conn.execute(
        "UPDATE import_jobs SET status = 'cancelled', updated_at = ?1
         WHERE import_session_id = ?2 AND status IN ('queued','running','paused')",
        params![now, session_id],
    )?;
    get_import_session(conn, session_id)
}

pub fn recalculate_import_session(conn: &Connection, session_id: &str, completed: bool) -> Result<ImportSession> {
    let now = Utc::now().to_rfc3339();
    let total_items: i64 = conn.query_row(
        "SELECT COUNT(*) FROM import_items WHERE import_session_id = ?1",
        params![session_id],
        |row| row.get(0),
    )?;
    let processing_items: i64 = conn.query_row(
        "SELECT COUNT(*) FROM import_items WHERE import_session_id = ?1
         AND status IN ('queued','validating','hashing','type_detecting','safety_pending','extracting_text','ocr_running','chunking','indexed')",
        params![session_id],
        |row| row.get(0),
    )?;
    let exception_items: i64 = conn.query_row(
        "SELECT COUNT(*) FROM import_items WHERE import_session_id = ?1
         AND status IN ('partial','ocr_required','unsupported','failed','security_blocked','manual_review_required')",
        params![session_id],
        |row| row.get(0),
    )?;
    let status = if completed && processing_items == 0 && exception_items > 0 {
        "complete_with_exceptions"
    } else if completed && processing_items == 0 {
        "complete"
    } else {
        "running"
    };
    let completed_at = if completed { Some(now.as_str()) } else { None };
    let readiness_state = if processing_items > 0 {
        "processing"
    } else if exception_items > 0 {
        "preliminary"
    } else if total_items > 0 {
        "ready"
    } else {
        "not_ready"
    };
    let recommendation = match readiness_state {
        "processing" => "Vent til importen er ferdig før endelig kontroll.",
        "preliminary" => "Åpne Import Health Center og håndter filer som krever OCR, retry eller erstatning.",
        "ready" => "Dokumentgrunnlaget er komplett nok til Saksrom.",
        _ => "Importer dokumenter for å starte saksgrunnlaget.",
    };
    let summary_counts_json = serde_json::json!({
        "total_items": total_items,
        "processing_items": processing_items,
        "exception_items": exception_items
    })
    .to_string();
    conn.execute(
        "UPDATE import_sessions
         SET completed_at = COALESCE(?1, completed_at),
             files_ready = (SELECT COUNT(*) FROM import_items WHERE import_session_id = ?2 AND status = 'ready'),
             files_partial = (SELECT COUNT(*) FROM import_items WHERE import_session_id = ?2 AND status = 'partial'),
             files_requires_ocr = (SELECT COUNT(*) FROM import_items WHERE import_session_id = ?2 AND status = 'ocr_required'),
             files_duplicate = (SELECT COUNT(*) FROM import_items WHERE import_session_id = ?2 AND status = 'duplicate'),
             files_unsupported = (SELECT COUNT(*) FROM import_items WHERE import_session_id = ?2 AND status = 'unsupported'),
             files_failed = (SELECT COUNT(*) FROM import_items WHERE import_session_id = ?2 AND status = 'failed'),
             pages_total = (SELECT COALESCE(SUM(page_count), 0) FROM import_items WHERE import_session_id = ?2),
             pages_with_text = (SELECT COALESCE(SUM(pages_with_text), 0) FROM import_items WHERE import_session_id = ?2),
             pages_requires_ocr = (SELECT COALESCE(SUM(pages_requires_ocr), 0) FROM import_items WHERE import_session_id = ?2),
             source_objects_created = (SELECT COALESCE(SUM(source_count), 0) FROM import_items WHERE import_session_id = ?2),
             source_coverage_percent = (
                SELECT CASE WHEN COALESCE(SUM(page_count), 0) = 0 THEN 0
                ELSE ROUND((COALESCE(SUM(pages_with_text), 0) * 100.0) / COALESCE(SUM(page_count), 1), 2) END
                FROM import_items WHERE import_session_id = ?2
             ),
             summary_counts_json = ?3,
             readiness_state = ?4,
             current_recommendation = ?5,
             status = ?6
         WHERE id = ?2",
        params![completed_at, session_id, summary_counts_json, readiness_state, recommendation, status],
    )?;
    let session = get_import_session(conn, session_id)?;
    if completed {
        let _ = create_import_verification_result(conn, &session);
        let _ = create_case_readiness_report(conn, &session.case_id, Some(&session.id));
    }
    Ok(session)
}

pub fn create_import_verification_result(
    conn: &Connection,
    session: &ImportSession,
) -> Result<ImportVerificationResult> {
    let now = Utc::now().to_rfc3339();
    let total_items: i64 = conn.query_row(
        "SELECT COUNT(*) FROM import_items WHERE import_session_id = ?1",
        params![session.id.as_str()],
        |row| row.get(0),
    )?;
    let processing_items: i64 = conn.query_row(
        "SELECT COUNT(*) FROM import_items WHERE import_session_id = ?1
         AND status IN ('queued','validating','hashing','type_detecting','safety_pending','extracting_text','ocr_running','chunking','indexed')",
        params![session.id.as_str()],
        |row| row.get(0),
    )?;
    let terminal_items = total_items - processing_items;
    let exception_items: i64 = conn.query_row(
        "SELECT COUNT(*) FROM import_items WHERE import_session_id = ?1
         AND status IN ('partial','ocr_required','unsupported','failed','security_blocked','manual_review_required')",
        params![session.id.as_str()],
        |row| row.get(0),
    )?;
    let mut invariant_failures = Vec::new();
    if total_items < session.total_files_seen {
        invariant_failures.push(format!(
            "INV-001 total_files_seen={} but only {} import_items exist",
            session.total_files_seen, total_items
        ));
    }
    if processing_items > 0 && session.completed_at.is_some() {
        invariant_failures.push("INV-007 completed session still has processing items".to_string());
    }
    let missing_hashes: i64 = conn.query_row(
        "SELECT COUNT(*) FROM import_items WHERE import_session_id = ?1
         AND status IN ('ready','partial','duplicate') AND sha256 IS NULL",
        params![session.id.as_str()],
        |row| row.get(0),
    )?;
    if missing_hashes > 0 {
        invariant_failures.push(format!("INV-002 {missing_hashes} usable items lack sha256"));
    }
    let missing_sources: i64 = conn.query_row(
        "SELECT COUNT(*) FROM import_items WHERE import_session_id = ?1
         AND status = 'ready' AND source_count = 0",
        params![session.id.as_str()],
        |row| row.get(0),
    )?;
    if missing_sources > 0 {
        invariant_failures.push(format!("INV-003 {missing_sources} ready items lack source provenance"));
    }
    let status = if invariant_failures.is_empty() && processing_items == 0 {
        "verified"
    } else if processing_items > 0 {
        "processing"
    } else {
        "verified_with_exceptions"
    };
    let id = format!("IMPVER-{}", Uuid::new_v4());
    let invariant_failures_json = serde_json::to_string(&invariant_failures)?;
    conn.execute(
        "INSERT INTO import_verification_results
         (id, import_session_id, case_id, status, total_items, terminal_items, processing_items,
          exception_items, invariant_failures_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            id,
            session.id.as_str(),
            session.case_id.as_str(),
            status,
            total_items,
            terminal_items,
            processing_items,
            exception_items,
            invariant_failures_json,
            now
        ],
    )?;
    latest_import_verification_result(conn, session.id.as_str())?.context("verification result was not persisted")
}

pub fn latest_import_verification_result(
    conn: &Connection,
    session_id: &str,
) -> Result<Option<ImportVerificationResult>> {
    conn.query_row(
        "SELECT id, import_session_id, case_id, status, total_items, terminal_items,
         processing_items, exception_items, invariant_failures_json, created_at
         FROM import_verification_results
         WHERE import_session_id = ?1
         ORDER BY created_at DESC LIMIT 1",
        params![session_id],
        |row| {
            Ok(ImportVerificationResult {
                id: row.get(0)?,
                import_session_id: row.get(1)?,
                case_id: row.get(2)?,
                status: row.get(3)?,
                total_items: row.get(4)?,
                terminal_items: row.get(5)?,
                processing_items: row.get(6)?,
                exception_items: row.get(7)?,
                invariant_failures_json: row.get(8)?,
                created_at: row.get(9)?,
            })
        },
    )
    .optional()
    .map_err(Into::into)
}

pub fn create_case_readiness_report(
    conn: &Connection,
    case_id: &str,
    import_session_id: Option<&str>,
) -> Result<CaseReadinessReport> {
    let now = Utc::now().to_rfc3339();
    let audit = get_case_coverage_audit(conn, case_id)?;
    let items = list_import_items(conn, case_id)?;
    let missing_files_count = items
        .iter()
        .filter(|item| matches!(item.status.as_str(), "partial" | "ocr_required" | "unsupported" | "failed" | "security_blocked" | "manual_review_required"))
        .count() as i64;
    let missing_pages_count = audit.pending_text_recognition_pages + audit.pages_missing_sources;
    let has_processing = audit.has_active_processing || items.iter().any(|item| crate::ingestion_core::is_processing_status(&item.status));
    let readiness_state = if has_processing {
        "processing"
    } else if audit.source_coverage_percent >= 100.0 && missing_files_count == 0 && missing_pages_count == 0 {
        "ready"
    } else if audit.source_count > 0 {
        "preliminary"
    } else {
        "not_ready"
    };
    let can_open_preliminary = matches!(readiness_state, "ready" | "preliminary") && audit.source_count > 0;
    let banner_message = if readiness_state == "ready" {
        "Saksrom kan brukes med komplett dokumentgrunnlag.".to_string()
    } else if can_open_preliminary {
        format!(
            "Saksrom kan brukes foreløpig basert på {} % av dokumentgrunnlaget. {} sider er ikke lesbare ennå.",
            audit.source_coverage_percent.round(),
            missing_pages_count
        )
    } else {
        "Saksrom venter på lesbart dokumentgrunnlag.".to_string()
    };
    let recommended_action = match readiness_state {
        "processing" => "Vent til importen er ferdig og åpne Import Health Center.",
        "ready" => "Fortsett til Saksrom.",
        "preliminary" => "Se hva som mangler og håndter OCR/feil før endelig vurdering.",
        _ => "Importer saksdokumenter.",
    };
    let id = format!("READY-{}", Uuid::new_v4());
    conn.execute(
        "INSERT INTO case_readiness_reports
         (id, case_id, import_session_id, readiness_state, source_coverage_percent,
          missing_files_count, missing_pages_count, can_open_preliminary, banner_message,
          recommended_action, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            id,
            case_id,
            import_session_id,
            readiness_state,
            audit.source_coverage_percent,
            missing_files_count,
            missing_pages_count,
            if can_open_preliminary { 1 } else { 0 },
            banner_message,
            recommended_action,
            now
        ],
    )?;
    latest_case_readiness_report(conn, case_id)?.context("readiness report was not persisted")
}

pub fn latest_case_readiness_report(conn: &Connection, case_id: &str) -> Result<Option<CaseReadinessReport>> {
    conn.query_row(
        "SELECT id, case_id, import_session_id, readiness_state, source_coverage_percent,
         missing_files_count, missing_pages_count, can_open_preliminary, banner_message,
         recommended_action, created_at
         FROM case_readiness_reports
         WHERE case_id = ?1
         ORDER BY created_at DESC LIMIT 1",
        params![case_id],
        |row| {
            Ok(CaseReadinessReport {
                id: row.get(0)?,
                case_id: row.get(1)?,
                import_session_id: row.get(2)?,
                readiness_state: row.get(3)?,
                source_coverage_percent: row.get(4)?,
                missing_files_count: row.get(5)?,
                missing_pages_count: row.get(6)?,
                can_open_preliminary: row.get::<_, i64>(7)? != 0,
                banner_message: row.get(8)?,
                recommended_action: row.get(9)?,
                created_at: row.get(10)?,
            })
        },
    )
    .optional()
    .map_err(Into::into)
}

pub fn get_import_health(conn: &Connection, case_id: &str) -> Result<ImportHealthSummary> {
    let latest_session = latest_import_session(conn, case_id)?;
    let items = list_import_items(conn, case_id)?;
    let audit = get_case_coverage_audit(conn, case_id)?;
    let readiness = create_case_readiness_report(
        conn,
        case_id,
        latest_session.as_ref().map(|session| session.id.as_str()),
    )
    .ok()
    .or(latest_case_readiness_report(conn, case_id)?);
    let verification = latest_session
        .as_ref()
        .and_then(|session| latest_import_verification_result(conn, &session.id).ok().flatten());
    let missing_files_count = items
        .iter()
        .filter(|item| matches!(item.status.as_str(), "partial" | "ocr_required" | "unsupported" | "failed" | "duplicate"))
        .count() as i64;
    let missing_pages_count = audit.pending_text_recognition_pages + audit.pages_missing_sources;
    let has_active = latest_session.as_ref().is_some_and(|session| session.status == "running")
        || items.iter().any(|item| {
            matches!(
                item.status.as_str(),
                "queued" | "validating" | "hashing" | "extracting_text" | "ocr_running" | "chunking" | "indexed"
            )
        })
        || audit.has_active_processing;
    let source_coverage_percent = audit.source_coverage_percent;
    let incomplete = has_active
        || audit.pending_text_recognition_pages > 0
        || audit.failed_documents > 0
        || missing_files_count > 0
        || source_coverage_percent < 100.0;
    let (overall_status, status_title, reason, consequence, recommended_action) = if has_active {
        (
            "processing",
            "Import pågår",
            "Minst én fil er fortsatt under behandling.",
            "Saksgrunnlaget kan endre seg når importen er ferdig.",
            "Vent til importen er ferdig før endelig kontroll.",
        )
    } else if incomplete {
        (
            "incomplete",
            "Importjobb ferdig, men dokumentgrunnlaget er ikke komplett.",
            "Noen filer mangler tekst, feilet, er duplikater eller ble bare delvis behandlet.",
            "Saksrom kan bare brukes foreløpig og må kontrolleres mot manglene.",
            "Åpne Import Health Center og håndter OCR, feil eller erstatningsfiler.",
        )
    } else {
        (
            "ready",
            "Importen er komplett",
            "Alle kjente filer er ferdig behandlet med sporbare kilder.",
            "Saksrom kan brukes med komplett dokumentgrunnlag.",
            "Fortsett til Saksrom eller kontrollgrunnlag.",
        )
    };

    Ok(ImportHealthSummary {
        case_id: case_id.to_string(),
        latest_session,
        items,
        overall_status: overall_status.to_string(),
        status_title: status_title.to_string(),
        reason: reason.to_string(),
        consequence: consequence.to_string(),
        recommended_action: recommended_action.to_string(),
        can_open_preliminary: source_coverage_percent > 0.0,
        source_coverage_percent,
        missing_files_count,
        missing_pages_count,
        verification,
        readiness,
    })
}

pub fn export_import_diagnostics(conn: &Connection, case_id: &str) -> Result<MaintenanceReport> {
    let dir = default_data_dir()?.join("diagnostics");
    std::fs::create_dir_all(&dir)?;
    let stamp = Utc::now().format("%Y%m%d-%H%M%S");
    let json_path = dir.join(format!("evida-import-diagnostics-{}-{}.json", case_id, stamp));
    let csv_path = dir.join(format!("evida-import-diagnostics-{}-{}.csv", case_id, stamp));
    let health = get_import_health(conn, case_id)?;
    let issue_summary = serde_json::json!({
        "ready": health.items.iter().filter(|item| item.status == "ready").count(),
        "partial": health.items.iter().filter(|item| item.status == "partial").count(),
        "requires_ocr": health.items.iter().filter(|item| item.status == "ocr_required").count(),
        "duplicate": health.items.iter().filter(|item| item.status == "duplicate").count(),
        "unsupported": health.items.iter().filter(|item| item.status == "unsupported").count(),
        "failed": health.items.iter().filter(|item| item.status == "failed").count()
    });
    let payload = serde_json::json!({
        "generated_at": Utc::now().to_rfc3339(),
        "case_id": case_id,
        "health": health,
        "issue_summary": issue_summary
    });
    std::fs::write(&json_path, serde_json::to_string_pretty(&payload)?)?;

    let mut csv = String::from("id,session_id,case_id,status,issue_code,severity,original_name,original_path,page_count,pages_with_text,pages_requires_ocr,source_count,user_message,recommended_action,technical_message\n");
    for item in get_import_health(conn, case_id)?.items {
        let cells = [
            item.id,
            item.import_session_id,
            item.case_id,
            item.status,
            item.issue_code.unwrap_or_default(),
            item.issue_severity.unwrap_or_default(),
            item.original_name,
            item.original_path,
            item.page_count.to_string(),
            item.pages_with_text.to_string(),
            item.pages_requires_ocr.to_string(),
            item.source_count.to_string(),
            item.user_message,
            item.recommended_action,
            item.technical_message.unwrap_or_default(),
        ];
        csv.push_str(&cells.map(|cell| format!("\"{}\"", cell.replace('"', "\"\""))).join(","));
        csv.push('\n');
    }
    std::fs::write(&csv_path, csv)?;

    Ok(MaintenanceReport {
        message: format!("Importdiagnostikk eksportert: {}", json_path.display()),
        path: Some(json_path.display().to_string()),
        cases_deleted: None,
        documents_deleted: None,
        sources_deleted: None,
    })
}

pub fn remove_import_item_from_case(conn: &Connection, item_id: &str) -> Result<ImportItem> {
    let item = get_import_item(conn, item_id)?;
    if let Some(sha256) = item.sha256.as_deref() {
        conn.execute(
            "DELETE FROM documents WHERE case_id = ?1 AND sha256 = ?2",
            params![item.case_id.as_str(), sha256],
        )?;
    } else {
        conn.execute(
            "DELETE FROM documents WHERE case_id = ?1 AND local_path = ?2",
            params![item.case_id.as_str(), item.original_path.as_str()],
        )?;
    }
    let updated = update_import_item(
        conn,
        item_id,
        "cancelled",
        None,
        Some("info"),
        "Fjernet - filen er tatt ut av saken.",
        Some("removed_from_case_by_user"),
        "Last opp filen på nytt hvis den likevel skal være en del av saken.",
        false,
        true,
        None,
        item.sha256.as_deref(),
        0,
        0,
        0,
        0,
    )?;
    let now = Utc::now().to_rfc3339();
    update_case_source_coverage(conn, &item.case_id, &now)?;
    recalculate_import_session(conn, &item.import_session_id, false)?;
    Ok(updated)
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

pub fn get_case_coverage_audit(conn: &Connection, case_id: &str) -> Result<CaseCoverageAudit> {
    let documents = list_documents(conn, case_id)?;
    let mut document_audits = Vec::new();
    let mut total_pages = 0;
    let mut processed_pages = 0;
    let mut pages_with_sources = 0;
    let mut pages_missing_sources = 0;
    let mut source_count = 0;
    let mut failed_documents = 0;
    let mut documents_requiring_attention = 0;
    let mut pending_text_recognition_pages = 0;
    let mut warnings = Vec::new();

    for document in &documents {
        let coverage = document_coverage_audit(conn, document)?;
        total_pages += coverage.page_count;
        processed_pages += coverage.processed_pages;
        pages_with_sources += coverage.pages_with_sources;
        pages_missing_sources += coverage.pages_missing_sources;
        source_count += coverage.source_count;
        pending_text_recognition_pages += coverage.pending_text_recognition_pages;
        if coverage.status == "failed" {
            failed_documents += 1;
        }
        if coverage.status == "failed" || coverage.status == "needs_user_action" {
            documents_requiring_attention += 1;
        }
        warnings.extend(coverage.warnings.clone());
        document_audits.push(coverage);
    }

    let processed_documents = document_audits
        .iter()
        .filter(|document| document.processed_pages > 0 || document.source_count > 0)
        .count() as i64;
    let source_coverage_percent = if total_pages <= 0 {
        0.0
    } else {
        ((pages_with_sources as f64 / total_pages as f64) * 100.0).round().clamp(0.0, 100.0)
    };
    let has_active_processing = document_audits
        .iter()
        .any(|document| document.status == "queued" || document.status == "running");

    Ok(CaseCoverageAudit {
        case_id: case_id.to_string(),
        total_documents: documents.len() as i64,
        processed_documents,
        total_pages,
        processed_pages,
        pages_with_sources,
        pages_missing_sources,
        source_count,
        failed_documents,
        documents_requiring_attention,
        pending_text_recognition_pages,
        source_coverage_percent,
        has_active_processing,
        documents: document_audits,
        warnings,
    })
}

fn document_coverage_audit(conn: &Connection, document: &DocumentSummary) -> Result<DocumentCoverageAudit> {
    let page_count = document.page_count.max(0);
    let mut covered_pages = HashSet::new();
    let mut source_stmt = conn.prepare(
        "SELECT page_start, page_end FROM source_objects WHERE document_id = ?1",
    )?;
    let source_ranges = source_stmt.query_map(params![document.id.as_str()], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
    })?;
    for range in source_ranges {
        let (start, end) = range?;
        let safe_start = start.max(1);
        let safe_end = end.max(safe_start).min(page_count.max(safe_start));
        for page in safe_start..=safe_end {
            covered_pages.insert(page);
        }
    }

    let processed_pages = conn.query_row(
        "SELECT COUNT(DISTINCT page_number) FROM pages WHERE document_id = ?1",
        params![document.id.as_str()],
        |row| row.get::<_, i64>(0),
    )?;
    let source_count = conn.query_row(
        "SELECT COUNT(*) FROM source_objects WHERE document_id = ?1",
        params![document.id.as_str()],
        |row| row.get::<_, i64>(0),
    )?;
    let pending_text_recognition_pages = conn.query_row(
        "SELECT COUNT(*) FROM pages WHERE document_id = ?1 AND text_status = 'needs_ocr'",
        params![document.id.as_str()],
        |row| row.get::<_, i64>(0),
    )?;
    let pages_with_sources = covered_pages.len() as i64;
    let pages_missing_sources = if page_count > 0 {
        (page_count - pages_with_sources).max(0)
    } else {
        0
    };
    let source_coverage_percent = if page_count <= 0 {
        0.0
    } else {
        ((pages_with_sources as f64 / page_count as f64) * 100.0).round().clamp(0.0, 100.0)
    };
    let missing_page_ranges = missing_page_ranges(page_count, &covered_pages, 12);
    let status = if ["failed", "empty", "unsupported_file_type"].contains(&document.ocr_status.as_str()) {
        "failed"
    } else if document.ocr_status == "running" {
        "running"
    } else if pages_missing_sources == 0 && page_count > 0 {
        "ready"
    } else if pages_with_sources > 0 {
        "partially_ready"
    } else if pending_text_recognition_pages > 0 {
        "queued"
    } else {
        "needs_user_action"
    }
    .to_string();

    let mut warnings = Vec::new();
    if pending_text_recognition_pages > 0 {
        warnings.push(format!(
            "{} sider venter på teksthenting i {}.",
            pending_text_recognition_pages, document.original_name
        ));
    }
    if pages_missing_sources > 0 {
        warnings.push(format!(
            "{} sider mangler sporbare kilder i {}.",
            pages_missing_sources, document.original_name
        ));
    }

    Ok(DocumentCoverageAudit {
        document_id: document.id.clone(),
        original_name: document.original_name.clone(),
        page_count,
        processed_pages,
        pages_with_sources,
        pages_missing_sources,
        pending_text_recognition_pages,
        source_count,
        source_coverage_percent,
        ocr_status: document.ocr_status.clone(),
        status,
        missing_page_ranges,
        warnings,
    })
}

fn missing_page_ranges(page_count: i64, covered_pages: &HashSet<i64>, max_ranges: usize) -> Vec<String> {
    let mut ranges = Vec::new();
    let mut cursor = 1;
    while cursor <= page_count && ranges.len() < max_ranges {
        if covered_pages.contains(&cursor) {
            cursor += 1;
            continue;
        }

        let start = cursor;
        while cursor <= page_count && !covered_pages.contains(&cursor) {
            cursor += 1;
        }
        let end = cursor - 1;
        if start == end {
            ranges.push(start.to_string());
        } else {
            ranges.push(format!("{}-{}", start, end));
        }
    }

    if cursor <= page_count {
        ranges.push("flere".to_string());
    }

    ranges
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

pub fn search_source_objects(
    conn: &Connection,
    case_id: &str,
    query: &str,
    limit: i64,
) -> Result<Vec<SourceSearchResult>> {
    let terms = query
        .to_lowercase()
        .split(|ch: char| !ch.is_alphanumeric())
        .filter(|term| term.len() > 2)
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    if terms.is_empty() {
        return Ok(Vec::new());
    }
    let mut stmt = conn.prepare(
        r#"
        SELECT s.id, s.case_id, s.document_id, d.original_name, s.page_start, s.page_end,
               s.text_excerpt
        FROM source_objects s
        JOIN documents d ON d.id = s.document_id
        WHERE s.case_id = ?1
        ORDER BY s.created_at DESC
        LIMIT 2000
        "#,
    )?;
    let rows = stmt.query_map(params![case_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, i64>(4)?,
            row.get::<_, i64>(5)?,
            crate::crypto::decrypt_text(&row.get::<_, String>(6)?),
        ))
    })?;
    let mut results = rows
        .collect::<std::result::Result<Vec<_>, _>>()?
        .into_iter()
        .filter_map(|(source_id, case_id, document_id, document_name, page_start, page_end, text)| {
            let lower = text.to_lowercase();
            let score = terms.iter().filter(|term| lower.contains(term.as_str())).count() as i64;
            if score == 0 {
                return None;
            }
            Some(SourceSearchResult {
                source_id,
                case_id,
                document_id,
                document_name,
                page_start,
                page_end,
                snippet: highlighted_snippet(&text, &terms),
                score,
            })
        })
        .collect::<Vec<_>>();
    results.sort_by(|left, right| right.score.cmp(&left.score).then(left.document_name.cmp(&right.document_name)));
    results.truncate(limit.max(0) as usize);
    Ok(results)
}

fn highlighted_snippet(text: &str, terms: &[String]) -> String {
    let lower = text.to_lowercase();
    let first_match = terms
        .iter()
        .filter_map(|term| lower.find(term).map(|index| index.saturating_sub(80)))
        .min()
        .unwrap_or(0);
    text.chars()
        .skip(first_match)
        .take(260)
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn record_extraction_result(
    conn: &Connection,
    case_id: &str,
    import_item_id: Option<&str>,
    document_id: Option<&str>,
    extraction: &DocumentExtraction,
    chunks_created: i64,
    sources_created: i64,
) -> Result<()> {
    let pages_with_text = extraction
        .pages
        .iter()
        .filter(|page| page.text_status == "extracted" || page.text_status == "ocr_extracted")
        .count() as i64;
    let pages_requires_ocr = extraction
        .pages
        .iter()
        .filter(|page| page.text_status == "needs_ocr")
        .count() as i64;
    conn.execute(
        "INSERT INTO extraction_results
         (id, case_id, import_item_id, document_id, extractor, status, page_count,
          pages_with_text, pages_requires_ocr, chunks_created, sources_created,
          warnings_json, created_at)
         VALUES (?1, ?2, ?3, ?4, 'evida-local-extractor-v1', ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            format!("EXTRES-{}", Uuid::new_v4()),
            case_id,
            import_item_id,
            document_id,
            extraction.ocr_status.as_str(),
            extraction.page_count,
            pages_with_text,
            pages_requires_ocr,
            chunks_created,
            sources_created,
            serde_json::to_string(&extraction.warnings)?,
            Utc::now().to_rfc3339()
        ],
    )?;
    Ok(())
}

pub fn ensure_ocr_and_review_items_for_import(
    conn: &Connection,
    import_item: &ImportItem,
    document_id: Option<&str>,
) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    if import_item.pages_requires_ocr > 0 {
        if let Some(document_id) = document_id {
            let mut stmt = conn.prepare(
                "SELECT id, page_number FROM pages WHERE document_id = ?1 AND text_status = 'needs_ocr'",
            )?;
            let pages = stmt
                .query_map(params![document_id], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))?
                .collect::<std::result::Result<Vec<_>, _>>()?;
            drop(stmt);
            for (page_id, page_number) in pages {
                insert_ocr_result(
                    conn,
                    &import_item.case_id,
                    Some(&import_item.id),
                    Some(document_id),
                    Some(&page_id),
                    Some(page_number),
                    "queued",
                    None,
                    Some("OCR_REQUIRED"),
                    "Krever OCR - siden har ikke lesbar tekst.",
                    None,
                    "Kjør OCR før endelig juridisk vurdering.",
                )?;
                ensure_manual_review_item(
                    conn,
                    &import_item.case_id,
                    Some(&import_item.import_session_id),
                    Some(&import_item.id),
                    Some(document_id),
                    Some(&page_id),
                    "ocr_required",
                    "warning",
                    "Siden mangler maskinlesbar tekst.",
                    "Kjør OCR eller marker siden som manuelt gjennomgått.",
                    false,
                )?;
            }
        } else {
            insert_ocr_result(
                conn,
                &import_item.case_id,
                Some(&import_item.id),
                None,
                None,
                None,
                "queued",
                None,
                Some("OCR_REQUIRED"),
                "Krever OCR - dokumentet har sider uten lesbar tekst.",
                None,
                "Kjør OCR eller last opp en tekstbasert kopi.",
            )?;
        }
    }
    if matches!(import_item.status.as_str(), "partial" | "failed" | "unsupported" | "security_blocked") {
        ensure_manual_review_item(
            conn,
            &import_item.case_id,
            Some(&import_item.import_session_id),
            Some(&import_item.id),
            document_id,
            None,
            import_item.issue_code.as_deref().unwrap_or(import_item.status.as_str()),
            import_item.issue_severity.as_deref().unwrap_or("warning"),
            &import_item.user_message,
            &import_item.recommended_action,
            import_item.status == "partial" && import_item.source_count > 0,
        )?;
    }
    conn.execute(
        "UPDATE import_items SET updated_at = ?1 WHERE id = ?2",
        params![now, import_item.id.as_str()],
    )?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn insert_ocr_result(
    conn: &Connection,
    case_id: &str,
    import_item_id: Option<&str>,
    document_id: Option<&str>,
    page_id: Option<&str>,
    page_number: Option<i64>,
    status: &str,
    confidence: Option<f64>,
    issue_code: Option<&str>,
    user_message: &str,
    technical_message: Option<&str>,
    recommended_action: &str,
) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO ocr_results
         (id, case_id, import_item_id, document_id, page_id, page_number, engine, status,
          confidence, issue_code, user_message, technical_message, recommended_action,
          created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'tesseract-local', ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)",
        params![
            format!("OCR-{}", Uuid::new_v4()),
            case_id,
            import_item_id,
            document_id,
            page_id,
            page_number,
            status,
            confidence,
            issue_code,
            user_message,
            technical_message,
            recommended_action,
            now
        ],
    )?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn ensure_manual_review_item(
    conn: &Connection,
    case_id: &str,
    import_session_id: Option<&str>,
    import_item_id: Option<&str>,
    document_id: Option<&str>,
    page_id: Option<&str>,
    review_type: &str,
    severity: &str,
    reason: &str,
    recommended_action: &str,
    ai_usable: bool,
) -> Result<()> {
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM manual_review_items
             WHERE case_id = ?1
               AND COALESCE(import_item_id, '') = COALESCE(?2, '')
               AND COALESCE(document_id, '') = COALESCE(?3, '')
               AND COALESCE(page_id, '') = COALESCE(?4, '')
               AND review_type = ?5
             LIMIT 1",
            params![case_id, import_item_id, document_id, page_id, review_type],
            |row| row.get(0),
        )
        .optional()?;
    if existing.is_some() {
        return Ok(());
    }
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO manual_review_items
         (id, case_id, import_session_id, import_item_id, document_id, page_id,
          review_type, severity, status, reason, recommended_action, ai_usable,
          created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'open', ?9, ?10, ?11, ?12, ?12)",
        params![
            format!("REV-{}", Uuid::new_v4()),
            case_id,
            import_session_id,
            import_item_id,
            document_id,
            page_id,
            review_type,
            severity,
            reason,
            recommended_action,
            if ai_usable { 1 } else { 0 },
            now
        ],
    )?;
    Ok(())
}

pub fn list_manual_review_items(conn: &Connection, case_id: &str) -> Result<Vec<ManualReviewItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, case_id, import_session_id, import_item_id, document_id, page_id,
         review_type, severity, status, reason, recommended_action, ai_usable, created_at, updated_at
         FROM manual_review_items
         WHERE case_id = ?1
         ORDER BY CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at DESC",
    )?;
    let rows = stmt.query_map(params![case_id], manual_review_item_from_row)?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn apply_manual_review_action(
    conn: &Connection,
    review_item_id: &str,
    action: &str,
    note: Option<&str>,
) -> Result<ManualReviewAction> {
    let item = conn.query_row(
        "SELECT id, case_id, import_session_id, import_item_id, document_id, page_id,
         review_type, severity, status, reason, recommended_action, ai_usable, created_at, updated_at
         FROM manual_review_items WHERE id = ?1",
        params![review_item_id],
        manual_review_item_from_row,
    )?;
    let normalized = match action {
        "mark_reviewed" | "relevant" | "not_relevant" | "blank_no_significance" | "unreadable_but_seen" => "reviewed",
        "exclude_from_ai" => "excluded_from_ai",
        "requires_follow_up" => "needs_follow_up",
        "retry_ocr" => "open",
        _ => "reviewed",
    };
    let ai_usable = matches!(action, "mark_reviewed" | "relevant") && item.ai_usable;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE manual_review_items SET status = ?1, ai_usable = ?2, updated_at = ?3 WHERE id = ?4",
        params![normalized, if ai_usable { 1 } else { 0 }, now, review_item_id],
    )?;
    let action_id = format!("REVACT-{}", Uuid::new_v4());
    conn.execute(
        "INSERT INTO manual_review_actions
         (id, review_item_id, case_id, action, note, actor, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'local-user', ?6)",
        params![action_id, review_item_id, item.case_id.as_str(), action, note, now],
    )?;
    crate::audit::append_audit_event(
        conn,
        Some(&item.case_id),
        "local-user",
        "MANUAL_REVIEW_ACTION",
        "manual_review_item",
        review_item_id,
        "PASS",
        Some(&serde_json::json!({ "action": action, "status": normalized }).to_string()),
    )?;
    create_case_readiness_report(conn, &item.case_id, item.import_session_id.as_deref())?;
    Ok(ManualReviewAction {
        id: action_id,
        review_item_id: review_item_id.to_string(),
        case_id: item.case_id,
        action: action.to_string(),
        note: note.map(ToString::to_string),
        actor: "local-user".to_string(),
        created_at: now,
    })
}

pub fn record_document_control_action(
    conn: &Connection,
    case_id: &str,
    document_id: &str,
    action: &str,
    note: Option<&str>,
) -> Result<()> {
    let (document_name, sha256): (String, String) = conn.query_row(
        "SELECT original_name, sha256 FROM documents WHERE id = ?1 AND case_id = ?2",
        params![document_id, case_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let normalized_action = match action {
        "preview" => "DOCUMENT_PREVIEW_OPENED",
        "approve_for_ai" => "DOCUMENT_APPROVED_FOR_AI",
        "reject_from_ai" => "DOCUMENT_REJECTED_FOR_AI",
        "reject_for_ai" => "DOCUMENT_REJECTED_FOR_AI",
        other => other,
    };
    let result = if normalized_action == "DOCUMENT_REJECTED_FOR_AI" { "WARN" } else { "PASS" };
    let details = serde_json::json!({
        "document_name": document_name,
        "sha256": sha256,
        "note": note
    });
    crate::audit::append_audit_event(
        conn,
        Some(case_id),
        "local-user",
        normalized_action,
        "document",
        document_id,
        result,
        Some(&details.to_string()),
    )?;
    if normalized_action == "DOCUMENT_APPROVED_FOR_AI" || normalized_action == "DOCUMENT_REJECTED_FOR_AI" {
        let status = if normalized_action == "DOCUMENT_APPROVED_FOR_AI" {
            "reviewed"
        } else {
            "excluded_from_ai"
        };
        let ai_usable = normalized_action == "DOCUMENT_APPROVED_FOR_AI";
        conn.execute(
            "UPDATE manual_review_items
             SET status = ?1, ai_usable = ?2, updated_at = ?3
             WHERE case_id = ?4 AND document_id = ?5 AND status IN ('open', 'needs_follow_up')",
            params![
                status,
                if ai_usable { 1 } else { 0 },
                Utc::now().to_rfc3339(),
                case_id,
                document_id
            ],
        )?;
    }
    Ok(())
}

fn manual_review_item_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ManualReviewItem> {
    Ok(ManualReviewItem {
        id: row.get(0)?,
        case_id: row.get(1)?,
        import_session_id: row.get(2)?,
        import_item_id: row.get(3)?,
        document_id: row.get(4)?,
        page_id: row.get(5)?,
        review_type: row.get(6)?,
        severity: row.get(7)?,
        status: row.get(8)?,
        reason: row.get(9)?,
        recommended_action: row.get(10)?,
        ai_usable: row.get::<_, i64>(11)? != 0,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

pub fn list_ocr_results(conn: &Connection, case_id: &str) -> Result<Vec<OcrResult>> {
    let mut stmt = conn.prepare(
        "SELECT id, case_id, import_item_id, document_id, page_id, page_number,
         engine, status, confidence, issue_code, user_message, technical_message,
         recommended_action, created_at, updated_at
         FROM ocr_results WHERE case_id = ?1
         ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map(params![case_id], |row| {
        Ok(OcrResult {
            id: row.get(0)?,
            case_id: row.get(1)?,
            import_item_id: row.get(2)?,
            document_id: row.get(3)?,
            page_id: row.get(4)?,
            page_number: row.get(5)?,
            engine: row.get(6)?,
            status: row.get(7)?,
            confidence: row.get(8)?,
            issue_code: row.get(9)?,
            user_message: row.get(10)?,
            technical_message: row.get(11)?,
            recommended_action: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn run_ocr_for_import_item(conn: &Connection, import_item_id: &str, engine_available: bool) -> Result<Vec<OcrResult>> {
    let item = get_import_item(conn, import_item_id)?;
    let now = Utc::now().to_rfc3339();
    let (status, issue_code, user_message, technical, action) = if engine_available {
        (
            "queued",
            Some("OCR_REQUIRED"),
            "OCR står i kø - lokal OCR-motor skal behandle siden.",
            None,
            "Vent til OCR-køen er ferdig.",
        )
    } else {
        (
            "failed",
            Some("OCR_ENGINE_UNAVAILABLE"),
            "OCR kan ikke kjøres - Tesseract er ikke tilgjengelig.",
            Some("tesseract_not_found_in_path"),
            "Installer Tesseract eller last opp en tekstbasert PDF.",
        )
    };
    conn.execute(
        "UPDATE ocr_results
         SET status = ?1, issue_code = ?2, user_message = ?3, technical_message = ?4,
             recommended_action = ?5, updated_at = ?6
         WHERE import_item_id = ?7 AND status IN ('queued','failed')",
        params![status, issue_code, user_message, technical, action, now, import_item_id],
    )?;
    if !engine_available {
        ensure_manual_review_item(
            conn,
            &item.case_id,
            Some(&item.import_session_id),
            Some(&item.id),
            None,
            None,
            "OCR_ENGINE_UNAVAILABLE",
            "error",
            "OCR-motoren er ikke tilgjengelig på denne maskinen.",
            "Installer Tesseract eller last opp en tekstbasert kopi.",
            false,
        )?;
    }
    list_ocr_results(conn, &item.case_id)
}

pub fn refresh_evidence_quality(conn: &Connection, case_id: &str) -> Result<EvidenceQualityReport> {
    let now = Utc::now().to_rfc3339();
    conn.execute("DELETE FROM duplicate_groups WHERE case_id = ?1", params![case_id])?;
    conn.execute(
        "INSERT INTO duplicate_groups (id, case_id, sha256, document_count, created_at)
         SELECT 'DUP-' || lower(hex(randomblob(16))), case_id, sha256, COUNT(*), ?1
         FROM (
           SELECT case_id, sha256 FROM documents WHERE case_id = ?2 AND sha256 IS NOT NULL
           UNION ALL
           SELECT case_id, sha256 FROM import_items WHERE case_id = ?2 AND status = 'duplicate' AND sha256 IS NOT NULL
         )
         GROUP BY case_id, sha256
         HAVING COUNT(*) > 1",
        params![now, case_id],
    )?;
    conn.execute("DELETE FROM document_families WHERE case_id = ?1", params![case_id])?;
    let docs = list_documents(conn, case_id)?;
    for document in &docs {
        let lower = document.original_name.to_lowercase();
        if lower.contains("vedlegg") || lower.contains("attachment") || lower.contains("bilag") {
            conn.execute(
                "INSERT OR IGNORE INTO document_families
                 (id, case_id, parent_document_id, child_document_id, relationship, confidence, created_at)
                 VALUES (?1, ?2, NULL, ?3, 'attachment_like', 0.65, ?4)",
                params![format!("FAM-{}", Uuid::new_v4()), case_id, document.id.as_str(), now],
            )?;
        }
    }
    conn.execute("DELETE FROM citation_validation_results WHERE case_id = ?1", params![case_id])?;
    conn.execute(
        "INSERT INTO citation_validation_results
         (id, case_id, source_id, document_id, page_number, status, message, created_at)
         SELECT 'CIT-' || lower(hex(randomblob(16))), s.case_id, s.id, s.document_id, s.page_start,
                CASE WHEN p.id IS NULL THEN 'failed' ELSE 'passed' END,
                CASE WHEN p.id IS NULL THEN 'Kilden peker på en side som ikke finnes i dokumentet.' ELSE 'Kildehenvisningen peker på en registrert side.' END,
                ?1
         FROM source_objects s
         LEFT JOIN pages p ON p.document_id = s.document_id AND p.page_number = s.page_start
         WHERE s.case_id = ?2",
        params![now, case_id],
    )?;

    let total_documents = docs.len() as i64;
    let duplicate_groups: i64 = conn.query_row(
        "SELECT COUNT(*) FROM duplicate_groups WHERE case_id = ?1",
        params![case_id],
        |row| row.get(0),
    )?;
    let duplicate_documents: i64 = conn.query_row(
        "SELECT COALESCE(SUM(document_count), 0) FROM duplicate_groups WHERE case_id = ?1",
        params![case_id],
        |row| row.get(0),
    )?;
    let attachment_like_documents: i64 = conn.query_row(
        "SELECT COUNT(*) FROM document_families WHERE case_id = ?1 AND relationship = 'attachment_like'",
        params![case_id],
        |row| row.get(0),
    )?;
    let citation_checks: i64 = conn.query_row(
        "SELECT COUNT(*) FROM citation_validation_results WHERE case_id = ?1",
        params![case_id],
        |row| row.get(0),
    )?;
    let citation_failures: i64 = conn.query_row(
        "SELECT COUNT(*) FROM citation_validation_results WHERE case_id = ?1 AND status = 'failed'",
        params![case_id],
        |row| row.get(0),
    )?;
    let source_map_rows: i64 = conn.query_row(
        "SELECT COUNT(*) FROM source_objects WHERE case_id = ?1",
        params![case_id],
        |row| row.get(0),
    )?;
    let chain_of_custody_rows: i64 = conn.query_row(
        "SELECT COUNT(*) FROM documents WHERE case_id = ?1 AND sha256 IS NOT NULL",
        params![case_id],
        |row| row.get(0),
    )?;
    let mut warnings = Vec::new();
    if duplicate_groups > 0 {
        warnings.push(format!("{duplicate_groups} duplikatgrupper bør vurderes før endelig analyse."));
    }
    if citation_failures > 0 {
        warnings.push(format!("{citation_failures} kildehenvisninger peker ikke på registrerte sider."));
    }
    if attachment_like_documents > 0 {
        warnings.push(format!("{attachment_like_documents} dokumenter ser ut som vedlegg/bilag og bør kobles til hoveddokument."));
    }
    let recommended_action = if warnings.is_empty() {
        "Evidence quality ser klar ut for foreløpig juridisk arbeid.".to_string()
    } else {
        "Åpne quality-rapporten og rydd duplikater, vedlegg og kildehenvisninger før endelig vurdering.".to_string()
    };
    Ok(EvidenceQualityReport {
        case_id: case_id.to_string(),
        total_documents,
        duplicate_groups,
        duplicate_documents,
        attachment_like_documents,
        citation_checks,
        citation_failures,
        source_map_rows,
        chain_of_custody_rows,
        warnings,
        recommended_action,
        generated_at: now,
    })
}

pub fn export_evidence_quality_package(conn: &Connection, case_id: &str) -> Result<MaintenanceReport> {
    let report = refresh_evidence_quality(conn, case_id)?;
    let dir = default_data_dir()?.join("diagnostics");
    std::fs::create_dir_all(&dir)?;
    let stamp = Utc::now().format("%Y%m%d-%H%M%S");
    let report_path = dir.join(format!("evida-evidence-quality-{}-{}.json", case_id, stamp));
    let source_map_path = dir.join(format!("evida-source-map-{}-{}.csv", case_id, stamp));
    let chain_path = dir.join(format!("evida-chain-of-custody-{}-{}.csv", case_id, stamp));
    std::fs::write(&report_path, serde_json::to_string_pretty(&report)?)?;

    let mut source_map = String::from("source_id,document_id,document_name,page_start,page_end,source_sha256,chunk_id,created_at\n");
    let mut stmt = conn.prepare(
        "SELECT s.id, s.document_id, d.original_name, s.page_start, s.page_end, s.sha256, s.chunk_id, s.created_at
         FROM source_objects s
         JOIN documents d ON d.id = s.document_id
         WHERE s.case_id = ?1
         ORDER BY d.original_name, s.page_start",
    )?;
    let rows = stmt.query_map(params![case_id], |row| {
        Ok([
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, i64>(3)?.to_string(),
            row.get::<_, i64>(4)?.to_string(),
            row.get::<_, String>(5)?,
            row.get::<_, Option<String>>(6)?.unwrap_or_default(),
            row.get::<_, String>(7)?,
        ])
    })?;
    for row in rows {
        source_map.push_str(&csv_row(row?.into_iter()));
    }
    std::fs::write(&source_map_path, source_map)?;

    let mut chain = String::from("document_id,document_name,local_path,sha256,page_count,mime_type,imported_at\n");
    let mut stmt = conn.prepare(
        "SELECT id, original_name, local_path, sha256, page_count, COALESCE(mime_type, ''), imported_at
         FROM documents WHERE case_id = ?1 ORDER BY imported_at ASC",
    )?;
    let rows = stmt.query_map(params![case_id], |row| {
        Ok([
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, i64>(4)?.to_string(),
            row.get::<_, String>(5)?,
            row.get::<_, String>(6)?,
        ])
    })?;
    for row in rows {
        chain.push_str(&csv_row(row?.into_iter()));
    }
    std::fs::write(&chain_path, chain)?;

    Ok(MaintenanceReport {
        message: format!(
            "Evidence quality eksportert: {}",
            report_path.display()
        ),
        path: Some(report_path.display().to_string()),
        cases_deleted: None,
        documents_deleted: None,
        sources_deleted: None,
    })
}

fn csv_row<I>(cells: I) -> String
where
    I: IntoIterator<Item = String>,
{
    let mut row = cells
        .into_iter()
        .map(|cell| format!("\"{}\"", cell.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(",");
    row.push('\n');
    row
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
    fn coverage_audit_counts_pages_without_source_list_limit() {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        apply_schema(&conn).expect("apply schema");
        let case = create_case(&conn, "Dekningssak", "NO").expect("create case");
        let extraction = crate::ingestion::DocumentExtraction {
            mime_type: Some("application/pdf".to_string()),
            page_count: 3,
            ocr_status: "partial_needs_ocr".to_string(),
            pages: vec![
                crate::ingestion::ExtractedPage {
                    page_number: 1,
                    text_status: "extracted".to_string(),
                    sha256: Some(crate::hash::sha256_text("side 1")),
                },
                crate::ingestion::ExtractedPage {
                    page_number: 2,
                    text_status: "needs_ocr".to_string(),
                    sha256: None,
                },
                crate::ingestion::ExtractedPage {
                    page_number: 3,
                    text_status: "extracted".to_string(),
                    sha256: Some(crate::hash::sha256_text("side 3")),
                },
            ],
            chunks: vec![
                crate::ingestion::TextChunk {
                    page_start: 1,
                    page_end: 1,
                    text: "Dokumentert tekst på side 1".to_string(),
                    sha256: crate::hash::sha256_text("Dokumentert tekst på side 1"),
                },
                crate::ingestion::TextChunk {
                    page_start: 3,
                    page_end: 3,
                    text: "Dokumentert tekst på side 3".to_string(),
                    sha256: crate::hash::sha256_text("Dokumentert tekst på side 3"),
                },
            ],
            warnings: vec!["test_missing_page".to_string()],
        };

        insert_document(
            &conn,
            &case.id,
            "dekning.pdf",
            "F:\\test\\dekning.pdf",
            "sha",
            &extraction,
        )
        .expect("insert document");

        let audit = get_case_coverage_audit(&conn, &case.id).expect("coverage audit");
        assert_eq!(audit.total_pages, 3);
        assert_eq!(audit.pages_with_sources, 2);
        assert_eq!(audit.pages_missing_sources, 1);
        assert_eq!(audit.source_count, 2);
        assert_eq!(audit.pending_text_recognition_pages, 1);
        assert_eq!(audit.source_coverage_percent, 67.0);
        assert_eq!(audit.documents[0].missing_page_ranges, vec!["2"]);
    }

    #[test]
    fn phase_5_to_8_quality_search_ocr_and_review_workflow() {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        apply_schema(&conn).expect("apply schema");
        let case = create_case(&conn, "Ingestion fase 5-8", "NO").expect("create case");
        let session = create_import_session(&conn, &case.id, 2).expect("session");

        let text_path = std::env::temp_dir().join(format!("evida-phase58-{}.txt", Uuid::new_v4()));
        std::fs::write(
            &text_path,
            "Kontrakten viser at betaling ble varslet og dokumentert med faktura.",
        )
        .expect("write text");
        let sha = crate::hash::sha256_file(&text_path).expect("hash");
        let text_item = create_import_item(&conn, &session.id, &case.id, &text_path).expect("item");
        let extraction = crate::ingestion::extract_document(&text_path).expect("extract");
        let report = insert_document(
            &conn,
            &case.id,
            "kontrakt.txt",
            text_path.to_str().expect("path"),
            &sha,
            &extraction,
        )
        .expect("insert document");
        record_extraction_result(
            &conn,
            &case.id,
            Some(&text_item.id),
            Some(&report.document.id),
            &extraction,
            report.chunks_created,
            report.sources_created,
        )
        .expect("record extraction");
        update_import_item(
            &conn,
            &text_item.id,
            "ready",
            None,
            None,
            "Klar - filen er importert med sporbare kilder.",
            None,
            "Ingen handling nødvendig.",
            false,
            true,
            extraction.mime_type.as_deref(),
            Some(&sha),
            extraction.page_count,
            1,
            0,
            report.sources_created,
        )
        .expect("ready item");

        let hits = search_source_objects(&conn, &case.id, "betaling faktura", 10).expect("search");
        assert_eq!(hits.len(), 1);
        assert!(hits[0].snippet.to_lowercase().contains("betaling"));

        let duplicate_path = std::env::temp_dir().join(format!("evida-phase58-dup-{}.txt", Uuid::new_v4()));
        std::fs::write(&duplicate_path, "duplicate").expect("write duplicate marker");
        let duplicate_item = create_import_item(&conn, &session.id, &case.id, &duplicate_path).expect("dup item");
        update_import_item(
            &conn,
            &duplicate_item.id,
            "duplicate",
            Some("DUPLICATE_FILE"),
            Some("info"),
            "Duplikat - denne filen finnes allerede i saken.",
            Some("test_duplicate"),
            "Ingen handling nødvendig.",
            false,
            true,
            None,
            Some(&sha),
            0,
            0,
            0,
            0,
        )
        .expect("duplicate item");

        let ocr_path = std::env::temp_dir().join(format!("evida-phase58-ocr-{}.pdf", Uuid::new_v4()));
        std::fs::write(&ocr_path, b"%PDF-1.7\n").expect("write pdf");
        let ocr_item = create_import_item(&conn, &session.id, &case.id, &ocr_path).expect("ocr item");
        let ocr_extraction = crate::ingestion::DocumentExtraction {
            mime_type: Some("application/pdf".to_string()),
            page_count: 1,
            ocr_status: "needs_ocr".to_string(),
            pages: vec![crate::ingestion::ExtractedPage {
                page_number: 1,
                text_status: "needs_ocr".to_string(),
                sha256: None,
            }],
            chunks: vec![],
            warnings: vec!["test_requires_ocr".to_string()],
        };
        let ocr_report = insert_document(
            &conn,
            &case.id,
            "scan.pdf",
            ocr_path.to_str().expect("path"),
            "sha-ocr-phase58",
            &ocr_extraction,
        )
        .expect("insert ocr document");
        let ocr_item = update_import_item(
            &conn,
            &ocr_item.id,
            "ocr_required",
            Some("OCR_REQUIRED"),
            Some("warning"),
            "Krever OCR - Evida fant sider uten lesbar tekst.",
            Some("test_requires_ocr"),
            "Kjør OCR før endelig vurdering.",
            true,
            false,
            Some("application/pdf"),
            Some("sha-ocr-phase58"),
            1,
            0,
            1,
            0,
        )
        .expect("ocr item update");
        ensure_ocr_and_review_items_for_import(&conn, &ocr_item, Some(&ocr_report.document.id))
            .expect("ocr review items");

        assert_eq!(list_ocr_results(&conn, &case.id).expect("ocr").len(), 1);
        let review_items = list_manual_review_items(&conn, &case.id).expect("review items");
        assert!(!review_items.is_empty());
        let action = apply_manual_review_action(&conn, &review_items[0].id, "requires_follow_up", Some("Må OCR-behandles"))
            .expect("review action");
        assert_eq!(action.action, "requires_follow_up");

        let quality = refresh_evidence_quality(&conn, &case.id).expect("quality");
        assert!(quality.source_map_rows >= 1);
        assert!(quality.citation_checks >= 1);
        assert_eq!(quality.duplicate_groups, 1);

        let _ = std::fs::remove_file(text_path);
        let _ = std::fs::remove_file(duplicate_path);
        let _ = std::fs::remove_file(ocr_path);
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

    #[test]
    #[ignore]
    fn okokrim_10000_bundle_passes_ingestion_gate() {
        let pdf_path = std::env::var("EVIDA_STRESS_PDF").expect("EVIDA_STRESS_PDF must point to test PDF");
        let manifest_path = std::env::var("EVIDA_STRESS_MANIFEST").expect("EVIDA_STRESS_MANIFEST must point to truth manifest");
        let manifest: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(&manifest_path).expect("read truth manifest"),
        )
        .expect("parse truth manifest");
        let expected = &manifest["expected"];
        let expected_pages = expected["registered_pages"].as_i64().expect("registered_pages");
        let minimum_coverage = expected["minimum_coverage_before_ocr_percent"]
            .as_f64()
            .expect("minimum coverage");
        let expected_ocr_pages = expected["ocr_required_pages"].as_i64().expect("ocr_required_pages");

        let conn = Connection::open_in_memory().expect("open in-memory db");
        apply_schema(&conn).expect("apply schema");
        let case = create_case(&conn, "OKOKRIM 10000 stress", "NO").expect("create case");

        let path = std::path::Path::new(&pdf_path);
        let started = std::time::Instant::now();
        let sha256 = crate::hash::sha256_file(path).expect("hash stress pdf");
        let extraction = crate::ingestion::extract_document(path).expect("extract stress pdf");
        println!(
            "extraction: pages={} chunks={} warnings={:?} elapsed={:?}",
            extraction.page_count,
            extraction.chunks.len(),
            extraction.warnings,
            started.elapsed()
        );
        let report = insert_document(
            &conn,
            &case.id,
            path.file_name().and_then(|value| value.to_str()).unwrap_or("stress.pdf"),
            &pdf_path,
            &sha256,
            &extraction,
        )
        .expect("insert stress document");
        let audit = get_case_coverage_audit(&conn, &case.id).expect("coverage audit");
        let document = audit.documents.first().expect("document audit");
        let all_sources = list_source_objects(&conn, &case.id).expect("all sources");
        let visible_pages = all_sources
            .iter()
            .map(|source| source.page_start)
            .collect::<std::collections::BTreeSet<_>>();
        let gold_findings = manifest["gold_findings"].as_array().expect("gold findings");
        let mut text_layer_gold_present = 0;
        let mut text_layer_gold_visible = 0;
        let mut ocr_gold_visible_before_ocr = 0;
        for finding in gold_findings {
            let page = finding["page"].as_i64().expect("finding page");
            let requires_ocr = finding["requires_ocr"].as_bool().unwrap_or(false);
            let exists: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM source_objects WHERE case_id = ?1 AND page_start <= ?2 AND page_end >= ?2",
                    params![case.id.as_str(), page],
                    |row| row.get(0),
                )
                .expect("gold source lookup");
            if !requires_ocr && exists > 0 {
                text_layer_gold_present += 1;
            }
            if !requires_ocr && visible_pages.contains(&page) {
                text_layer_gold_visible += 1;
            }
            if requires_ocr && visible_pages.contains(&page) {
                ocr_gold_visible_before_ocr += 1;
            }
            println!(
                "gold {} page={} requires_ocr={} source_exists={} visible_to_saksrom={}",
                finding["id"].as_str().unwrap_or("?"),
                page,
                requires_ocr,
                exists > 0,
                visible_pages.contains(&page)
            );
        }

        println!(
            "coverage: total={} processed={} with_sources={} missing={} pending_text={} coverage={} sources={} visible_gold_text={}",
            audit.total_pages,
            audit.processed_pages,
            audit.pages_with_sources,
            audit.pages_missing_sources,
            audit.pending_text_recognition_pages,
            audit.source_coverage_percent,
            all_sources.len(),
            text_layer_gold_visible
        );

        let expected_text_layer_gold = gold_findings
            .iter()
            .filter(|finding| !finding["requires_ocr"].as_bool().unwrap_or(false))
            .count();
        assert_eq!(audit.total_pages, expected_pages);
        assert_eq!(document.page_count, expected_pages);
        assert_eq!(audit.processed_pages, expected_pages);
        assert_eq!(audit.pending_text_recognition_pages, expected_ocr_pages);
        assert!(audit.source_coverage_percent >= minimum_coverage);
        assert!(audit.source_coverage_percent < 100.0);
        assert_eq!(audit.failed_documents, 0);
        assert!(report.sources_created > 0);
        assert_eq!(all_sources.len() as i64, audit.source_count);
        assert_eq!(text_layer_gold_present, expected_text_layer_gold);
        assert_eq!(text_layer_gold_visible, expected_text_layer_gold);
        assert_eq!(ocr_gold_visible_before_ocr, 0);
    }
}
