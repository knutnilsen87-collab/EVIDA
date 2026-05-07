export type CaseStatus = "active" | "archived" | "deleted";

export type ViewKey =
  | "overview"
  | "documents"
  | "caseRoom"
  | "chronology"
  | "evidence"
  | "arguments"
  | "contradictions"
  | "risk"
  | "litigation"
  | "draft"
  | "control"
  | "export";

export interface CaseSummary {
  id: string;
  name: string;
  jurisdiction: string;
  status: CaseStatus;
  document_count: number;
  page_count: number;
  source_coverage_percent: number;
  risk_level: "low" | "medium" | "high" | "unknown";
  updated_at: string;
}

export type ReadinessVerdictStatus =
  | "not_ready"
  | "needs_control"
  | "preliminary_ready"
  | "draft_ready";

export interface CaseReadinessVerdict {
  status: ReadinessVerdictStatus;
  label: string;
  description: string;
  detail: string;
  nextStep: string;
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

export interface ReindexReport {
  documents_processed: number;
  sources_created: number;
  pages_created: number;
  chunks_created: number;
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
