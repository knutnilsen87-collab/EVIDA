export type CaseStatus = "active" | "archived" | "deleted";

export type ViewKey =
  | "overview"
  | "documents"
  | "chronology"
  | "evidence"
  | "arguments"
  | "contradictions"
  | "risk"
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

export interface MaintenanceReport {
  message: string;
  path?: string;
  cases_deleted?: number;
  documents_deleted?: number;
  sources_deleted?: number;
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
