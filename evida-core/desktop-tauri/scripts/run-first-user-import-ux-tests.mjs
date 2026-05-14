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
  deriveImportUxSummary,
  getAiReadyDocumentIds,
  getReviewDocuments
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
assert.match(summary.etaLabel, /igjen$/, "ETA is visible for active 39-document import");
assert.equal(summary.nextStep.primaryAction.label, "Se dokumenter som trenger kontroll", "exactly one user-facing primary action is selected");
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

const aiReadyIds = getAiReadyDocumentIds([
  { id: "DOC-ready", canUseInAnswer: true },
  { id: "DOC-review", canUseInAnswer: false },
  { id: "DOC-unused", canUseInAnswer: false }
]);
assert.deepEqual([...aiReadyIds], ["DOC-ready"], "AI-ready source set excludes unapproved documents");

const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
assert.match(appSource, /Åpne preview/, "review row exposes a direct preview action");
assert.match(appSource, /handlePreviewDocument\(row\)/, "preview action targets the selected document row");
assert.match(appSource, /disabled=\{mode === "review" && !canApproveSourceAfterPreview/, "approve button requires the confirmation checkbox");
assert.match(appSource, /Saksgrunnlaget er ikke komplett ennå\./, "preliminary Saksrom warning is explicit");
assert.match(appSource, /Mangler nå:/, "import completion modal names current gaps");
assert.match(appSource, /sources=\{aiReadySources\}/, "CaseRoom receives only AI-ready sources");
assert.match(appSource, /hasNonAiReadySources/, "AI workrooms are gated when source objects are not AI-ready");
for (const staleLabel of ["View details", "Run OCR", "Open preliminary Saksrom", "Files imported", "Requiring OCR"]) {
  assert.equal(appSource.includes(staleLabel), false, `stale import modal label is removed: ${staleLabel}`);
}

console.log("first-user import UX tests passed (20 assertions).");
