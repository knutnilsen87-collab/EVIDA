import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
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

const { getCaseReadiness } = await importTsModule("../src/lib/readiness.ts");
const { classifyUserQuestion, resolveSuggestedAction } = await importTsModule("../src/lib/intentParser.ts");
const {
  DOCUMENT_PROCESSING_STAGE_LABELS,
  processingStageProgress,
  processingStepViews
} = await importTsModule("../src/types/processing.ts");

const baseReadinessInput = {
  hasDocuments: true,
  hasSources: true,
  sourceCount: 10,
  sourceCoveragePercent: 96,
  totalPages: 100,
  processedPages: 100,
  pagesWithSources: 96,
  pagesMissingSources: 4,
  pendingOcrPages: 0,
  documentsRequiringAttention: 0,
  importFailures: 0,
  hasActiveProcessing: false,
  dbEncryptionVerified: true
};

const readinessCases = [
  ["no documents => not_ready", { hasDocuments: false, hasSources: false, sourceCount: 0, sourceCoveragePercent: 0 }, "not_ready"],
  ["documents but no sources => not_ready", { hasSources: false, sourceCount: 0, sourceCoveragePercent: 0 }, "not_ready"],
  ["coverage 0 => not_ready", { sourceCoveragePercent: 0 }, "not_ready"],
  ["coverage 49 => not_ready", { sourceCoveragePercent: 49 }, "not_ready"],
  ["coverage 50 + active processing => requires_control", { sourceCoveragePercent: 50, hasActiveProcessing: true }, "requires_control"],
  ["coverage 75 => requires_control", { sourceCoveragePercent: 75 }, "requires_control"],
  ["coverage 85 => ready_for_preliminary_analysis", { sourceCoveragePercent: 85 }, "ready_for_preliminary_analysis"],
  ["coverage 96 => ready_for_draft_control", { sourceCoveragePercent: 96 }, "ready_for_draft_control"]
];

for (const [name, patch, expected] of readinessCases) {
  assert.equal(getCaseReadiness({ ...baseReadinessInput, ...patch }).verdict, expected, name);
}

const actions = [1, 2, 3, 4].map((index) => ({
  id: `action-${index}`,
  index,
  label: `Spor ${index}`,
  intent: "explain_case",
  queryTemplate: `Spor ${index}`,
  requiredReadiness: "has_sources",
  createdFromTurnId: "test-turn"
}));

const intentCases = [
  ["1", 1],
  ["ta 2", 2],
  ["den første", 1],
  ["punkt 3", 3],
  ["den fjerde", 4]
];

for (const [input, expected] of intentCases) {
  assert.equal(resolveSuggestedAction(input, actions)?.index, expected, `${input} resolves`);
}

const questionIntentCases = [
  ["hva anbefaler du meg å gjøre?", "recommendation"],
  ["hva bør jeg gjøre nå?", "recommendation"],
  ["hva er neste steg?", "recommendation"],
  ["hvor bør jeg begynne?", "recommendation"],
  ["hva handler saken om?", "case_content"],
  ["hvor langt er behandlingen?", "processing_status"]
];

for (const [input, expected] of questionIntentCases) {
  assert.equal(classifyUserQuestion(input), expected, `${input} classifies as ${expected}`);
}

const expectedProgress = {
  queued: 0,
  reading_file: 10,
  counting_pages: 20,
  extracting_text: 40,
  finding_source_points: 60,
  building_case_basis: 75,
  checking_coverage: 90,
  completed: 100
};

for (const [stage, percent] of Object.entries(expectedProgress)) {
  assert.equal(processingStageProgress(stage), percent, `${stage} has deterministic progress`);
}

const extractingSteps = processingStepViews("extracting_text");
assert.equal(extractingSteps.find((step) => step.stage === "extracting_text")?.state, "active", "extracting_text is active");
assert.equal(extractingSteps.find((step) => step.stage === "counting_pages")?.state, "done", "previous step is done");
assert.equal(extractingSteps.find((step) => step.stage === "finding_source_points")?.state, "pending", "future step is pending");
assert.equal(DOCUMENT_PROCESSING_STAGE_LABELS.extracting_text, "Henter tekst", "current step label matches required copy");

const failedSteps = processingStepViews("failed");
assert.equal(failedSteps.at(-1)?.label, "Kunne ikke behandles", "failed step uses required copy");
assert.equal(failedSteps.at(-1)?.state, "failed", "failed step has failed visual state");

console.log(`handoff tests passed (${readinessCases.length + intentCases.length + questionIntentCases.length + Object.keys(expectedProgress).length + 6} assertions).`);
