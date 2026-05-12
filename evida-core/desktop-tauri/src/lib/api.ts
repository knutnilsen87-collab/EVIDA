import { invoke } from "@tauri-apps/api/core";
import type {
  AuditEvent,
  AppSetting,
  CaseSummary,
  DatabaseSecurityStatus,
  DocumentIngestionReport,
  CaseCoverageAudit,
  DocumentEngineStatus,
  DocumentSummary,
  ImportHealthSummary,
  ImportItem,
  ImportControlResult,
  ImportSession,
  EvidenceQualityReport,
  MaintenanceReport,
  ManualReviewAction,
  ManualReviewItem,
  OcrResult,
  ReindexReport,
  SourceObjectSummary,
  SourceSearchResult,
  WorkItemsDto,
  ChronologyEventDto,
  EvidenceItemDto,
  ArgumentItemDto,
  ContradictionItemDto,
  RiskItemDto,
  CaseAiMessageDto
} from "../types";

const STORE_KEY = "evida-dev-store-v1";
const SETTINGS_STORE_KEY = "evida-settings-dev-v1";

interface DevStore {
  cases: CaseSummary[];
  documents: DocumentSummary[];
  sources: SourceObjectSummary[];
  audit: AuditEvent[];
  workItems: Record<string, WorkItemsDto>;
  aiMessages: Record<string, CaseAiMessageDto[]>;
}

function hasTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

export function hasDesktopRuntime() {
  return hasTauriRuntime();
}

async function callTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!hasTauriRuntime()) {
    throw new Error("Tauri runtime not available");
  }
  return invoke<T>(command, args);
}

function readStore(): DevStore {
  const raw = window.localStorage.getItem(STORE_KEY);
  if (!raw) {
    return { cases: [], documents: [], sources: [], audit: [], workItems: {}, aiMessages: {} };
  }
  const parsed = JSON.parse(raw) as Partial<DevStore>;
  return {
    cases: parsed.cases || [],
    documents: parsed.documents || [],
    sources: parsed.sources || [],
    audit: parsed.audit || [],
    workItems: parsed.workItems || {},
    aiMessages: parsed.aiMessages || {}
  };
}

