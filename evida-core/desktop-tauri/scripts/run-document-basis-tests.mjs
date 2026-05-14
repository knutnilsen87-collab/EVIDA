import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/features/documents/documentBasis.ts", import.meta.url), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
    strict: true
  }
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString("base64")}`;
const { deriveDocumentBasisSummary, canUseDocumentInAnswer } = await import(moduleUrl);

function document(patch) {
  return {
    id: patch.id,
    case_id: "CASE-1",
    original_name: `${patch.id}.pdf`,
    local_path: `F:/case/${patch.id}.pdf`,
    mime_type: "application/pdf",
    sha256: `${patch.id}-hash-1234567890`,
    page_count: 10,
    ocr_status: "text_extracted",
    source_count: 4,
    source_coverage_percent: 100,
    analyzed_page_count: 10,
    pending_ocr_page_count: 0,
    imported_at: "2026-05-12T10:00:00Z",
    ...patch
  };
}

const summary = deriveDocumentBasisSummary({
  documents: [
    document({ id: "DOC-ready" }),
    document({ id: "DOC-ocr", ocr_status: "partial_needs_ocr", source_count: 2, source_coverage_percent: 50, pending_ocr_page_count: 5 }),
    document({ id: "DOC-failed", ocr_status: "failed", source_count: 0, source_coverage_percent: 0 })
  ],
  importItems: [
    {
      id: "IMP-failed",
      import_session_id: "IMPSESSION-1",
      case_id: "CASE-1",
      original_path: "F:/case/DOC-failed.pdf",
      original_name: "DOC-failed.pdf",
      sha256: "DOC-failed-hash-1234567890",
      status: "failed",
      issue_code: "TEXT_EXTRACTION_FAILED",
      issue_severity: "error",
      user_message: "Teksten kunne ikke hentes.",
      recommended_action: "Last opp en ny kopi.",
      can_retry: true,
      can_continue: false,
      file_size: 100,
      page_count: 10,
      pages_with_text: 0,
      pages_requires_ocr: 0,
      source_count: 0,
      created_at: "2026-05-12T10:00:00Z",
      updated_at: "2026-05-12T10:00:00Z"
    }
  ],
  manualReviewItems: [
    {
      id: "REV-1",
      case_id: "CASE-1",
      import_session_id: "IMPSESSION-1",
      import_item_id: "IMP-ocr",
      document_id: "DOC-ocr",
      page_id: "PAGE-1",
      review_type: "ocr_required",
      severity: "warning",
      status: "open",
      reason: "Siden mangler tekst.",
      recommended_action: "Forhåndsvis og godkjenn.",
      ai_usable: false,
      created_at: "2026-05-12T10:00:00Z",
      updated_at: "2026-05-12T10:00:00Z"
    }
  ],
  audit: [],
  hasActiveProcessing: false
});

assert.equal(summary.readyDocuments.length, 1, "ready documents are grouped");
assert.equal(summary.needsReviewDocuments.length, 1, "OCR/manual review documents are grouped");
assert.equal(summary.unreadableDocuments.length, 1, "unreadable documents are grouped");
assert.equal(summary.needsReviewDocuments[0].label, "Trenger OCR eller tekstkontroll");
assert.equal(summary.unreadableDocuments[0].recommendedAction, "Last opp en ny kopi.");
assert.equal(summary.etaLabel, "2 dokumenter trenger kontroll");
assert.equal(canUseDocumentInAnswer(summary.readyDocuments[0]), true);
assert.equal(canUseDocumentInAnswer(summary.needsReviewDocuments[0]), false);
assert.equal(canUseDocumentInAnswer(summary.unreadableDocuments[0]), false);

const approved = deriveDocumentBasisSummary({
  documents: [document({ id: "DOC-ocr", ocr_status: "partial_needs_ocr", source_count: 2, source_coverage_percent: 50, pending_ocr_page_count: 5 })],
  importItems: [],
  manualReviewItems: [],
  audit: [
    {
      id: "AUD-1",
      case_id: "CASE-1",
      actor: "local-user",
      action: "DOCUMENT_APPROVED_FOR_AI",
      target_type: "document",
      target_id: "DOC-ocr",
      result: "PASS",
      created_at: "2026-05-12T11:00:00Z"
    }
  ],
  hasActiveProcessing: false
});

assert.equal(approved.readyDocuments.length, 1, "manual approval can release partial text for preliminary AI use");
assert.equal(approved.readyDocuments[0].approvedBy, "local-user", "approval actor is exposed");

console.log("document basis tests passed (11 assertions).");
