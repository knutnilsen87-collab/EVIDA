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
  "'krysskobling",
  "'bevis",
  "'anforsler",
  "'motargumenter",
  "'presedens",
  "'risiko",
  "'frister",
  "'strategi",
  "'forlik",
  "'utkast",
  "'kvalitet",
  "'endelig",
  "'masker",
  "'bates",
  "'rettssimulering"
];

for (const trigger of requiredTriggers) {
  assert.ok(LEGAL_COMMANDS.some((command) => command.trigger === trigger), `${trigger} is registered`);
  assert.equal(resolveLegalCommand(trigger).command?.trigger, trigger, `${trigger} resolves`);
}

assert.equal(resolveLegalCommand("vanlig chat").isCommand, false, "free chat is not command");
assert.equal(resolveLegalCommand("'ukjent").command, undefined, "unknown command stays unresolved");

const chronology = resolveLegalCommand("'kronologi").command;
const draft = resolveLegalCommand("'utkast").command;
const quality = resolveLegalCommand("'kvalitet").command;
assert.equal(gateLegalCommand(chronology, "not_ready", 0).allowed, false, "analysis command is blocked when not ready");
assert.equal(gateLegalCommand(chronology, "ready_for_preliminary_analysis", 84).allowed, true, "analysis command opens when ready");
assert.equal(gateLegalCommand(draft, "ready_for_preliminary_analysis", 84).allowed, false, "draft command waits for draft readiness");
assert.equal(gateLegalCommand(draft, "ready_for_draft_control", 96).allowed, true, "draft command opens at draft readiness");
assert.equal(gateLegalCommand(quality, "requires_control", 60).allowed, true, "quality command can open control");

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

console.log(`legal command tests passed (${requiredTriggers.length + 12} assertions).`);
