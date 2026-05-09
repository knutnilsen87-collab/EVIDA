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

const { LEGAL_COMMANDS, gateLegalCommand, resolveLegalCommand } = await importTsModule(
  "../src/features/legalCommands/legalCommands.ts"
);
const {
  DEFAULT_WORKSTYLE_PREFERENCES,
  WORKSTYLE_STORAGE_KEY,
  readWorkstylePreferences,
  writeWorkstylePreferences
} = await importTsModule("../src/features/adaptiveSaksrom/workstyle.ts");

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

const requiredTriggers = [
  "'kronologi",
  "'bevis",
  "'risiko",
  "'kvalitet"
];

for (const trigger of requiredTriggers) {
  assert.ok(LEGAL_COMMANDS.some((command) => command.trigger === trigger), `${trigger} is registered`);
  assert.equal(resolveLegalCommand(trigger).command?.trigger, trigger, `${trigger} resolves`);
}

assert.equal(resolveLegalCommand("vanlig chat").isCommand, false, "free chat is not command");
assert.equal(resolveLegalCommand("'ukjent").command, undefined, "unknown command stays unresolved");

const chronology = resolveLegalCommand("'kronologi").command;
const evidence = resolveLegalCommand("'bevis").command;
const risk = resolveLegalCommand("'risiko").command;
const quality = resolveLegalCommand("'kvalitet").command;
assert.equal(resolveLegalCommand("'utkast").command, undefined, "draft command is not part of V1");
assert.equal(resolveLegalCommand("'rettssimulering").command, undefined, "simulation command is not part of V1");
assert.equal(gateLegalCommand(chronology, "not_ready", 49).allowed, false, "chronology is blocked below 50 coverage");
assert.equal(gateLegalCommand(chronology, "requires_control", 50).allowed, true, "chronology opens at 50 coverage");
assert.equal(gateLegalCommand(evidence, "requires_control", 50).allowed, true, "evidence opens at 50 coverage");
assert.equal(gateLegalCommand(risk, "requires_control", 79).allowed, false, "risk waits for 80 coverage");
assert.equal(gateLegalCommand(risk, "ready_for_preliminary_analysis", 80).allowed, true, "risk opens at 80 coverage");
assert.equal(gateLegalCommand(quality, "ready_for_preliminary_analysis", 94).allowed, false, "quality waits for 95 coverage");
assert.equal(gateLegalCommand(quality, "ready_for_draft_control", 95).allowed, true, "quality opens at 95 coverage");

const storage = createMemoryStorage();
assert.equal(readWorkstylePreferences(storage).answerLength, DEFAULT_WORKSTYLE_PREFERENCES.answerLength, "default workstyle loads");
writeWorkstylePreferences(storage, {
  ...DEFAULT_WORKSTYLE_PREFERENCES,
  answerLength: "detailed",
  showNextSuggestions: false
});
assert.ok(storage.getItem(WORKSTYLE_STORAGE_KEY)?.includes("detailed"), "workstyle writes expected key");
const readBack = readWorkstylePreferences(storage);
assert.equal(readBack.answerLength, "detailed", "workstyle answer length persists");
assert.equal(readBack.showNextSuggestions, false, "workstyle suggestions preference persists");

console.log(`legal command tests passed (${requiredTriggers.length + 18} assertions).`);
