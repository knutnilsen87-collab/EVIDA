import { invoke } from "@tauri-apps/api/core";
import type {
  AuditEvent,
  CaseSummary,
  DocumentIngestionReport,
  DocumentSummary,
  MaintenanceReport,
  ReindexReport,
  SourceObjectSummary
} from "../types";

const STORE_KEY = "saksrom-pro-dev-store-v1";

interface DevStore {
  cases: CaseSummary[];
  documents: DocumentSummary[];
  sources: SourceObjectSummary[];
  audit: AuditEvent[];
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
    return { cases: [], documents: [], sources: [], audit: [] };
  }
  return JSON.parse(raw) as DevStore;
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

export async function createCase(name: string, jurisdiction = "NO"): Promise<CaseSummary> {
  try {
    return await callTauri<CaseSummary>("create_case", { name, jurisdiction });
  } catch {
    const store = readStore();
    const created: CaseSummary = {
      id: id("CASE"),
      name,
      jurisdiction,
      status: "active",
      document_count: 0,
      page_count: 0,
      source_coverage_percent: 0,
      risk_level: "unknown",
      updated_at: now()
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

export async function chooseDocumentPaths(): Promise<string[]> {
  try {
    return await callTauri<string[]>("choose_document_paths");
  } catch {
    return [];
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

export async function listAuditEvents(caseId?: string): Promise<AuditEvent[]> {
  try {
    return await callTauri<AuditEvent[]>("list_audit_events", { caseId });
  } catch {
    const audit = readStore().audit;
    return caseId ? audit.filter((event) => event.case_id === caseId) : audit;
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
    writeStore({ cases: [], documents: [], sources: [], audit: [] });
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
