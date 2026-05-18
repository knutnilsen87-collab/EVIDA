import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import ts from "typescript";

const sourcePath = new URL("../src/features/rooms/roomAvailability.ts", import.meta.url);
const source = await readFile(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
    strict: true
  }
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString("base64")}`;
const { EXPORT_PRELIMINARY_ACKNOWLEDGEMENT, getRoomAvailability, roomKeyForView } = await import(moduleUrl);

const baseSummary = {
  importInProgress: false,
  documentControlComplete: true,
  sourceCount: 5,
  sourceCoveragePercent: 96,
  pagesRequiringOcr: 6,
  failedFiles: 0,
  unsupportedFiles: 0
};

for (const room of ["saksrom", "chronology", "evidence", "arguments", "risk", "simulation", "draft", "export"]) {
  const availability = getRoomAvailability(room, baseSummary);
  assert.equal(availability.enabled, true, `${room} opens with sources even below 100% coverage`);
  assert.equal(availability.mode, "preliminary", `${room} is preliminary below full coverage`);
  assert.ok(availability.warning.includes("96 % kildedekning"), `${room} explains coverage`);
}

assert.equal(
  getRoomAvailability("contradictions", { ...baseSummary, sourceCount: 1 }).enabled,
  false,
  "Motstrid requires at least two sources"
);
assert.equal(
  getRoomAvailability("contradictions", { ...baseSummary, sourceCount: 1 }).reason,
  "Krever minst 2 sporbare kilder",
  "Motstrid has the required locked reason"
);
assert.equal(
  getRoomAvailability("saksrom", { ...baseSummary, sourceCount: 0 }).label,
  "Krever kilder",
  "zero sources gives precise source requirement"
);
assert.equal(
  getRoomAvailability("saksrom", { ...baseSummary, documentControlComplete: false }).label,
  "Krever dokumentkontroll",
  "manual document control is separate from coverage"
);
assert.equal(
  getRoomAvailability("saksrom", { ...baseSummary, importInProgress: true }).reason,
  "Importen er ikke ferdig.",
  "import status is a separate blocker"
);
assert.equal(
  getRoomAvailability("export", baseSummary).acknowledgementText,
  EXPORT_PRELIMINARY_ACKNOWLEDGEMENT,
  "preliminary export requires explicit acknowledgement text"
);
assert.equal(roomKeyForView("caseRoom"), "saksrom", "caseRoom maps to Saksrom");
assert.equal(roomKeyForView("litigationSimulation"), "simulation", "litigation simulation maps to simulation room");

console.log("room availability tests passed.");
