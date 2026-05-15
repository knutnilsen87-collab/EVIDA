export type CaseStatus = "active" | "archived" | "deleted";

export type ViewKey =
  | "overview"
  | "documents"
  | "documentControl"
  | "caseRoom"
  | "chronology"
  | "evidence"
  | "arguments"
  | "contradictions"
  | "risk"
  | "litigationSimulation"
  | "draft"
  | "control"
  | "export";

export interface CaseSummary {
  id: string;
  name: string;
  case_number?: string | null;
  jurisdiction: string;
  status: CaseStatus;
  document_count: number;
  page_count: number;
  source_coverage_percent: number;
  risk_level: "low" | "medium" | "high" | "unknown";
  updated_at: string;
  last_opened_at?: string | null;
}

export interface WindowCaseContext {
  windowId: string;
  caseId: string | null;
  displayName: string;
  caseNumber?: string | null;
  workspaceView: ViewKey;
}

export interface AppSetting {
  key: string;
  value_json: string;
  updated_at: string;
}

export interface SecuritySettings {
  local_processing_default: boolean;
  external_ai_enabled: boolean;
  allow_source_excerpt_sending: boolean;
  allow_full_document_sending: boolean;
  require_external_ai_confirmation: boolean;
  encrypt_case_metadata: boolean;
  encrypt_source_excerpts: boolean;
  encrypt_chat_log: boolean;
  encrypt_export_buffer: boolean;
  redact_logs: boolean;
  no_document_text_logs: boolean;
  no_chat_logs: boolean;
  no_sensitive_path_logs: boolean;
  block_export_without_control: boolean;
  include_sources_in_export: boolean;
  mark_exports_with_coverage: boolean;
  allow_export_without_control: boolean;
  screen_sharing_mode: boolean;
  hide_sensitive_previews: boolean;
  hide_document_names_in_screen_share: boolean;
  hide_party_names_in_window_title: boolean;
  auto_lock: "never" | "5" | "15" | "30" | "system_lock";
  answer_length: "short" | "balanced" | "detailed";
  answer_structure: "standard" | "sources_first" | "assessment_first";
  show_work_states: boolean;
  progressive_answer_reveal: boolean;
  follow_answer_while_writing: boolean;
  show_suggested_next_steps: boolean;
  allow_numbered_followups: boolean;
  adapt_workstyle_locally: boolean;
  auto_process_documents: boolean;
  show_processing_in_case_room: boolean;
  hide_technical_details_by_default: boolean;
  preliminary_summary_threshold: number;
  draft_control_threshold: number;
  warn_on_large_files: boolean;
  preserve_originals_locally: boolean;
  keep_encrypted_copy_only: boolean;
  provider_mode: "off" | "local" | "external";
  text_size: "normal" | "large" | "extra_large";
  high_contrast: boolean;
  reduce_motion: boolean;
  disable_typewriter_effect: boolean;
  disable_auto_scroll_while_answering: boolean;
  announce_import_status: boolean;
  announce_answer_completion: boolean;
  announce_summary_ready: boolean;
  automatic_local_backup: boolean;
  encrypted_backup: boolean;
  backup_frequency: "off" | "daily" | "weekly";
}

export interface MaintenanceReport {
  message: string;
  path?: string;
  cases_deleted?: number;
  documents_deleted?: number;
  sources_deleted?: number;
}

export interface DatabaseSecurityStatus {
  encrypted_at_rest: boolean;
  cipher: string;
  key_source: string;
  database_path: string;
  plaintext_backups: number;
  warnings: string[];
}

export interface DocumentSummary {
  id: string;
  case_id: string;
  original_name: string;
  local_path: string;
  mime_type?: string;
  sha256: string;
  page_count: number;
  ocr_status:
    | "not_started"
    | "running"
    | "ok"
    | "weak"
    | "failed"
    | "not_required"
    | "empty"
    | "unsupported_file_type"
    | "text_extracted"
    | "partial_needs_ocr"
    | "needs_ocr";
  source_count: number;
  source_coverage_percent: number;
  analyzed_page_count: number;
  pending_ocr_page_count: number;
  bates_start?: string;
  bates_end?: string;
  exhibit_id?: string;
  imported_at: string;
}

