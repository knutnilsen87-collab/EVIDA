import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import ts from "typescript";

const sourcePath = new URL("../src/features/readiness/caseReadiness.ts", import.meta.url);
const source = await readFile(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
    strict: true
  }
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString("base64")}`;
const { calculateSourceCoveragePercent, getCaseReadiness, getDocumentProcessingState } = await import(moduleUrl);

const baseInput = {
  hasDocuments: true,
  totalDocuments: 1,
  processedDocuments: 1,
  totalPages: 100,
  processedPages: 100,
  pagesWithText: 100,
  pagesWithSources: 95,
  pagesMissingSources: 5,
  sourceCount: 10,
  failedDocuments: 0,
  documentsRequiringAttention: 0,
  importFailures: 0,
  pendingTextRecognitionPages: 0,
  hasActiveProcessing: false,
  automaticTextRecognitionAvailable: true,
  dbEncryptionVerified: true
};

function readiness(patch) {
  return getCaseReadiness({ ...baseInput, ...patch });
}

const cases = [
  ["no documents -> not_ready", { hasDocuments: false, totalDocuments: 0, totalPages: 0, pagesWithSources: 0, sourceCount: 0 }, "not_ready"],
  ["documents exist but no sources -> not_ready", { pagesWithSources: 0, sourceCount: 0 }, "not_ready"],
  ["0% coverage -> not_ready", { pagesWithSources: 0, sourceCount: 1 }, "not_ready"],
  ["49% coverage -> not_ready", { pagesWithSources: 49, sourceCount: 1 }, "not_ready"],
  ["50% coverage -> requires_control", { pagesWithSources: 50, sourceCount: 1 }, "requires_control"],
  ["79% coverage -> requires_control", { pagesWithSources: 79, sourceCount: 1 }, "requires_control"],
  ["active processing with 90% coverage -> requires_control", { pagesWithSources: 90, sourceCount: 1, hasActiveProcessing: true }, "requires_control"],
  ["pending text recognition pages -> requires_control", { pagesWithSources: 90, sourceCount: 1, pendingTextRecognitionPages: 1 }, "requires_control"],
  ["failed document -> requires_control", { pagesWithSources: 90, sourceCount: 1, failedDocuments: 1, totalDocuments: 2 }, "requires_control"],
  ["80% coverage with no blockers -> ready_for_preliminary_analysis", { pagesWithSources: 80, sourceCount: 1 }, "ready_for_preliminary_analysis"],
  ["94% coverage -> ready_for_preliminary_analysis", { pagesWithSources: 94, sourceCount: 1 }, "ready_for_preliminary_analysis"],
  ["95% coverage with no blockers -> ready_for_draft_control", { pagesWithSources: 95, sourceCount: 1 }, "ready_for_draft_control"],
  ["100% coverage -> ready_for_draft_control", { pagesWithSources: 100, sourceCount: 1, pagesMissingSources: 0 }, "ready_for_draft_control"]
];

for (const [name, patch, expected] of cases) {
  assert.equal(readiness(patch).verdict, expected, name);
}

assert.equal(calculateSourceCoveragePercent({ totalPages: 0, pagesWithSources: 10 }), 0, "totalPages = 0 -> coverage 0");
assert.equal(readiness({ pagesWithSources: 0, sourceCount: 1 }).label, "Saken klargjøres", "0% coverage stays autopilot-first");
assert.equal(readiness({ pagesWithSources: 0, sourceCount: 1 }).primaryAction, "Vis behandlingsstatus", "0% coverage primary CTA shows status");
assert.equal(
  readiness({ totalDocuments: 1, failedDocuments: 1, pagesWithSources: 0, sourceCount: 0 }).primaryAction,
  "Se dokumenter som ikke kunne behandles",
  "all failed documents get recovery CTA"
);
assert.equal(
  readiness({
    pagesWithSources: 0,
    sourceCount: 1,
    pendingTextRecognitionPages: 2,
    automaticTextRecognitionAvailable: false
  }).title,
  "Automatisk teksthenting er ikke ferdig implementert",
  "unimplemented text recognition is explained without user recovery task"
);
assert.equal(
  readiness({ dbEncryptionVerified: false }).testDataWarning,
  "Kun testdata. Ikke godkjent for ekte klientdata.",
  "dbEncryptionVerified=false -> test-data warning present"
);

const processingCases = [
  ["failed status -> failed", { pageCount: 1, analyzedPageCount: 0, sourceCount: 0, pendingTextRecognitionPages: 0, ocrStatus: "failed" }, "failed"],
  ["pending text recognition -> waiting worker", { pageCount: 10, analyzedPageCount: 1, sourceCount: 0, pendingTextRecognitionPages: 9, ocrStatus: "partial_needs_ocr" }, "waiting_for_background_worker"],
  ["active extraction -> creating sources", { pageCount: 10, analyzedPageCount: 5, sourceCount: 0, pendingTextRecognitionPages: 0, ocrStatus: "running", hasActiveProcessing: true }, "creating_sources"],
  ["sources with pending pages -> completed partial", { pageCount: 10, analyzedPageCount: 5, sourceCount: 5, pendingTextRecognitionPages: 5, ocrStatus: "partial_needs_ocr" }, "completed_partial"],
  ["full source document -> completed", { pageCount: 10, analyzedPageCount: 10, sourceCount: 10, pendingTextRecognitionPages: 0, ocrStatus: "text_extracted" }, "completed"]
];

for (const [name, input, expected] of processingCases) {
  assert.equal(getDocumentProcessingState(input), expected, name);
}

console.log(`caseReadiness tests passed (${cases.length + 6 + processingCases.length} assertions).`);
