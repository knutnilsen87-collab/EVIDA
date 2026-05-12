use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseSummary {
    pub id: String,
    pub name: String,
    pub case_number: Option<String>,
    pub jurisdiction: String,
    pub status: String,
    pub document_count: i64,
    pub page_count: i64,
    pub source_coverage_percent: f64,
    pub risk_level: String,
    pub updated_at: String,
    pub last_opened_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSetting {
    pub key: String,
    pub value_json: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecuritySettings {
    pub local_processing_default: bool,
    pub external_ai_enabled: bool,
    pub allow_source_excerpt_sending: bool,
    pub allow_full_document_sending: bool,
    pub require_external_ai_confirmation: bool,
    pub redact_logs: bool,
    pub block_export_without_control: bool,
    pub screen_sharing_mode: bool,
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
pub struct ImportSession {
    pub id: String,
    pub case_id: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub total_files_seen: i64,
    pub files_ready: i64,
    pub files_partial: i64,
    pub files_requires_ocr: i64,
    pub files_duplicate: i64,
    pub files_unsupported: i64,
    pub files_failed: i64,
    pub pages_total: i64,
    pub pages_with_text: i64,
    pub pages_requires_ocr: i64,
    pub source_objects_created: i64,
    pub source_coverage_percent: f64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportItem {
    pub id: String,
    pub import_session_id: String,
    pub case_id: String,
    pub original_path: String,
    pub original_name: String,
    pub extension: Option<String>,
    pub detected_mime_type: Option<String>,
    pub file_size: Option<i64>,
    pub sha256: Option<String>,
    pub status: String,
    pub issue_code: Option<String>,
    pub issue_severity: Option<String>,
    pub user_message: String,
    pub technical_message: Option<String>,
    pub recommended_action: String,
    pub can_retry: bool,
    pub can_continue: bool,
    pub page_count: i64,
    pub pages_with_text: i64,
    pub pages_requires_ocr: i64,
    pub source_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportHealthSummary {
    pub case_id: String,
    pub latest_session: Option<ImportSession>,
    pub items: Vec<ImportItem>,
    pub overall_status: String,
    pub status_title: String,
    pub reason: String,
    pub consequence: String,
    pub recommended_action: String,
    pub can_open_preliminary: bool,
    pub source_coverage_percent: f64,
    pub missing_files_count: i64,
    pub missing_pages_count: i64,
    pub verification: Option<ImportVerificationResult>,
    pub readiness: Option<CaseReadinessReport>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportVerificationResult {
    pub id: String,
    pub import_session_id: String,
    pub case_id: String,
    pub status: String,
    pub total_items: i64,
    pub terminal_items: i64,
    pub processing_items: i64,
    pub exception_items: i64,
    pub invariant_failures_json: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseReadinessReport {
    pub id: String,
    pub case_id: String,
    pub import_session_id: Option<String>,
    pub readiness_state: String,
    pub source_coverage_percent: f64,
    pub missing_files_count: i64,
    pub missing_pages_count: i64,
    pub can_open_preliminary: bool,
    pub banner_message: String,
    pub recommended_action: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportControlResult {
    pub session: ImportSession,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceSearchResult {
    pub source_id: String,
    pub case_id: String,
    pub document_id: String,
    pub document_name: String,
    pub page_start: i64,
    pub page_end: i64,
    pub snippet: String,
    pub score: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrResult {
    pub id: String,
    pub case_id: String,
    pub import_item_id: Option<String>,
    pub document_id: Option<String>,
    pub page_id: Option<String>,
    pub page_number: Option<i64>,
    pub engine: String,
    pub status: String,
    pub confidence: Option<f64>,
    pub issue_code: Option<String>,
    pub user_message: String,
    pub technical_message: Option<String>,
    pub recommended_action: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManualReviewItem {
    pub id: String,
    pub case_id: String,
    pub import_session_id: Option<String>,
    pub import_item_id: Option<String>,
    pub document_id: Option<String>,
    pub page_id: Option<String>,
    pub review_type: String,
    pub severity: String,
    pub status: String,
    pub reason: String,
    pub recommended_action: String,
    pub ai_usable: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManualReviewAction {
    pub id: String,
    pub review_item_id: String,
    pub case_id: String,
    pub action: String,
    pub note: Option<String>,
    pub actor: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceQualityReport {
    pub case_id: String,
    pub total_documents: i64,
    pub duplicate_groups: i64,
    pub duplicate_documents: i64,
    pub attachment_like_documents: i64,
    pub citation_checks: i64,
    pub citation_failures: i64,
    pub source_map_rows: i64,
    pub chain_of_custody_rows: i64,
    pub warnings: Vec<String>,
    pub recommended_action: String,
    pub generated_at: String,
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
pub struct DocumentCoverageAudit {
    pub document_id: String,
    pub original_name: String,
    pub page_count: i64,
    pub processed_pages: i64,
    pub pages_with_sources: i64,
    pub pages_missing_sources: i64,
    pub pending_text_recognition_pages: i64,
    pub source_count: i64,
    pub source_coverage_percent: f64,
    pub ocr_status: String,
    pub status: String,
    pub missing_page_ranges: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseCoverageAudit {
    pub case_id: String,
    pub total_documents: i64,
    pub processed_documents: i64,
    pub total_pages: i64,
    pub processed_pages: i64,
    pub pages_with_sources: i64,
    pub pages_missing_sources: i64,
    pub source_count: i64,
    pub failed_documents: i64,
    pub documents_requiring_attention: i64,
    pub pending_text_recognition_pages: i64,
    pub source_coverage_percent: f64,
    pub has_active_processing: bool,
    pub documents: Vec<DocumentCoverageAudit>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentEngineStatus {
    pub local_engine_available: bool,
    pub embedded_text_extraction_available: bool,
    pub image_text_recognition_available: bool,
    pub pdf_page_renderer_available: bool,
    pub automatic_text_recognition_available: bool,
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
pub struct AuditVerificationReport {
    pub status: String,
    pub events_checked: usize,
    pub broken_at: Option<String>,
    pub reason: Option<String>,
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