export interface SourceObjectSummary {
  id: string;
  case_id: string;
  document_id: string;
  chunk_id?: string;
  page_start: number;
  page_end: number;
  text_excerpt: string;
  sha256: string;
  created_at: string;
}

export interface DocumentIngestionReport {
  document: DocumentSummary;
  sources_created: number;
  pages_created: number;
  chunks_created: number;
  warnings: string[];
}

export type ImportItemStatus =
  | "queued"
  | "validating"
  | "hashing"
  | "extracting_text"
  | "ocr_required"
  | "ocr_running"
  | "chunking"
  | "indexed"
  | "ready"
  | "partial"
  | "duplicate"
  | "unsupported"
  | "failed"
  | "cancelled";

export type ImportIssueCode =
  | "OCR_REQUIRED"
  | "UNSUPPORTED_FILE_TYPE"
  | "TYPE_MISMATCH"
  | "FILE_PERMISSION_DENIED"
  | "ARCHIVE_PATH_TRAVERSAL_BLOCKED"
  | "ARCHIVE_BOMB_RISK"
  | "CORRUPT_FILE"
  | "ZERO_BYTE_FILE"
  | "DUPLICATE_FILE"
  | "TEXT_EXTRACTION_FAILED"
  | "PARTIAL_TEXT_EXTRACTION"
  | "PASSWORD_PROTECTED"
  | "FILE_TOO_LARGE"
  | "PATH_NOT_FILE"
  | "UNKNOWN_ERROR";

export interface ImportSession {
  id: string;
  case_id: string;
  started_at: string;
  completed_at?: string | null;
  total_files_seen: number;
  files_ready: number;
  files_partial: number;
  files_requires_ocr: number;
  files_duplicate: number;
  files_unsupported: number;
  files_failed: number;
  pages_total: number;
  pages_with_text: number;
  pages_requires_ocr: number;
  source_objects_created: number;
  source_coverage_percent: number;
  status: string;
}

export interface ImportItem {
  id: string;
  import_session_id: string;
  case_id: string;
  original_path: string;
  original_name: string;
  extension?: string | null;
  detected_mime_type?: string | null;
  file_size?: number | null;
  sha256?: string | null;
  status: ImportItemStatus;
  issue_code?: ImportIssueCode | null;
  issue_severity?: "info" | "warning" | "error" | null;
  user_message: string;
  technical_message?: string | null;
  recommended_action: string;
  can_retry: boolean;
  can_continue: boolean;
  page_count: number;
  pages_with_text: number;
  pages_requires_ocr: number;
  source_count: number;
  created_at: string;
  updated_at: string;
}

export interface ImportHealthSummary {
  case_id: string;
  latest_session?: ImportSession | null;
  items: ImportItem[];
  overall_status: "processing" | "incomplete" | "ready" | string;
  status_title: string;
  reason: string;
  consequence: string;
  recommended_action: string;
  can_open_preliminary: boolean;
  source_coverage_percent: number;
  missing_files_count: number;
  missing_pages_count: number;
  verification?: ImportVerificationResult | null;
  readiness?: CaseReadinessReport | null;
}

export interface ImportVerificationResult {
  id: string;
  import_session_id: string;
  case_id: string;
  status: string;
  total_items: number;
  terminal_items: number;
  processing_items: number;
  exception_items: number;
  invariant_failures_json: string;
  created_at: string;
}

export interface CaseReadinessReport {
  id: string;
  case_id: string;
  import_session_id?: string | null;
  readiness_state: string;
  source_coverage_percent: number;
  missing_files_count: number;
  missing_pages_count: number;
  can_open_preliminary: boolean;
  banner_message: string;
  recommended_action: string;
  created_at: string;
}

export interface ImportControlResult {
  session: ImportSession;
  message: string;
}

export interface SourceSearchResult {
  source_id: string;
  case_id: string;
  document_id: string;
  document_name: string;
  page_start: number;
  page_end: number;
  snippet: string;
  score: number;
}

export interface OcrResult {
  id: string;
  case_id: string;
  import_item_id?: string | null;
  document_id?: string | null;
  page_id?: string | null;
  page_number?: number | null;
  engine: string;
  status: string;
  confidence?: number | null;
  issue_code?: string | null;
  user_message: string;
  technical_message?: string | null;
  recommended_action: string;
  created_at: string;
  updated_at: string;
}

