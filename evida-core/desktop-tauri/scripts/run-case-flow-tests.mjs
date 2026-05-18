import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function normalizeText(value) {
  return value
    .replace(/Ã…/g, "Å")
    .replace(/Ã¥/g, "å")
    .replace(/Ã˜/g, "Ø")
    .replace(/Ã¸/g, "ø")
    .replace(/Ã†/g, "Æ")
    .replace(/Ã¦/g, "æ");
}

async function readText(url) {
  return normalizeText(await readFile(url, "utf8"));
}

const app = await readText(new URL("../src/App.tsx", import.meta.url));
const sidebar = await readText(new URL("../src/components/Sidebar.tsx", import.meta.url));
const windowContext = await readText(new URL("../src/lib/windowCaseContext.ts", import.meta.url));
const commands = await readText(new URL("../src-tauri/src/commands.rs", import.meta.url));

assert.ok(app.includes("function initialWorkspaceView()"), "app reads the requested startup view from URL");
assert.ok(app.includes("return Boolean(params.get(\"caseId\"));"), "only explicit case windows can enter the workspace shell directly");
assert.ok(!app.includes("return hasEvaluationSession() || Boolean(params.get(\"caseId\"));"), "persisted eval sessions cannot skip intro on normal launch");
assert.ok(app.includes("return shouldOpenWorkspaceImmediately() ? \"caseRoom\" : \"intro\";"), "normal launch starts on intro before entering the app");
assert.ok(app.includes("function handleIntroComplete()"), "intro has an explicit continue action");
assert.ok(app.includes("setIsAuthenticated(true);"), "intro unlocks the local evaluation app without login");
assert.ok(!app.includes("\"login\""), "guided flow has no login stage");
assert.ok(app.includes("const [activeView, setActiveView] = useState<ViewKey>(() => initialWorkspaceView())"), "active view is initialized from route");
assert.ok(app.includes("setActiveView(\"documents\")"), "new case flow routes to Dokumenter");
assert.ok(app.includes("Kunne ikke opprette ny sak"), "new case failures are shown in UI");
assert.ok(app.includes("Kunne ikke åpne ny sak i nytt vindu"), "new window failures are shown in UI");
assert.ok(app.includes("caseCreationError ? <div className=\"error-notice\" role=\"alert\">"), "case creation errors are accessible alerts");
assert.ok(sidebar.includes("disabled={isCreatingCase}"), "+ Ny sak is disabled only while creating");
assert.ok(sidebar.includes("Oppretter ..."), "+ Ny sak shows concrete creating state");
assert.ok(sidebar.includes("Dokumentkontroll"), "sidebar includes dedicated document control work area");
assert.ok(sidebar.includes("sidebar-group__title"), "sidebar groups work, analysis and production navigation");
assert.ok(windowContext.includes("params.get(\"caseId\")"), "new windows bind the case id from URL");
assert.ok(commands.includes("case_documents_window_url"), "desktop shell has an explicit case document route builder");
assert.ok(commands.includes("index.html?caseId={}&view=documents"), "new case windows open the Dokumenter route");
assert.ok(commands.includes("new_case_windows_open_directly_on_documents_route"), "Rust route behavior is covered by a unit test");

console.log("case flow tests passed.");
