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

const { createDefaultSuggestedActions, resolveSuggestedActionReply } = await importTsModule(
  "../src/features/adaptiveSaksrom/suggestedActions.ts"
);
const {
  CASE_CONVERSATION_MEMORY_KEY,
  createEmptyCaseConversationMemory,
  inferCollaborationModeFromText,
  readCaseConversationMemory,
  updateCaseConversationMemory,
  writeCaseConversationMemory
} = await importTsModule("../src/features/adaptiveSaksrom/conversationMemory.ts");
const { SAKSROM_WORK_STATES } = await importTsModule("../src/features/adaptiveSaksrom/workStates.ts");

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
}

const actions = createDefaultSuggestedActions("turn-1");

assert.equal(actions.length, 4, "default suggested actions include four tracks");
assert.equal(actions[0].index, 1, "first action has index 1");
assert.equal(actions[0].createdFromTurnId, "turn-1", "actions keep source turn id");
assert.equal(actions[1].intent, "find_patterns", "second action uses pattern intent");

const examples = [
  ["1", 1],
  ["nr 1", 1],
  ["ta 1", 1],
  ["gå videre med 1", 1],
  ["den første", 1],
  ["se på punkt 2", 2],
  ["punkt 3", 3],
  ["den fjerde", 4]
];

for (const [input, expectedIndex] of examples) {
  assert.equal(
    resolveSuggestedActionReply(input, actions)?.index,
    expectedIndex,
    `${input} resolves to action ${expectedIndex}`
  );
}

assert.equal(resolveSuggestedActionReply("hva betyr dette?", actions), undefined, "free text remains free chat");
assert.equal(resolveSuggestedActionReply("5", actions), undefined, "unknown action index is ignored");

const storage = createMemoryStorage();
const emptyMemory = createEmptyCaseConversationMemory("case-a");
assert.equal(emptyMemory.caseId, "case-a", "empty memory is tied to case id");
assert.equal(emptyMemory.activeCollaborationMode, "free_question", "empty memory starts in free question mode");

writeCaseConversationMemory(storage, {
  ...emptyMemory,
  previousAssistantAnswer: "Svar A",
  suggestedActions: actions,
  activeCollaborationMode: "find_patterns",
  sourcesUsed: ["source-1"]
});

const readBack = readCaseConversationMemory(storage, "case-a");
assert.equal(readBack.previousAssistantAnswer, "Svar A", "memory keeps previous assistant answer");
assert.equal(readBack.suggestedActions.length, 4, "memory keeps suggested actions");
assert.equal(readBack.sourcesUsed[0], "source-1", "memory keeps sources used");
assert.equal(readCaseConversationMemory(storage, "case-b").suggestedActions.length, 0, "conversation memory is case-local");
assert.ok(storage.getItem(CASE_CONVERSATION_MEMORY_KEY)?.includes("case-a"), "memory uses expected storage key");

const updated = updateCaseConversationMemory(storage, "case-a", {
  selectedAction: actions[1],
  activeCollaborationMode: actions[1].intent,
  retrievalSnapshot: {
    sourceIds: ["source-1", "source-2"],
    sourceCoveragePercent: 82,
    pendingTextRecognitionPages: 0,
    sourceIndexVersion: "sources-2"
  }
});

assert.equal(updated.selectedAction?.id, actions[1].id, "selected action is stored");
assert.equal(updated.activeCollaborationMode, "find_patterns", "selected action updates active mode");
assert.equal(updated.retrievalSnapshot?.sourceCoveragePercent, 82, "retrieval snapshot is stored");

assert.equal(inferCollaborationModeFromText("lag kronologi av dette"), "build_chronology", "chronology intent is inferred");
assert.equal(inferCollaborationModeFromText("finn motstrid i forklaringene"), "find_contradictions", "contradiction intent is inferred");
assert.equal(inferCollaborationModeFromText("hvilke transaksjoner går igjen"), "find_patterns", "pattern intent is inferred");
assert.equal(inferCollaborationModeFromText("vanlig oppfølgingsspørsmål"), "free_question", "free text keeps free mode");

assert.deepEqual(
  SAKSROM_WORK_STATES,
  [
    "Forstår spørsmålet",
    "Henter relevante kilder",
    "Ser etter mønstre",
    "Sammenligner datoer og aktører",
    "Kontrollerer usikkerhet",
    "Skriver svar"
  ],
  "work states keep required order"
);

console.log(`adaptiveSaksrom tests passed (${examples.length + 23} assertions).`);