export interface ManualReviewItem {
  id: string;
  case_id: string;
  import_session_id?: string | null;
  import_item_id?: string | null;
  document_id?: string | null;
  page_id?: string | null;
  review_type: string;
  severity: string;
  status: string;
  reason: string;
  recommended_action: string;
  ai_usable: boolean;
  created_at: string;
  updated_at: string;
}

export interface ManualReviewAction {
  id: string;
  review_item_id: string;
  case_id: string;
  action: string;
  note?: string | null;
  actor: string;
  created_at: string;
}

export interface EvidenceQualityReport {
  case_id: string;
  total_documents: number;
  duplicate_groups: number;
  duplicate_documents: number;
  attachment_like_documents: number;
  citation_checks: number;
  citation_failures: number;
  source_map_rows: number;
  chain_of_custody_rows: number;
  warnings: string[];
  recommended_action: string;
  generated_at: string;
}

export interface ReindexReport {
  documents_processed: number;
  sources_created: number;
  pages_created: number;
  chunks_created: number;
  warnings: string[];
}

export interface DocumentCoverageAudit {
  document_id: string;
  original_name: string;
  page_count: number;
  processed_pages: number;
  pages_with_sources: number;
  pages_missing_sources: number;
  pending_text_recognition_pages: number;
  source_count: number;
  source_coverage_percent: number;
  ocr_status: string;
  status: string;
  missing_page_ranges: string[];
  warnings: string[];
}

export interface CaseCoverageAudit {
  case_id: string;
  total_documents: number;
  processed_documents: number;
  total_pages: number;
  processed_pages: number;
  pages_with_sources: number;
  pages_missing_sources: number;
  source_count: number;
  failed_documents: number;
  documents_requiring_attention: number;
  pending_text_recognition_pages: number;
  source_coverage_percent: number;
  has_active_processing: boolean;
  documents: DocumentCoverageAudit[];
  warnings: string[];
}

export interface DocumentEngineStatus {
  local_engine_available: boolean;
  embedded_text_extraction_available: boolean;
  image_text_recognition_available: boolean;
  pdf_page_renderer_available: boolean;
  automatic_text_recognition_available: boolean;
  warnings: string[];
}

export interface AuditEvent {
  id: string;
  case_id?: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  result: "PASS" | "WARN" | "FAIL";
  created_at: string;
}

export interface ChronologyEventDto {
  id: string;
  case_id: string;
  date_text: string;
  event: string;
  source_id: string;
  status: string;
  uncertainty: string;
  updated_at: string;
}

export interface EvidenceItemDto {
  id: string;
  case_id: string;
  claim: string;
  supporting_source_ids: string[];
  weakening_source_ids: string[];
  strength: string;
  status: string;
  updated_at: string;
}

export interface ArgumentItemDto {
  id: string;
  case_id: string;
  argument: string;
  factual_basis: string;
  legal_basis: string;
  evidence_source_ids: string[];
  status: string;
  updated_at: string;
}

export interface ContradictionItemDto {
  id: string;
  case_id: string;
  topic: string;
  source_a_id: string;
  source_b_id: string;
  conflict: string;
  significance: string;
  status: string;
  updated_at: string;
}

export interface RiskItemDto {
  id: string;
  case_id: string;
  risk: string;
  severity: string;
  affected_arguments: string;
  source_basis: string;
  recommended_action: string;
  updated_at: string;
}

export interface WorkItemsDto {
  chronology: ChronologyEventDto[];
  evidence: EvidenceItemDto[];
  arguments: ArgumentItemDto[];
  contradictions: ContradictionItemDto[];
  risks: RiskItemDto[];
}

export interface CaseAiMessageSourceDto {
  id: string;
  message_id: string;
  source_id: string;
  document_id: string;
  page_number?: number;
  validation_status: "PASS" | "FAIL" | string;
  created_at: string;
}

export interface CaseAiMessageDto {
  id: string;
  session_id: string;
  case_id: string;
  role: "assistant" | "user" | string;
  content: string;
  answer_json?: string;
  model_id?: string;
  prompt_version?: string;
  source_index_version?: string;
  created_at: string;
  sources: CaseAiMessageSourceDto[];
}
