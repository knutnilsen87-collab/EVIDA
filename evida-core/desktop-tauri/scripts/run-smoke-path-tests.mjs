import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const caseRoom = await readFile(new URL("../src/components/CaseRoomView.tsx", import.meta.url), "utf8");
const api = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const sidebar = await readFile(new URL("../src/components/Sidebar.tsx", import.meta.url), "utf8");
const workroomTheme = await readFile(new URL("../src/lib/workroomTheme.ts", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const statusCard = await readFile(new URL("../src/components/StatusCard.tsx", import.meta.url), "utf8");
const evidenceChip = await readFile(new URL("../src/components/EvidenceChip.tsx", import.meta.url), "utf8");
const commands = await readFile(new URL("../src-tauri/src/commands.rs", import.meta.url), "utf8");
const lib = await readFile(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");
const tauriConfig = await readFile(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8");
const smokeDoc = await readFile(new URL("../../../docs/ACCEPTANCE_SMOKE_TEST.md", import.meta.url), "utf8");

assert.ok(app.includes("setActiveView(\"caseRoom\")"), "import and onboarding flows can route to Saksrom");
assert.ok(app.includes("SourcePreviewDrawer"), "source drawer is mounted from the app shell");
assert.ok(app.includes("setActiveSource"), "app shell can open a selected source");

for (const view of ["chronology", "evidence", "contradictions", "risk"]) {
  assert.ok(app.includes(`setActiveView("${view}")`), `${view} workroom can be opened`);
}

assert.ok(caseRoom.includes("onOpenSource"), "Saksrom receives a source-open callback");
assert.ok(caseRoom.includes("case-suggested-actions"), "Saksrom renders suggested actions");
assert.ok(caseRoom.includes("importQueue"), "Saksrom shows import/processing state");
assert.ok(app.includes("chooseDocumentFolderPaths"), "app can choose a case document folder");
assert.ok(app.includes("expandImportPaths"), "app expands raw import paths before queueing");
assert.ok(app.includes("tauri://drag-drop"), "app listens for native Tauri drag/drop paths");
assert.ok(app.includes("Velg mappe"), "import panel exposes folder import");
assert.ok(caseRoom.includes("Velg saksmappe"), "Saksrom empty state exposes folder import");
assert.ok(caseRoom.includes("Last opp dokumenter først"), "Saksrom gives an empty document-first state");
assert.ok(caseRoom.includes("Viktigste vurdering"), "Saksrom answers lead with colleague-style assessment headings");
assert.ok(caseRoom.includes("Neste anbefalte handling"), "Saksrom answers use recommended-action wording");
assert.ok(caseRoom.includes("Kilder, usikkerhet og neste steg"), "Saksrom keeps sources in secondary details");
assert.ok(api.includes("choose_document_folder_paths"), "frontend API calls folder import command");
assert.ok(api.includes("expand_import_paths"), "frontend API calls import path expansion command");
assert.ok(api.includes("record_document_control_action"), "frontend API calls document control audit command");
assert.ok(app.includes("ImportHealthCenter"), "app renders Import Health Center");
assert.ok(app.includes("deriveDocumentBasisSummary"), "app derives canonical document basis groups");
assert.ok(app.includes("Dokumenter som trenger kontroll"), "control view names the manual review bucket");
assert.ok(app.includes("Dokumenter som ikke ble brukt"), "control view names the unused-documents bucket");
assert.ok(app.includes("Bruk som kildegrunnlag"), "control view can approve a previewed document for source foundation use");
assert.ok(app.includes("recordDocumentControlAction"), "frontend records document approval/rejection audit events");
assert.ok(!app.includes("guided-stepper"), "guided login no longer shows the onboarding stepper");
assert.ok(app.includes("Se hva som mangler"), "app exposes a missing-documents view");
assert.ok(app.includes("documentFilter"), "document list has status filters");
assert.ok(app.includes("documentSearch"), "document list has search");
assert.ok(app.includes("Saksgrunnlaget er ikke komplett ennå."), "app protects against false 100 percent complete");
assert.ok(api.includes("register_document_in_session"), "frontend API uses import-session document registration");
assert.ok(commands.includes("register_document_in_session"), "Rust command records per-file import health");
assert.ok(commands.includes("remove_import_item_from_case"), "Rust command can remove import items from a case");
assert.ok(lib.includes("get_import_health"), "Import Health command is registered with Tauri");
assert.ok(lib.includes("record_document_control_action"), "document control audit command is registered with Tauri");
for (const workroom of ["caseRoom", "documents", "documentControl", "chronology", "evidence", "arguments", "contradictions", "risk", "control", "export"]) {
  assert.ok(workroomTheme.includes(`${workroom}:`), `WORKROOM_THEME contains ${workroom}`);
}
assert.ok(sidebar.includes("aria-current"), "sidebar marks the active workroom for assistive tech");
assert.ok(sidebar.includes("sidebar-item__marker"), "sidebar uses a non-text color marker");
assert.ok(styles.includes(".sidebar-actions .button-primary"), "sidebar primary action keeps visible button styling");
assert.ok(styles.includes(".app-shell[data-theme=\"dark\"] .sidebar-actions .button-primary"), "dark sidebar primary action keeps visible contrast");
assert.ok(styles.includes("overflow-anchor: none"), "workspace disables browser scroll anchoring during live import updates");
assert.ok(styles.includes("min-height: 214px"), "import status grid reserves stable height during processing");
assert.ok(caseRoom.includes("hasActiveProcessing || userScrolledRecently"), "Saksrom auto-reveal is blocked while processing is active");
assert.ok(app.includes("data-visual-mode={visualMode}"), "app applies persisted visual mode to root shell");
assert.ok(app.includes("VISUAL_MODE_STORAGE_KEY"), "visual mode persists in localStorage");
assert.ok(app.includes("CaseVitalityBar"), "case vitality bar is mounted");
assert.ok(app.includes("WorkroomHeader"), "workroom headers are mounted");
assert.ok(statusCard.includes("progressbar"), "status cards expose progress values accessibly");
assert.ok(evidenceChip.includes("aria-label"), "evidence chips have accessible labels");
assert.ok(commands.includes("collect_import_file_paths"), "Rust command recursively collects every folder file for zero-file-loss import");
assert.ok(commands.includes("expand_import_paths"), "Rust command expands dropped folders and files");
assert.ok(!commands.includes("is_supported_document_path"), "Rust command no longer filters out unsupported files before import health records them");
assert.ok(lib.includes("choose_document_folder_paths"), "folder import command is registered with Tauri");
assert.ok(lib.includes("expand_import_paths"), "path expansion command is registered with Tauri");
assert.ok(lib.includes("STARTUP_WIDTH_PERCENT: u32 = 92"), "startup window uses a large work-area width");
assert.ok(lib.includes("STARTUP_HEIGHT_PERCENT: u32 = 90"), "startup window uses a large work-area height");
assert.ok(lib.includes("WINDOW_MARGIN_X: u32 = 96"), "startup window keeps horizontal margin instead of fullscreen");
assert.ok(lib.includes("WINDOW_MARGIN_Y: u32 = 36"), "startup window keeps a small vertical margin");
assert.ok(tauriConfig.includes("\"maximized\": false"), "Tauri config does not start maximized");
assert.ok(tauriConfig.includes("\"minWidth\": 1100"), "window can be resized smaller than the large startup size");

assert.ok(smokeDoc.includes("import -> Saksrom -> source -> workroom"), "manual smoke doc names the canonical path");
assert.ok(smokeDoc.includes("Source opens in drawer/modal"), "manual smoke doc requires source opening");
assert.ok(smokeDoc.includes("Workroom opens with the same active case"), "manual smoke doc requires workroom continuity");

console.log("smoke path tests passed.");
