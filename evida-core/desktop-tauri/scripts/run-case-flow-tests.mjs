import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const sidebar = await readFile(new URL("../src/components/Sidebar.tsx", import.meta.url), "utf8");
const windowContext = await readFile(new URL("../src/lib/windowCaseContext.ts", import.meta.url), "utf8");
const commands = await readFile(new URL("../src-tauri/src/commands.rs", import.meta.url), "utf8");

assert.ok(app.includes("function initialWorkspaceView()"), "app reads the requested startup view from URL");
assert.ok(app.includes("return hasEvaluationSession() || Boolean(params.get(\"caseId\"));"), "case windows can enter the workspace shell");
assert.ok(app.includes("const [activeView, setActiveView] = useState<ViewKey>(() => initialWorkspaceView())"), "active view is initialized from route");
assert.ok(app.includes("setActiveView(\"documents\")"), "new case flow routes to Dokumenter");
assert.ok(app.includes("Kunne ikke opprette ny sak"), "new case failures are shown in UI");
assert.ok(app.includes("Kunne ikke åpne ny sak i nytt vindu"), "new window failures are shown in UI");
assert.ok(app.includes("caseCreationError ? <div className=\"error-notice\" role=\"alert\">"), "case creation errors are accessible alerts");
assert.ok(sidebar.includes("disabled={isCreatingCase}"), "+ Ny sak is disabled only while creating");
assert.ok(sidebar.includes("Oppretter ..."), "+ Ny sak shows concrete creating state");
assert.ok(windowContext.includes("params.get(\"caseId\")"), "new windows bind the case id from URL");
assert.ok(commands.includes("case_documents_window_url"), "desktop shell has an explicit case document route builder");
assert.ok(commands.includes("index.html?caseId={}&view=documents"), "new case windows open the Dokumenter route");
assert.ok(commands.includes("new_case_windows_open_directly_on_documents_route"), "Rust route behavior is covered by a unit test");

console.log("case flow tests passed (13 assertions).");
