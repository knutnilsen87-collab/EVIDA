import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function importTs(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
      strict: true
    }
  });
  return import(`data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString("base64")}`);
}

const { deriveCasePreparationProgress, getChatPlaceholder } = await importTs("../src/features/casePreparation/casePreparation.logic.ts");
const { deriveDocumentControlBulkPlan, canBulkMarkControlled } = await importTs("../src/features/documentControl/documentControl.logic.ts");

const locked = deriveCasePreparationProgress({
  totalDocuments: 3,
  processedDocuments: 2,
  readyDocuments: 0,
  reviewDocuments: 2,
  unreadableDocuments: 1,
  totalPages: 30,
  processedPages: 12,
  pendingOcrPages: 6,
  sourceObjects: 0,
  sourceCoveragePercent: 0,
  hasActiveProcessing: false,
  nextActionTitle: "Start kontroll"
});
assert.equal(locked.saksromScope, "locked");
assert.equal(locked.chatPlaceholder, "Saksrom åpnes når dokumentgrunnlaget er klart nok");

const partial = deriveCasePreparationProgress({
  totalDocuments: 4,
  processedDocuments: 4,
  readyDocuments: 2,
  reviewDocuments: 1,
  unreadableDocuments: 1,
  totalPages: 40,
  processedPages: 36,
  pendingOcrPages: 4,
  sourceObjects: 12,
  sourceCoveragePercent: 80,
  hasActiveProcessing: false,
  importProgress: { state: "complete_with_attention", progressPercent: 100, currentPhaseLabel: "Kontroll kreves", etaLabel: "Ferdig", remainingDocuments: 0 }
});
assert.equal(partial.saksromScope, "controlled_sources_only");
assert.equal(partial.chatPlaceholder, "Spør Saksrom — svar bygger bare på kontrollerte kilder");

const ready = deriveCasePreparationProgress({
  totalDocuments: 2,
  processedDocuments: 2,
  readyDocuments: 2,
  reviewDocuments: 0,
  unreadableDocuments: 0,
  totalPages: 20,
  processedPages: 20,
  pendingOcrPages: 0,
  sourceObjects: 8,
  sourceCoveragePercent: 100,
  hasActiveProcessing: false
});
assert.equal(ready.saksromScope, "full_case_sources");
assert.equal(getChatPlaceholder(ready.saksromScope), "Spør Saksrom om saken, kildene eller neste steg");

function row(patch) {
  return {
    id: patch.id,
    caseId: "CASE-1",
    name: `${patch.id}.pdf`,
    hash: `${patch.id}-hash-123456`,
    pageCount: 10,
    analyzedPages: 10,
    pendingOcrPages: 0,
    sourceCount: 4,
    sourceCoveragePercent: 100,
    state: "needs_text_control",
    label: "Trenger kontroll",
    reason: "Kontroller tekst",
    recommendedAction: "Forhåndsvis original",
    importedAt: "2026-05-16T12:00:00Z",
    canPreview: true,
    canApprove: true,
    canReject: true,
    canUseInAnswer: false,
    ...patch
  };
}

const controllable = row({ id: "DOC-ready" });
const ocr = row({ id: "DOC-ocr", pendingOcrPages: 7, sourceCount: 0 });
const failed = row({ id: "DOC-failed", state: "needs_user_action", sourceCount: 0, canApprove: true });
const plan = deriveDocumentControlBulkPlan([controllable, ocr, failed]);

assert.equal(canBulkMarkControlled(controllable), true);
assert.equal(canBulkMarkControlled(failed), false, "hard failures cannot be bulk-marked controlled");
assert.deepEqual(plan.eligibleForControlled.map((item) => item.id), ["DOC-ready", "DOC-ocr"]);
assert.deepEqual(plan.replaceRows.map((item) => item.id), ["DOC-failed"]);
assert.deepEqual(plan.eligibleAsSource.map((item) => item.id), ["DOC-ready"]);
assert.deepEqual(plan.eligibleNotCitable.map((item) => item.id), ["DOC-ocr"]);
assert.equal(plan.actions.find((action) => action.id === "approve_as_source")?.requiresConfirmation, true);
assert.equal(plan.actions.find((action) => action.id === "approve_as_source")?.enabled, false);
assert.equal(plan.actions.find((action) => action.id === "mark_not_citable")?.requiresConfirmation, true);
assert.equal(plan.actions.find((action) => action.id === "mark_not_citable")?.enabled, true);
assert.equal(plan.actions.find((action) => action.id === "run_ocr")?.enabled, true);

const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const caseRoomSource = await readFile(new URL("../src/components/CaseRoomView.tsx", import.meta.url), "utf8");
const progressComponentSource = await readFile(new URL("../src/components/CasePreparationProgress.tsx", import.meta.url), "utf8");
assert.match(appSource, /data-testid="bulk-selection-bar"/);
assert.match(appSource, /data-testid="bulk-confirm-dialog"/);
assert.match(appSource, /data-testid="document-control-preview-pane"/);
assert.match(appSource, /role="listbox"/);
assert.match(appSource, /aria-selected=\{selectedRow\?\.id === row\.id\}/);
assert.match(appSource, /Godkjenn som kilde/);
assert.match(appSource, /Kontrollert, men ikke siterbar/);
assert.match(appSource, /skipRefresh: true/);
assert.match(appSource, /suppressProgressActions=\{showImportCompletion\}/);
assert.match(caseRoomSource, /preparationProgress\.chatPlaceholder/);
assert.match(caseRoomSource, /!suppressProgressActions/);
assert.match(caseRoomSource, /CasePreparationProgress progress=\{preparationProgress\}/);
assert.doesNotMatch(caseRoomSource, /showIntakeCard|processingCardRef|Dokumenter mottatt/);
assert.match(progressComponentSource, /data-testid="case-preparation-progress"/);
assert.doesNotMatch(appSource, /Godkjenner \.\.\.|Ikke bruk som kilde|Bruk som kildegrunnlag|Marker som kontrollert/);

console.log("progress and bulk spec tests passed.");
