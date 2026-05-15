import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

const [
  securityStatus,
  aiQa,
  workroomQa,
  releaseHardening,
  sbomPlan,
  signingDecision,
  prodChecklist,
  releaseChecklist,
  settingsView,
  appSource,
  caseRoomSource
] = await Promise.all([
  read("../../../docs/SECURITY_FOUNDATION_STATUS.md"),
  read("../../../docs/AI_SOURCE_TRUST_QA.md"),
  read("../../../docs/LEGAL_WORKROOM_QA.md"),
  read("../../../docs/RELEASE_HARDENING_STATUS.md"),
  read("../../../docs/DEPENDENCY_AND_SBOM_PLAN.md"),
  read("../../../docs/RELEASE_SIGNING_DECISION.md"),
  read("../../../docs/PROD_READINESS_CHECKLIST.md"),
  read("../../../docs/RELEASE_CHECKLIST.md"),
  read("../src/components/settings/SettingsView.tsx"),
  read("../src/App.tsx"),
  read("../src/components/CaseRoomView.tsx")
]);

assert.ok(securityStatus.includes("AES-256-GCM"), "security status documents field encryption");
assert.ok(securityStatus.includes("Full-file SQLCipher/database encryption is not complete"), "security status keeps SQLCipher gap visible");
assert.ok(securityStatus.includes("External AI is off by default"), "security status documents external AI default");

assert.ok(aiQa.includes("Prompt-injection"), "AI QA includes prompt injection");
assert.ok(aiQa.includes("Safe fallback must not expose raw provider output"), "AI QA requires safe fallback");
assert.ok(aiQa.includes("Invalid source IDs must fail validation"), "AI QA requires source ID validation");

for (const workroom of ["Chronology", "Evidence", "Arguments", "Contradictions", "Risk", "Litigation simulation"]) {
  assert.ok(workroomQa.includes(workroom), `${workroom} is in legal QA scope`);
}
assert.ok(workroomQa.includes("source IDs"), "workroom QA requires source IDs");

assert.ok(releaseHardening.includes("Test-EvidaReleaseHardening.ps1"), "release hardening gate is documented");
assert.ok(sbomPlan.includes("signed SBOM"), "SBOM plan includes production signed SBOM target");
assert.ok(signingDecision.includes("unsigned pre-alpha evaluation builds"), "signing decision states current unsigned status");
assert.ok(prodChecklist.includes("Dependency/SBOM gate"), "prod checklist includes dependency/SBOM gate");
assert.ok(releaseChecklist.includes("Test-EvidaReleaseHardening.ps1"), "release checklist runs release hardening");

assert.ok(settingsView.includes("external_ai_enabled: false"), "settings default external AI is off");
assert.ok(settingsView.includes("allow_full_document_sending: false"), "settings default full document sending is off");
assert.ok(settingsView.includes("require_external_ai_confirmation: true"), "settings default external AI confirmation is on");
assert.ok(settingsView.includes("no_document_text_logs: true"), "settings default document text logging is off");
assert.ok(settingsView.includes("no_chat_logs: true"), "settings default chat logging is off");
assert.ok(appSource.includes("DEMO_MODE"), "demo login is explicitly gated");
assert.equal(appSource.includes("eval-2026"), false, "demo password is not present as a production-visible literal");
assert.ok(caseRoomSource.includes("shouldUseExternalAiProvider"), "Saksrom has an explicit external provider policy gate");
assert.ok(caseRoomSource.includes("policy-blokkert"), "provider policy block is visible to user");

console.log("phase hardening tests passed.");
