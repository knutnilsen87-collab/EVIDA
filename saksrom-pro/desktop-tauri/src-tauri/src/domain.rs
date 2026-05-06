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
    pub analyzed_page_count: i64,
    pub pending_ocr_page_count: i64,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaintenanceReport {
    pub message: String,
    pub path: Option<String>,
    pub cases_deleted: Option<i64>,
    pub documents_deleted: Option<i64>,
    pub sources_deleted: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseSecurityStatus {
    pub encrypted_at_rest: bool,
    pub cipher: String,
    pub key_source: String,
    pub database_path: String,
    pub plaintext_backups: i64,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChronologyEvent {
    pub id: String,
    pub case_id: String,
    pub date_text: String,
    pub event: String,
    pub source_id: String,
    pub status: String,
    pub uncertainty: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceItem {
    pub id: String,
    pub case_id: String,
    pub claim: String,
    pub supporting_source_ids: Vec<String>,
    pub weakening_source_ids: Vec<String>,
    pub strength: String,
    pub status: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArgumentItem {
    pub id: String,
    pub case_id: String,
    pub argument: String,
    pub factual_basis: String,
    pub legal_basis: String,
    pub evidence_source_ids: Vec<String>,
    pub status: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContradictionItem {
    pub id: String,
    pub case_id: String,
    pub topic: String,
    pub source_a_id: String,
    pub source_b_id: String,
    pub conflict: String,
    pub significance: String,
    pub status: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskItem {
    pub id: String,
    pub case_id: String,
    pub risk: String,
    pub severity: String,
    pub affected_arguments: String,
    pub source_basis: String,
    pub recommended_action: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkItems {
    pub chronology: Vec<ChronologyEvent>,
    pub evidence: Vec<EvidenceItem>,
    pub arguments: Vec<ArgumentItem>,
    pub contradictions: Vec<ContradictionItem>,
    pub risks: Vec<RiskItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseAiMessageSource {
    pub id: String,
    pub message_id: String,
    pub source_id: String,
    pub document_id: String,
    pub page_number: Option<i64>,
    pub validation_status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseAiMessage {
    pub id: String,
    pub session_id: String,
    pub case_id: String,
    pub role: String,
    pub content: String,
    pub answer_json: Option<String>,
    pub model_id: Option<String>,
    pub prompt_version: Option<String>,
    pub source_index_version: Option<String>,
    pub created_at: String,
    pub sources: Vec<CaseAiMessageSource>,
}
