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

const {
  PROCESSING_STEPS,
  calculatePageProgress,
  estimateRemainingSeconds,
  formatEta,
  getStepState,
  stageProgressPercent
} = await importTsModule("../src/lib/processing.ts");

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
  assert.equal(stageProgressPercent(stage), percent, `${stage} has deterministic progress`);
}

assert.deepEqual(
  PROCESSING_STEPS.map((step) => step.stage),
  [
    "queued",
    "reading_file",
    "counting_pages",
    "extracting_text",
    "finding_source_points",
    "building_case_basis",
    "checking_coverage",
    "completed"
  ],
  "processing steps are monotonic"
);

assert.equal(getStepState("reading_file", "extracting_text"), "done", "past step is done");
assert.equal(getStepState("extracting_text", "extracting_text"), "active", "current step is active");
assert.equal(getStepState("finding_source_points", "extracting_text"), "pending", "future step is pending");
assert.equal(getStepState("failed", "failed"), "failed", "failed step can be marked failed");

const pageProgress = calculatePageProgress({
  totalPages: 2101,
  processedPages: 2014,
  pagesWithSources: 2014
});
assert.equal(pageProgress.pagesRemaining, 87, "pagesRemaining = totalPages - processedPages");
assert.equal(pageProgress.sourceCoveragePercent, 96, "sourceCoveragePercent rounds from pagesWithSources / totalPages");
assert.equal(pageProgress.pagesMissingSources, 87, "pagesMissingSources tracks uncovered pages");

assert.equal(formatEta(undefined), "Beregnes", "missing ETA is calculating");
assert.equal(formatEta(45), "Under 1 minutt igjen", "short ETA bucket");
assert.equal(formatEta(120), "Omtrent 1–3 minutter igjen", "1-3 minute ETA bucket");
assert.equal(formatEta(240), "Omtrent 3–5 minutter igjen", "3-5 minute ETA bucket");
assert.equal(formatEta(600), "Omtrent 5–15 minutter igjen", "5-15 minute ETA bucket");
assert.equal(formatEta(1200), "Over 15 minutter igjen", "long ETA bucket");
assert.equal(formatEta(undefined, "unavailable"), "Ikke tilgjengelig i denne versjonen", "unavailable ETA is explicit");
assert.equal(formatEta(undefined, "complete"), "Ferdig", "completed ETA label");

assert.equal(
  Math.round(estimateRemainingSeconds({ processedPages: 50, totalPages: 100, startedAt: 0, now: 50_000 }) ?? 0),
  50,
  "ETA uses page throughput"
);
assert.equal(
  estimateRemainingSeconds({ processedPages: 0, totalPages: 100, startedAt: 0, now: 50_000 }),
  undefined,
  "ETA is unavailable before first processed page"
);

console.log("processing tests passed (25 assertions).");
