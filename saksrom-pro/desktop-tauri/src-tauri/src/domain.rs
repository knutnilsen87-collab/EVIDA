use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseSummary {
    pub id: String,
    pub name: String,
    pub jurisdiction: String,
    pub status: String,
    pub document_count: i64,
    pub page_count: i64,
    pub source_coverage_percent: f64,
    pub risk_level: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentSummary {
    pub id: String,
    pub case_id: String,
    pub original_name: String,
    pub local_path: String,
    pub mime_type: Option<String>,
    pub sha256: String,
    pub page_count: i64,
    pub ocr_status: String,
    pub source_count: i64,
    pub source_coverage_percent: f64,
    pub bates_start: Option<String>,
    pub bates_end: Option<String>,
    pub exhibit_id: Option<String>,
    pub imported_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceObjectSummary {
    pub id: String,
    pub case_id: String,
    pub document_id: String,
    pub chunk_id: Option<String>,
    pub page_start: i64,
    pub page_end: i64,
    pub text_excerpt: String,
    pub sha256: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentIngestionReport {
    pub document: DocumentSummary,
    pub sources_created: i64,
    pub pages_created: i64,
    pub chunks_created: i64,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReindexReport {
    pub documents_processed: i64,
    pub sources_created: i64,
    pub pages_created: i64,
    pub chunks_created: i64,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: String,
    pub case_id: Option<String>,
    pub actor: String,
    pub action: String,
    pub target_type: String,
    pub target_id: String,
    pub result: String,
    pub created_at: String,
}
