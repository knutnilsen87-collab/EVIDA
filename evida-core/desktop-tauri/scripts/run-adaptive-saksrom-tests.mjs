import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import ts from "typescript";

const sourcePath = new URL("../src/features/adaptiveSaksrom/suggestedActions.ts", import.meta.url);
const source = await readFile(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
    strict: true
  }
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString("base64")}`;
const { createDefaultSuggestedActions, resolveSuggestedActionReply } = await import(moduleUrl);

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

console.log(`adaptiveSaksrom tests passed (${examples.length + 6} assertions).`);
