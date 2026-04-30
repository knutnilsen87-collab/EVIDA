use crate::domain::{AuditEvent, CaseSummary, DocumentIngestionReport, DocumentSummary, SourceObjectSummary};
use crate::ingestion::DocumentExtraction;
use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::{params, Connection};
use std::path::PathBuf;
use uuid::Uuid;

pub fn default_db_path() -> Result<PathBuf> {
    let base = dirs::data_local_dir()
        .context("Could not resolve local data directory")?
        .join("SaksromPro");
    std::fs::create_dir_all(&base)?;
    Ok(base.join("saksrom.local.sqlite3"))
}

pub fn open_connection() -> Result<Connection> {
    let path = default_db_path()?;
    let conn = Connection::open(path)?;
    apply_schema(&conn)?;
    Ok(conn)
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
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_documents_case ON documents(case_id);
        CREATE INDEX IF NOT EXISTS idx_pages_document ON pages(document_id);
        CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
        CREATE INDEX IF NOT EXISTS idx_source_case ON source_objects(case_id);
        CREATE INDEX IF NOT EXISTS idx_source_document ON source_objects(document_id);
        CREATE INDEX IF NOT EXISTS idx_audit_case ON audit_events(case_id);
        "#,
    )?;

    add_column_if_missing(conn, "documents", "mime_type", "TEXT")?;
    add_column_if_missing(conn, "documents", "ocr_quality", "REAL")?;
    add_column_if_missing(conn, "documents", "exhibit_id", "TEXT")?;

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
        WHERE c.id = ?1
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
                chunk.text,
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
                truncate_excerpt(&chunk.text),
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
            bates_start: row.get(10)?,
            bates_end: row.get(11)?,
            exhibit_id: row.get(12)?,
            imported_at: row.get(13)?,
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
            bates_start: row.get(10)?,
            bates_end: row.get(11)?,
            exhibit_id: row.get(12)?,
            imported_at: row.get(13)?,
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
            text_excerpt: row.get(6)?,
            sha256: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?;

    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}