function writeStore(store: DevStore) {
  window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function emptyWorkItems(): WorkItemsDto {
  return { chronology: [], evidence: [], arguments: [], contradictions: [], risks: [] };
}

function sentence(value: string) {
  const first = value.split(/[.!?]\s/)[0] || value;
  return first.length > 150 ? `${first.slice(0, 147)}...` : first;
}

function appendAudit(
  store: DevStore,
  event: Omit<AuditEvent, "id" | "actor" | "result" | "created_at">
) {
  store.audit.unshift({
    id: id("AUD"),
    actor: "browser-dev-user",
    result: "PASS",
    created_at: now(),
    ...event
  });
}

export async function getAppStatus(): Promise<string> {
  try {
    return await callTauri<string>("get_app_status");
  } catch {
    return "Dev webmodus: Tauri ikke aktiv, bruker lokal browser-store.";
  }
}

export async function getDatabaseSecurityStatus(): Promise<DatabaseSecurityStatus> {
  try {
    return await callTauri<DatabaseSecurityStatus>("get_database_security_status");
  } catch {
    return {
      encrypted_at_rest: false,
      cipher: "browser-dev-store",
      key_source: "not_available_in_browser",
      database_path: "localStorage",
      plaintext_backups: 0,
      warnings: ["Desktop security status is only available in the Tauri app."]
    };
  }
}

export async function createCase(name: string, jurisdiction = "NO"): Promise<CaseSummary> {
  try {
    return await callTauri<CaseSummary>("create_case", { name, jurisdiction });
  } catch {
    const store = readStore();
    const created: CaseSummary = {
      id: id("CASE"),
      name,
      case_number: null,
      jurisdiction,
      status: "active",
      document_count: 0,
      page_count: 0,
      source_coverage_percent: 0,
      risk_level: "unknown",
      updated_at: now(),
      last_opened_at: now()
    };
    store.cases.unshift(created);
    appendAudit(store, {
      case_id: created.id,
      action: "case.create",
      target_type: "case",
      target_id: created.id
    });
    writeStore(store);
    return created;
  }
}

export async function setCaseNumber(caseId: string, caseNumber: string | null): Promise<CaseSummary> {
  try {
    return await callTauri<CaseSummary>("set_case_number", { caseId, caseNumber });
  } catch {
    const store = readStore();
    let updated: CaseSummary | undefined;
    store.cases = store.cases.map((item) => {
      if (item.id !== caseId) {
        return item;
      }
      updated = { ...item, case_number: caseNumber, updated_at: now() };
      return updated;
    });
    writeStore(store);
    if (!updated) {
      throw new Error("Fant ikke saken.");
    }
    return updated;
  }
}

export async function markCaseOpened(caseId: string): Promise<void> {
  try {
    await callTauri<void>("mark_case_opened", { caseId });
  } catch {
    const store = readStore();
    store.cases = store.cases.map((item) =>
      item.id === caseId ? { ...item, last_opened_at: now(), updated_at: now() } : item
    );
    writeStore(store);
  }
}

export async function openNewCaseWindow(): Promise<CaseSummary> {
  return await callTauri<CaseSummary>("open_new_case_window");
}

export async function openCaseWindow(caseId: string): Promise<void> {
  await callTauri<void>("open_case_window", { caseId });
}

export async function setCurrentWindowTitle(windowLabel: string, title: string): Promise<void> {
  try {
    await callTauri<void>("set_current_window_title", { windowLabel, title });
  } catch {
    document.title = title;
  }
}

function readSettingsStore(): Record<string, AppSetting> {
  const raw = window.localStorage.getItem(SETTINGS_STORE_KEY);
  return raw ? JSON.parse(raw) : {};
}

function writeSettingsStore(settings: Record<string, AppSetting>) {
  window.localStorage.setItem(SETTINGS_STORE_KEY, JSON.stringify(settings));
}

export async function listSettings(): Promise<AppSetting[]> {
  try {
    return await callTauri<AppSetting[]>("list_settings");
  } catch {
    return Object.values(readSettingsStore());
  }
}

export async function getSetting(key: string): Promise<string | null> {
  try {
    return await callTauri<string | null>("get_setting", { key });
  } catch {
    return readSettingsStore()[key]?.value_json ?? null;
  }
}

export async function setSetting(key: string, valueJson: string): Promise<void> {
  try {
    await callTauri<void>("set_setting", { key, valueJson });
  } catch {
    JSON.parse(valueJson);
    const settings = readSettingsStore();
    settings[key] = { key, value_json: valueJson, updated_at: now() };
    writeSettingsStore(settings);
  }
}

export async function renameCase(caseId: string, name: string): Promise<CaseSummary> {
  try {
    return await callTauri<CaseSummary>("rename_case", { caseId, name });
  } catch {
    const cleanedName = name.trim();
    if (!cleanedName) {
      throw new Error("Saksnavn kan ikke være tomt.");
    }
    const store = readStore();
    let updated: CaseSummary | undefined;
    store.cases = store.cases.map((item) => {
      if (item.id !== caseId) {
        return item;
      }
      updated = { ...item, name: cleanedName, updated_at: now() };
      return updated;
    });
    appendAudit(store, {
      case_id: caseId,
      action: "CASE_RENAMED",
      target_type: "case",
      target_id: caseId
    });
    writeStore(store);
    if (!updated) {
      throw new Error("Fant ikke saken som skulle navngis.");
    }
    return updated;
  }
}

export async function listCases(): Promise<CaseSummary[]> {
  try {
    return await callTauri<CaseSummary[]>("list_cases");
  } catch {
    return readStore().cases.filter((item) => item.status !== "deleted");
  }
}

export async function softDeleteCase(caseId: string): Promise<void> {
  try {
    await callTauri<void>("soft_delete_case", { caseId });
  } catch {
    const store = readStore();
    store.cases = store.cases.map((item) =>
      item.id === caseId ? { ...item, status: "deleted", updated_at: now() } : item
    );
    appendAudit(store, {
      case_id: caseId,
      action: "CASE_SOFT_DELETED",
      target_type: "case",
      target_id: caseId
    });
    writeStore(store);
  }
}

export async function registerDocument(
  caseId: string,
  path: string
): Promise<DocumentIngestionReport> {
  try {
    return await callTauri<DocumentIngestionReport>("register_document", { caseId, path });
  } catch {
    const store = readStore();
    const name = path.split(/[\\/]/).pop() || "ukjent-dokument";
    const isPdf = name.toLowerCase().endsWith(".pdf");
    const document: DocumentSummary = {
      id: id("DOC"),
      case_id: caseId,
      original_name: name,
      local_path: path,
      mime_type: isPdf ? "application/pdf" : "text/plain",
      sha256: "dev-browser-placeholder",
      page_count: isPdf ? 1 : 1,
      ocr_status: isPdf ? "needs_ocr" : "not_required",
      source_count: isPdf ? 0 : 1,
      source_coverage_percent: isPdf ? 0 : 100,
      analyzed_page_count: isPdf ? 0 : 1,
      pending_ocr_page_count: isPdf ? 1 : 0,
      imported_at: now()
    };
    store.documents.unshift(document);
    if (!isPdf) {
      store.sources.unshift({
        id: id("SRC"),
        case_id: caseId,
        document_id: document.id,
        chunk_id: id("CHK"),
        page_start: 1,
        page_end: 1,
        text_excerpt: "Dev webmodus: kildeobjekt opprettet fra oppgitt filsti.",
        sha256: "dev-browser-placeholder",
        created_at: now()
      });
    }
    store.cases = store.cases.map((item) =>
      item.id === caseId
        ? {
            ...item,
            document_count: item.document_count + 1,
            page_count: item.page_count + document.page_count,
            source_coverage_percent: document.source_coverage_percent,
            updated_at: now()
          }
        : item
    );
    appendAudit(store, {
      case_id: caseId,
      action: "document.register",
      target_type: "document",
      target_id: document.id
    });
    writeStore(store);
    return {
      document,
      sources_created: document.source_count,
      pages_created: document.page_count,
      chunks_created: document.source_count,
      warnings: isPdf ? ["browser_dev_mode_no_file_access"] : []
    };
  }
}

export async function startImportSession(caseId: string, totalFilesSeen: number): Promise<ImportSession> {
  try {
    return await callTauri<ImportSession>("start_import_session", { caseId, totalFilesSeen });
  } catch {
    const started = now();
    return {
      id: id("IMP"),
      case_id: caseId,
      started_at: started,
      completed_at: null,
      total_files_seen: totalFilesSeen,
      files_ready: 0,
      files_partial: 0,
      files_requires_ocr: 0,
      files_duplicate: 0,
      files_unsupported: 0,
      files_failed: 0,
      pages_total: 0,
      pages_with_text: 0,
      pages_requires_ocr: 0,
      source_objects_created: 0,
      source_coverage_percent: 0,
      status: "running"
    };
  }
}

export async function completeImportSession(importSessionId: string): Promise<ImportSession> {
  try {
    return await callTauri<ImportSession>("complete_import_session", { importSessionId });
  } catch {
    return {
      id: importSessionId,
      case_id: "",
      started_at: now(),
      completed_at: now(),
      total_files_seen: 0,
      files_ready: 0,
      files_partial: 0,
      files_requires_ocr: 0,
      files_duplicate: 0,
      files_unsupported: 0,
      files_failed: 0,
      pages_total: 0,
      pages_with_text: 0,
      pages_requires_ocr: 0,
      source_objects_created: 0,
      source_coverage_percent: 0,
      status: "completed"
    };
  }
}

export async function registerDocumentInSession(
  importSessionId: string,
  caseId: string,
  path: string
): Promise<ImportItem> {
  try {
    return await callTauri<ImportItem>("register_document_in_session", { importSessionId, caseId, path });
  } catch (error) {
    const report = await registerDocument(caseId, path);
    return {
      id: id("IMI"),
      import_session_id: importSessionId,
      case_id: caseId,
      original_path: path,
      original_name: path.split(/[\\/]/).pop() || "ukjent-dokument",
      extension: path.split(".").pop() || null,
      detected_mime_type: report.document.mime_type,
      file_size: null,
      sha256: report.document.sha256,
      status: report.sources_created > 0 ? "ready" : "failed",
      issue_code: report.sources_created > 0 ? null : "TEXT_EXTRACTION_FAILED",
      issue_severity: report.sources_created > 0 ? null : "error",
      user_message:
        report.sources_created > 0
          ? "Klar - filen er importert med sporbare kilder."
          : `Feilet - dokumentet kunne ikke brukes som kilde. ${String(error)}`,
      technical_message: report.warnings.join(" | "),
      recommended_action: report.sources_created > 0 ? "Ingen handling nødvendig." : "Last opp en ny kopi eller kjør OCR.",
      can_retry: report.sources_created === 0,
      can_continue: report.sources_created > 0,
      page_count: report.pages_created,
      pages_with_text: report.sources_created,
      pages_requires_ocr: report.document.pending_ocr_page_count || 0,
      source_count: report.sources_created,
      created_at: now(),
      updated_at: now()
    };
  }
}

export async function getImportHealth(caseId: string): Promise<ImportHealthSummary> {
  try {
    return await callTauri<ImportHealthSummary>("get_import_health", { caseId });
  } catch {
    const audit = await getCaseCoverageAudit(caseId);
    return {
      case_id: caseId,
      latest_session: null,
      items: [],
      overall_status: audit.source_coverage_percent >= 100 ? "ready" : "incomplete",
      status_title:
        audit.source_coverage_percent >= 100
          ? "Importen er komplett"
          : "Importjobb ferdig, men dokumentgrunnlaget er ikke komplett.",
      reason: "Webmodus har begrenset tilgang til importloggen.",
      consequence: "Kontroller dokumentlisten og kildegrunnlaget.",
      recommended_action: "Kjør desktopversjonen for full importdiagnostikk.",
      can_open_preliminary: audit.source_count > 0,
      source_coverage_percent: audit.source_coverage_percent,
      missing_files_count: audit.failed_documents,
      missing_pages_count: audit.pending_text_recognition_pages + audit.pages_missing_sources,
      verification: null,
      readiness: {
        id: id("READY"),
        case_id: caseId,
        import_session_id: null,
        readiness_state: audit.source_coverage_percent >= 100 ? "ready" : audit.source_count > 0 ? "preliminary" : "not_ready",
        source_coverage_percent: audit.source_coverage_percent,
        missing_files_count: audit.failed_documents,
        missing_pages_count: audit.pending_text_recognition_pages + audit.pages_missing_sources,
        can_open_preliminary: audit.source_count > 0,
        banner_message:
          audit.source_count > 0
            ? `Saksrom kan brukes foreløpig basert på ${Math.round(audit.source_coverage_percent)} % av dokumentgrunnlaget. ${audit.pending_text_recognition_pages + audit.pages_missing_sources} sider er ikke lesbare ennå.`
            : "Saksrom venter på lesbart dokumentgrunnlag.",
        recommended_action: "Kjør desktopversjonen for full importdiagnostikk.",
        created_at: now()
      }
    };
  }
}

export async function pauseImportSession(importSessionId: string): Promise<ImportControlResult> {
  return await callTauri<ImportControlResult>("pause_import_session", { importSessionId });
}

export async function resumeImportSession(importSessionId: string): Promise<ImportControlResult> {
  return await callTauri<ImportControlResult>("resume_import_session", { importSessionId });
}

export async function cancelImportSession(importSessionId: string): Promise<ImportControlResult> {
  return await callTauri<ImportControlResult>("cancel_import_session", { importSessionId });
}

export async function searchSources(caseId: string, query: string, limit = 20): Promise<SourceSearchResult[]> {
  try {
    return await callTauri<SourceSearchResult[]>("search_sources", { caseId, query, limit });
  } catch {
    const sources = await listSourceObjects(caseId);
    const terms = query
      .toLowerCase()
      .split(/[^a-z0-9æøå]+/i)
      .filter((term) => term.length > 2);
    return sources
      .map((source) => {
        const haystack = source.text_excerpt.toLowerCase();
        const score = terms.filter((term) => haystack.includes(term)).length;
        return {
          source_id: source.id,
          case_id: source.case_id,
          document_id: source.document_id,
          document_name: source.document_id,
          page_start: source.page_start,
          page_end: source.page_end,
          snippet: source.text_excerpt.slice(0, 260),
          score
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export async function listOcrResults(caseId: string): Promise<OcrResult[]> {
  try {
    return await callTauri<OcrResult[]>("list_ocr_results", { caseId });
  } catch {
    return [];
  }
}

export async function runOcrForImportItem(importItemId: string): Promise<OcrResult[]> {
  return await callTauri<OcrResult[]>("run_ocr_for_import_item", { importItemId });
}

export async function listManualReviewItems(caseId: string): Promise<ManualReviewItem[]> {
  try {
    return await callTauri<ManualReviewItem[]>("list_manual_review_items", { caseId });
  } catch {
    return [];
  }
}

export async function applyManualReviewAction(
  reviewItemId: string,
  action: string,
  note?: string
): Promise<ManualReviewAction> {
  try {
    return await callTauri<ManualReviewAction>("apply_manual_review_action", { reviewItemId, action, note });
  } catch {
    throw new Error("Manual review kan bare lagres fra desktop-appen.");
  }
}

export async function recordDocumentControlAction(params: {
  caseId: string;
  documentId: string;
  action: "preview" | "approve_for_ai" | "reject_for_ai";
  note?: string;
}): Promise<MaintenanceReport> {
  try {
    return await callTauri<MaintenanceReport>("record_document_control_action", {
      caseId: params.caseId,
      documentId: params.documentId,
      action: params.action,
      note: params.note
    });
  } catch {
    const store = readStore();
    const actionMap = {
      preview: "DOCUMENT_PREVIEW_OPENED",
      approve_for_ai: "DOCUMENT_APPROVED_FOR_AI",
      reject_for_ai: "DOCUMENT_REJECTED_FOR_AI"
    };
    appendAudit(store, {
      case_id: params.caseId,
      action: actionMap[params.action],
      target_type: "document",
      target_id: params.documentId
    });
    writeStore(store);
    return { message: "Dokumentkontroll lagret i browser-store." };
  }
}

export async function refreshEvidenceQuality(caseId: string): Promise<EvidenceQualityReport> {
  try {
    return await callTauri<EvidenceQualityReport>("refresh_evidence_quality", { caseId });
  } catch {
    const [documents, sources] = await Promise.all([listDocuments(caseId), listSourceObjects(caseId)]);
    return {
      case_id: caseId,
      total_documents: documents.length,
      duplicate_groups: 0,
      duplicate_documents: 0,
      attachment_like_documents: documents.filter((document) =>
        /vedlegg|attachment|bilag/i.test(document.original_name)
      ).length,
      citation_checks: sources.length,
      citation_failures: 0,
      source_map_rows: sources.length,
      chain_of_custody_rows: documents.filter((document) => document.sha256).length,
      warnings: ["Evidence quality er begrenset i webmodus."],
      recommended_action: "Kjør desktopversjonen for full lokal evidence quality-rapport.",
      generated_at: now()
    };
  }
}

export async function exportEvidenceQualityPackage(caseId: string): Promise<MaintenanceReport> {
  try {
    return await callTauri<MaintenanceReport>("export_evidence_quality_package", { caseId });
  } catch {
    return { message: "Evidence quality export krever desktop-appen." };
  }
}

export async function listImportItems(caseId: string): Promise<ImportItem[]> {
  try {
    return await callTauri<ImportItem[]>("list_import_items", { caseId });
  } catch {
    return (await getImportHealth(caseId)).items;
  }
}

export async function removeImportItemFromCase(importItemId: string): Promise<ImportItem> {
  try {
    return await callTauri<ImportItem>("remove_import_item_from_case", { importItemId });
  } catch {
    throw new Error("Remove from case krever desktop-appen.");
  }
}

export async function chooseDocumentPaths(): Promise<string[]> {
  try {
    return await callTauri<string[]>("choose_document_paths");
  } catch {
    return [];
  }
}

export async function chooseDocumentFolderPaths(): Promise<string[]> {
  try {
    return await callTauri<string[]>("choose_document_folder_paths");
  } catch {
    return [];
  }
}

export async function expandImportPaths(paths: string[]): Promise<string[]> {
  try {
    return await callTauri<string[]>("expand_import_paths", { paths });
  } catch {
    return paths;
  }
}

export async function listDocuments(caseId: string): Promise<DocumentSummary[]> {
  try {
    return await callTauri<DocumentSummary[]>("list_documents", { caseId });
  } catch {
    return readStore().documents.filter((document) => document.case_id === caseId);
  }
}

export async function listSourceObjects(caseId: string): Promise<SourceObjectSummary[]> {
  try {
    return await callTauri<SourceObjectSummary[]>("list_source_objects", { caseId });
  } catch {
    return readStore().sources.filter((source) => source.case_id === caseId);
  }
}

export async function reindexCaseDocuments(caseId: string): Promise<ReindexReport> {
  try {
    return await callTauri<ReindexReport>("reindex_case_documents", { caseId });
  } catch {
    return {
      documents_processed: 0,
      sources_created: 0,
      pages_created: 0,
      chunks_created: 0,
      warnings: ["browser_dev_mode_no_reindex"]
    };
  }
}

export async function getCaseCoverageAudit(caseId: string): Promise<CaseCoverageAudit> {
  try {
    return await callTauri<CaseCoverageAudit>("get_case_coverage_audit", { caseId });
  } catch {
    const store = readStore();
    const documents = store.documents.filter((document) => document.case_id === caseId);
    const sources = store.sources.filter((source) => source.case_id === caseId);
    const documentAudits = documents.map((document) => {
      const coveredPages = new Set<number>();
      sources
        .filter((source) => source.document_id === document.id)
        .forEach((source) => {
          const start = Math.max(1, source.page_start || 1);
          const end = Math.max(start, source.page_end || start);
          for (let page = start; page <= end; page += 1) {
            coveredPages.add(page);
          }
        });
      const pagesWithSources = coveredPages.size;
      const pageCount = document.page_count || 0;
      const pagesMissingSources = pageCount > 0 ? Math.max(0, pageCount - pagesWithSources) : 0;
      return {
        document_id: document.id,
        original_name: document.original_name,
        page_count: pageCount,
        processed_pages: document.analyzed_page_count || pagesWithSources,
        pages_with_sources: pagesWithSources,
        pages_missing_sources: pagesMissingSources,
        pending_text_recognition_pages: document.pending_ocr_page_count || 0,
        source_count: document.source_count,
        source_coverage_percent: pageCount > 0 ? Math.round((pagesWithSources / pageCount) * 100) : 0,
        ocr_status: document.ocr_status,
        status: ["failed", "empty", "unsupported_file_type"].includes(document.ocr_status)
          ? "failed"
          : pagesMissingSources === 0 && pageCount > 0
            ? "ready"
            : pagesWithSources > 0
              ? "partially_ready"
              : "queued",
        missing_page_ranges: pagesMissingSources > 0 ? ["beregnes"] : [],
        warnings: pagesMissingSources > 0 ? [`${pagesMissingSources} sider mangler sporbare kilder.`] : []
      };
    });
    const totalPages = documentAudits.reduce((sum, item) => sum + item.page_count, 0);
    const pagesWithSources = documentAudits.reduce((sum, item) => sum + item.pages_with_sources, 0);
    const failedDocuments = documentAudits.filter((item) => item.status === "failed").length;
    return {
      case_id: caseId,
      total_documents: documentAudits.length,
      processed_documents: documentAudits.filter((item) => item.processed_pages > 0 || item.source_count > 0).length,
      total_pages: totalPages,
      processed_pages: documentAudits.reduce((sum, item) => sum + item.processed_pages, 0),
      pages_with_sources: pagesWithSources,
      pages_missing_sources: totalPages > 0 ? Math.max(0, totalPages - pagesWithSources) : 0,
      source_count: sources.length,
      failed_documents: failedDocuments,
      documents_requiring_attention: failedDocuments,
      pending_text_recognition_pages: documentAudits.reduce((sum, item) => sum + item.pending_text_recognition_pages, 0),
      source_coverage_percent: totalPages > 0 ? Math.round((pagesWithSources / totalPages) * 100) : 0,
      has_active_processing: false,
      documents: documentAudits,
      warnings: documentAudits.flatMap((item) => item.warnings)
    };
  }
}

export async function getDocumentEngineStatus(): Promise<DocumentEngineStatus> {
  try {
    return await callTauri<DocumentEngineStatus>("get_document_engine_status");
  } catch {
    return {
      local_engine_available: false,
      embedded_text_extraction_available: false,
      image_text_recognition_available: false,
      pdf_page_renderer_available: false,
      automatic_text_recognition_available: false,
      warnings: ["Dokumentmotorstatus er bare tilgjengelig i desktop-appen."]
    };
  }
}

export async function listAuditEvents(caseId?: string): Promise<AuditEvent[]> {
  try {
    return await callTauri<AuditEvent[]>("list_audit_events", { caseId });
  } catch {
    const audit = readStore().audit;
    return caseId ? audit.filter((event) => event.case_id === caseId) : audit;
  }
}

export async function recordCaseAiExchange(params: {
  caseId: string;
  question: string;
  answerJson: string;
  sourceIds: string[];
  modelId?: string;
  promptVersion?: string;
  sourceIndexVersion?: string;
}): Promise<CaseAiMessageDto> {
  try {
    return await callTauri<CaseAiMessageDto>("record_case_ai_exchange", params);
  } catch {
    const store = readStore();
    const sources = params.sourceIds.map((sourceId) => {
      const source = store.sources.find((item) => item.case_id === params.caseId && item.id === sourceId);
      return {
        id: id("AIMSRC"),
        message_id: "",
        source_id: sourceId,
        document_id: source?.document_id || "MISSING",
        page_number: source?.page_start,
        validation_status: source ? "PASS" : "FAIL",
        created_at: now()
      };
    });
    const messageId = id("AIMSG");
    const message: CaseAiMessageDto = {
      id: messageId,
      session_id: id("AISES"),
      case_id: params.caseId,
      role: "assistant",
      content: params.answerJson,
      answer_json: params.answerJson,
      model_id: params.modelId,
      prompt_version: params.promptVersion,
      source_index_version: params.sourceIndexVersion,
      created_at: now(),
      sources: sources.map((source) => ({ ...source, message_id: messageId }))
    };
    store.aiMessages[params.caseId] = [message, ...(store.aiMessages[params.caseId] || [])].slice(0, 50);
    appendAudit(store, {
      case_id: params.caseId,
      action: "CASE_AI_QUESTION_ASKED",
      target_type: "case_ai_message",
      target_id: messageId
    });
    appendAudit(store, {
      case_id: params.caseId,
      action: "CASE_AI_ANSWER_GENERATED",
      target_type: "case_ai_message",
      target_id: messageId
    });
    writeStore(store);
    return message;
  }
}

export async function askCaseAi(params: {
  caseId: string;
  question: string;
  coverage: number;
  pendingOcrPages: number;
  deviations: string[];
  nextActionTitle: string;
}): Promise<CaseAiMessageDto> {
  return callTauri<CaseAiMessageDto>("ask_case_ai", params);
}

export async function listCaseAiMessages(caseId: string): Promise<CaseAiMessageDto[]> {
  try {
    return await callTauri<CaseAiMessageDto[]>("list_case_ai_messages", { caseId });
  } catch {
    return readStore().aiMessages[caseId] || [];
  }
}

export async function listWorkItems(caseId: string): Promise<WorkItemsDto> {
  try {
    return await callTauri<WorkItemsDto>("list_work_items", { caseId });
  } catch {
    return readStore().workItems[caseId] || emptyWorkItems();
  }
}

export async function buildChronology(caseId: string): Promise<ChronologyEventDto[]> {
  try {
    return await callTauri<ChronologyEventDto[]>("build_chronology", { caseId });
  } catch {
    const store = readStore();
    const sources = store.sources.filter((source) => source.case_id === caseId);
    const chronology = sources.slice(0, 8).map((source, index) => ({
      id: id("TL"),
      case_id: caseId,
      date_text: "Udatert",
      event: sentence(source.text_excerpt),
      source_id: source.id,
      status: index === 0 ? "Til kontroll" : "Utkast",
      uncertainty: "Middels",
      updated_at: now()
    }));
    store.workItems[caseId] = { ...(store.workItems[caseId] || emptyWorkItems()), chronology };
    writeStore(store);
    return chronology;
  }
}

export async function buildEvidenceMatrix(caseId: string): Promise<EvidenceItemDto[]> {
  try {
    return await callTauri<EvidenceItemDto[]>("build_evidence_matrix", { caseId });
  } catch {
    const store = readStore();
    const sources = store.sources.filter((source) => source.case_id === caseId);
    const evidence: EvidenceItemDto[] = sources.length
      ? [{
          id: id("EV"),
          case_id: caseId,
          claim: "Foreløpig hovedpåstand basert på importerte kilder",
          supporting_source_ids: sources.slice(0, 3).map((source) => source.id),
          weakening_source_ids: sources.slice(3, 5).map((source) => source.id),
          strength: sources.length >= 2 ? "Middels" : "Svak",
          status: "Utkast",
          updated_at: now()
        }]
      : [];
    store.workItems[caseId] = { ...(store.workItems[caseId] || emptyWorkItems()), evidence };
    writeStore(store);
    return evidence;
  }
}

export async function createArgumentItem(caseId: string): Promise<ArgumentItemDto[]> {
  try {
    return await callTauri<ArgumentItemDto[]>("create_argument_item", { caseId });
  } catch {
    const store = readStore();
    const sources = store.sources.filter((source) => source.case_id === caseId);
    const current = store.workItems[caseId] || emptyWorkItems();
    const next = sources.length
      ? [...current.arguments, {
          id: id("ARG"),
          case_id: caseId,
          argument: "Foreløpig anførsel",
          factual_basis: sentence(sources[0].text_excerpt),
          legal_basis: "Ikke vurdert",
          evidence_source_ids: sources.slice(0, 2).map((source) => source.id),
          status: "Må kvalitetssikres",
          updated_at: now()
        }]
      : current.arguments;
    store.workItems[caseId] = { ...current, arguments: next };
    writeStore(store);
    return next;
  }
}

export async function findContradictions(caseId: string): Promise<ContradictionItemDto[]> {
  try {
    return await callTauri<ContradictionItemDto[]>("find_contradictions", { caseId });
  } catch {
    const store = readStore();
    const sources = store.sources.filter((source) => source.case_id === caseId);
    const contradictions: ContradictionItemDto[] = sources.length >= 2
      ? [{
          id: id("CON"),
          case_id: caseId,
          topic: "Mulig avvik i faktum",
          source_a_id: sources[0].id,
          source_b_id: sources[1].id,
          conflict: "Kildene bør sammenlignes manuelt før konklusjon.",
          significance: "Middels",
          status: "Til kontroll",
          updated_at: now()
        }]
      : [];
    store.workItems[caseId] = { ...(store.workItems[caseId] || emptyWorkItems()), contradictions };
    writeStore(store);
    return contradictions;
  }
}

export async function assessRisk(caseId: string): Promise<RiskItemDto[]> {
  try {
    return await callTauri<RiskItemDto[]>("assess_risk", { caseId });
  } catch {
    const store = readStore();
    const sources = store.sources.filter((source) => source.case_id === caseId);
    const current = store.workItems[caseId] || emptyWorkItems();
    const risks: RiskItemDto[] = sources.length
      ? [{
          id: id("RSK"),
          case_id: caseId,
          risk: "Kildegrunnlag ikke juridisk kvalitetssikret",
          severity: "Middels",
          affected_arguments: current.arguments.map((item) => item.id).join(", ") || "Ikke koblet",
          source_basis: `${sources.length} kildeobjekter`,
          recommended_action: "Kontroller kilder og knytt dem til påstander.",
          updated_at: now()
        }]
      : [];
    store.workItems[caseId] = { ...current, risks };
    writeStore(store);
    return risks;
  }
}

export async function resetTestData(): Promise<MaintenanceReport> {
  try {
    return await callTauri<MaintenanceReport>("reset_test_data");
  } catch {
    const store = readStore();
    const report: MaintenanceReport = {
      message: "Testdata slettet fra browser-store.",
      cases_deleted: store.cases.length,
      documents_deleted: store.documents.length,
      sources_deleted: store.sources.length
    };
    writeStore({ cases: [], documents: [], sources: [], audit: [], workItems: {}, aiMessages: {} });
    return report;
  }
}

export async function openLocalDataFolder(): Promise<MaintenanceReport> {
  try {
    return await callTauri<MaintenanceReport>("open_local_data_folder");
  } catch {
    return { message: "Lokal datamappe kan bare åpnes fra desktop-appen." };
  }
}

export async function openOriginalFolder(path: string): Promise<MaintenanceReport> {
  try {
    return await callTauri<MaintenanceReport>("open_original_folder", { path });
  } catch {
    return { message: "Originalmappe kan bare åpnes fra desktop-appen.", path };
  }
}

export async function exportDiagnostics(): Promise<MaintenanceReport> {
  try {
    return await callTauri<MaintenanceReport>("export_diagnostics");
  } catch {
    const store = readStore();
    const payload = {
      generated_at: now(),
      mode: "browser-dev",
      cases: store.cases.length,
      documents: store.documents.length,
      sources: store.sources.length,
      audit_events: store.audit.length
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    return { message: "Diagnosepakke åpnet i ny fane for browser-store." };
  }
}

export async function exportImportDiagnostics(caseId: string): Promise<MaintenanceReport> {
  try {
    return await callTauri<MaintenanceReport>("export_import_diagnostics", { caseId });
  } catch {
    const health = await getImportHealth(caseId);
    const blob = new Blob([JSON.stringify(health, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    return { message: "Importdiagnostikk åpnet i ny fane for browser-store." };
  }
}
