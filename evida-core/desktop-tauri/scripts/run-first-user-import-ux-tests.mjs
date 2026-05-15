import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function importTsModule(path) {
  const sourcePath = new URL(path, import.meta.url);
  const source = await readFile(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
      strict: true
    }
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString("base64")}`;
  return import(moduleUrl);
}

const {
  canApproveSourceAfterPreview,
  deriveImportOutcome,
  deriveImportOutcomeViewModel,
  deriveImportUxSummary,
  deriveNextAction,
  getAiReadyDocumentIds,
  getReviewDocuments,
  summarizeImportProgress
} = await importTsModule("../src/features/documents/importUx.ts");

const startedAt = 1_000;
const nowMs = 61_000;
const queue = Array.from({ length: 39 }, (_, index) => ({
  status: index < 10 ? "completed" : index === 10 ? "extracting_text" : "queued",
  startedAt,
  pagesProcessed: index === 10 ? 5 : undefined,
  pagesTotal: index === 10 ? 20 : undefined
}));

const documentBasis = {
  needsReviewDocuments: [{ id: "DOC-review", canUseInAnswer: false }],
  unreadableDocuments: [{ id: "DOC-unused", canUseInAnswer: false }],
  readyCount: 1,
  totalCount: 3
};

const summary = deriveImportUxSummary({
  queue,
  nowMs,
  documentBasis,
  hasDocuments: true,
  hasActiveProcessing: true,
  canOpenPreliminary: true,
  canOpenFinal: false,
  totalDocuments: 39
});

assert.equal(summary.progressLabel, "10 av 39 dokumenter behandlet", "39-document import shows aggregate progress");
assert.match(summary.etaLabel, /^ETA: ca\. \d+ min \d+ sek$/, "ETA is visible for active 39-document import");
assert.equal(summary.progress.state, "processing", "active import is not marked complete while documents remain");
assert.equal(summary.progress.title, "Behandler dokumenter", "processing import uses the non-terminal title");
assert.equal(summary.nextStep.primaryAction.label, "Start kontroll", "review action is a clear primary CTA");
assert.deepEqual(
  summary.gapMessages,
  [
    "Importen behandler fortsatt dokumenter. Vent til behandlingen er ferdig før du konkluderer.",
    "1 dokument trenger manuell kontroll før de kan brukes som kildegrunnlag.",
    "1 dokument ble ikke brukt som kildegrunnlag. Erstatt fil eller hold dem utenfor saken."
  ],
  "import modal lists concrete gaps"
);
assert.deepEqual(getReviewDocuments(documentBasis).map((row) => row.id), ["DOC-review"], "review list contains only documents needing control");
assert.equal(canApproveSourceAfterPreview(false), false, "source approval is blocked before preview confirmation");
assert.equal(canApproveSourceAfterPreview(true), true, "source approval is enabled after preview confirmation");

const completedSummary = summarizeImportProgress({
  items: Array.from({ length: 41 }, () => ({ status: "completed", startedAt })),
  nowMs,
  totalDocuments: 41
});
assert.equal(completedSummary.state, "complete", "terminal documents produce complete import state");
assert.equal(completedSummary.remainingDocuments, 0, "complete import has zero remaining documents");
assert.equal(completedSummary.etaLabel, "Ferdig", "complete import never shows ETA beregnes");

const terminalWithAttentionQueue = [
  ...Array.from({ length: 74 }, () => ({ status: "completed", startedAt })),
  ...Array.from({ length: 26 }, () => ({ status: "manual_review_required", startedAt })),
  ...Array.from({ length: 25 }, () => ({ status: "failed", startedAt }))
];
const terminalWithAttentionSummary = summarizeImportProgress({
  items: terminalWithAttentionQueue,
  nowMs,
  totalDocuments: 125
});
assert.equal(terminalWithAttentionSummary.state, "complete_with_errors", "terminal failures are finished with errors, not active import");
assert.equal(terminalWithAttentionSummary.remainingDocuments, 0, "terminal failures do not leave phantom remaining documents");
assert.equal(terminalWithAttentionSummary.processingDocuments, 0, "terminal failures do not leave phantom active processing");
assert.equal(terminalWithAttentionSummary.currentPhaseLabel, "Ferdig - kontroll kreves", "complete-with-errors phase does not say import is still failing");
const terminalUx = deriveImportUxSummary({
  queue: terminalWithAttentionQueue,
  nowMs,
  documentBasis: {
    needsReviewDocuments: Array.from({ length: 26 }, (_, index) => ({ id: `DOC-review-${index}`, canUseInAnswer: false })),
    unreadableDocuments: Array.from({ length: 25 }, (_, index) => ({ id: `DOC-failed-${index}`, canUseInAnswer: false })),
    readyCount: 74,
    totalCount: 125
  },
  hasDocuments: true,
  hasActiveProcessing: true,
  canOpenPreliminary: true,
  canOpenFinal: false,
  totalDocuments: 125
});
assert.equal(terminalUx.progress.state, "complete_with_errors", "stale active-processing flag cannot override terminal import progress");
assert.equal(
  terminalUx.gapMessages.some((message) => message.includes("Importen behandler fortsatt dokumenter")),
  false,
  "terminal import gaps do not tell the user to keep waiting"
);

const outcome = deriveImportOutcome({
  documents: [],
  importItems: [],
  documentBasis: {
    ...documentBasis,
    sourceCoveragePercent: 66
  },
  importHealth: null,
  importQueue: [],
  hasActiveProcessing: false,
  visibleReviewCount: 1,
  sourcesCreated: 12,
  totalPages: 50,
  analyzedPages: 40,
  pendingOcrPages: 3
});
const nextAction = deriveNextAction(outcome);
const outcomeView = deriveImportOutcomeViewModel(outcome, nextAction);
assert.equal(nextAction.id, "control_documents", "manual review routes to document control");
assert.equal(nextAction.primaryLabel, "Kontroller 1 dokument", "next action includes exact control count");
assert.equal(outcomeView.title, "Import fullført — kontroll kreves", "import outcome modal uses decision-oriented title");
assert.equal(outcomeView.showEta, false, "finished import outcome hides ETA");

const terminalOutcome = deriveImportOutcome({
  documents: [],
  importItems: terminalWithAttentionQueue,
  documentBasis: {
    needsReviewDocuments: Array.from({ length: 26 }, (_, index) => ({ id: `DOC-review-${index}`, canUseInAnswer: false })),
    unreadableDocuments: Array.from({ length: 25 }, (_, index) => ({ id: `DOC-failed-${index}`, canUseInAnswer: false })),
    readyCount: 74,
    totalCount: 125,
    sourceCoveragePercent: 97
  },
  importHealth: {
    overall_status: "processing",
    latest_session: {
      total_files_seen: 125,
      files_ready: 74,
      files_partial: 26,
      files_requires_ocr: 0,
      files_duplicate: 0,
      files_unsupported: 0,
      files_failed: 25,
      pages_total: 566,
      pages_with_text: 566,
      pages_requires_ocr: 0,
      source_objects_created: 2119,
      source_coverage_percent: 97
    }
  },
  importQueue: terminalWithAttentionQueue,
  hasActiveProcessing: true,
  visibleReviewCount: 26,
  sourcesCreated: 2119,
  totalPages: 566,
  analyzedPages: 566,
  pendingOcrPages: 0
});
assert.equal(terminalOutcome.isRunning, false, "all-terminal import outcome is not running even when stale health says processing");
assert.equal(deriveNextAction(terminalOutcome).id, "control_documents", "all-terminal attention import routes to control, not wait");

const aiReadyIds = getAiReadyDocumentIds([
  { id: "DOC-ready", canUseInAnswer: true },
  { id: "DOC-review", canUseInAnswer: false },
  { id: "DOC-unused", canUseInAnswer: false }
]);
assert.deepEqual([...aiReadyIds], ["DOC-ready"], "AI-ready source set excludes unapproved documents");

const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
assert.match(appSource, /Åpne preview/, "review row exposes a direct preview action");
assert.match(appSource, /handlePreviewDocument\(row\)/, "preview action targets the selected document row");
assert.match(appSource, /canApproveSourceAfterPreview\(Boolean\(reviewApprovalChecks\[row\.id\]\)\)/, "approve button requires the confirmation checkbox");
assert.match(appSource, /Godkjenner \.\.\./, "approval action has an explicit saving state");
assert.match(appSource, /Godkjent\. Neste dokument åpnet\./, "preview approval guides user to next document");
assert.match(appSource, /Alle dokumenter er kontrollert\./, "final approval state is visible");
assert.match(appSource, /Saksgrunnlaget er ikke komplett ennå\./, "preliminary Saksrom warning is explicit");
assert.match(appSource, /Mangler nå:/, "import completion modal names current gaps");
assert.match(appSource, /sources=\{aiReadySources\}/, "CaseRoom receives only AI-ready sources");
assert.match(appSource, /hasNonAiReadySources/, "AI workrooms are gated when source objects are not AI-ready");
assert.match(appSource, /DocumentPreviewDrawer/, "preview opens inside Evida instead of Explorer");
assert.match(appSource, /documents-needing-control/, "attention navigation has a stable section target");
assert.match(appSource, /DocumentControlView/, "dedicated document control view exists");
assert.match(appSource, /Bruk som kildegrunnlag/, "document control uses source-foundation wording");
const caseRoomSource = await readFile(new URL("../src/components/CaseRoomView.tsx", import.meta.url), "utf8");
assert.match(caseRoomSource, /isSystemStatusQuestion/, "Saksrom routes import and control status questions before case analysis");
assert.match(caseRoomSource, /safe-local-system-status/, "system status answers are recorded without legal source retrieval");
assert.match(caseRoomSource, /ETA er ikke relevant nå, fordi importen ikke kjører/, "inactive import status does not claim ETA is calculating");
assert.match(caseRoomSource, /shouldUseExternalAiProvider/, "Saksrom has an explicit provider policy gate");
assert.ok(
  caseRoomSource.includes("streamingAnswer || isAsking || isImporting || hasActiveProcessing || userScrolledRecently"),
  "Saksrom does not auto-scroll while document import is active"
);
assert.ok(
  !caseRoomSource.includes("showIntakeCard, isImporting, displayImportItem?.status, importQueue.length"),
  "intake status updates do not retrigger scroll positioning"
);
assert.match(caseRoomSource, /Spør Saksrom — svar bygger bare på kontrollerte kilder/, "Saksrom exposes limited-source scope");
for (const staleLabel of ["View details", "Run OCR", "Open preliminary Saksrom", "Files imported", "Requiring OCR"]) {
  assert.equal(appSource.includes(staleLabel), false, `stale import modal label is removed: ${staleLabel}`);
}

console.log("first-user import UX tests passed.");
