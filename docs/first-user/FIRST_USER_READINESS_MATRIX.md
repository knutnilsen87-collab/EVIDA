# First User Readiness Matrix

Allowed statuses: `PASS`, `PARTIAL`, `BLOCKED`, `DEFERRED`, `N/A`.

P0 must be `PASS` before first-user release.

| ID | Area | Requirement | Priority | Automated evidence | Manual evidence | Owner | Status |
|---|---|---|---|---|---|---|---|
| FU-001 | Release | First-user scope locked | P0 | docs review | approval checklist | Product | PASS |
| FU-002 | Release | Status bundle final exists | P0 | bundle validation | release owner review | Platform | PASS |
| FU-003 | Release | Rollback path documented | P0 | release notes | approval checklist | Platform | PASS |
| FU-004 | Install | App builds in release mode | P0 | CI build | clean install smoke | Desktop | PASS |
| FU-005 | Install | App starts with clean profile | P0 | smoke/e2e | manual launch | Desktop | BLOCKED |
| FU-006 | Workspace | Create workspace | P0 | integration/e2e | smoke | Desktop | BLOCKED |
| FU-007 | Workspace | Create case | P0 | integration/e2e | smoke | Product/Desktop | PASS |
| FU-008 | Workspace | Restart preserves case | P0 | persistence test | close/reopen smoke | Desktop | BLOCKED |
| FU-009 | Upload | Accept valid PDF | P0 | upload test | fixture smoke | Document | BLOCKED |
| FU-010 | Upload | Accept valid DOCX | P0 | upload test | fixture smoke | Document | BLOCKED |
| FU-011 | Upload | Accept valid TXT | P0 | upload test | fixture smoke | Document | PASS |
| FU-012 | Upload | Reject unsupported type | P0 | negative test | fixture smoke | Document | BLOCKED |
| FU-013 | Upload | Reject MIME mismatch | P0 | negative test | fixture smoke | Document/Security | BLOCKED |
| FU-014 | Upload | Handle corrupt PDF safely | P0 | negative test | fixture smoke | Document | BLOCKED |
| FU-015 | Upload | Handle password PDF safely | P0 | negative test | fixture smoke | Document | BLOCKED |
| FU-016 | Upload | Handle image-only scan explicitly | P0 | fixture test | UI status smoke | Document/OCR | BLOCKED |
| FU-017 | Upload | Size limit enforced | P0 | negative test | N/A | Document | BLOCKED |
| FU-018 | Upload | Hash every accepted document | P0 | integration test | artifact inspect | Document | PASS |
| FU-019 | Upload | Duplicate detection | P1 | integration test | smoke | Document | PASS |
| FU-020 | Upload | Source objects created | P0 | integration test | UI/source inspect | Document/AI | PASS |
| FU-021 | Upload | Failed docs excluded from AI | P0 | negative AI test | smoke | Document/AI | PARTIAL |
| FU-022 | Upload | Upload status visible in UI | P0 | e2e/UI test | smoke | Product/UI | PASS |
| FU-023 | Upload | Upload audit events created | P0 | audit test | audit inspect | Platform | PASS |
| FU-024 | Upload | Sensitive document text not logged | P0 | log scan | N/A | Security | PARTIAL |
| FU-025 | AI | Source-bound answer from one doc | P0 | AI eval | smoke | AI | PASS |
| FU-026 | AI | Source-bound answer from multiple docs | P0 | AI eval | smoke | AI | BLOCKED |
| FU-027 | AI | Unsupported claim blocked | P0 | AI eval | adversarial smoke | AI | PASS |
| FU-028 | AI | Prompt injection ignored | P0 | adversarial eval | smoke | AI/Security | PARTIAL |
| FU-029 | AI | Retrieval snapshot saved | P0 | artifact test | inspect | AI/Platform | PASS |
| FU-030 | AI | External raw upload disabled by default | P0 | config test | settings inspect | AI/Security | PASS |
| FU-031 | Audit | Audit hash/tamper verification | P0 | tamper test | inspect | Platform | PASS |
| FU-032 | Audit | AI action audit event | P0 | audit test | inspect | Platform/AI | PASS |
| FU-033 | Audit | Export audit event | P1 | audit test | inspect | Platform | BLOCKED |
| FU-034 | Export | Export source-based report | P1 | e2e/export test | smoke | Product | BLOCKED |
| FU-035 | Export | Export includes timestamp/source basis | P1 | export assertion | inspect | Product | BLOCKED |
| FU-036 | Data | Local data persists after restart | P0 | persistence test | smoke | Desktop | PARTIAL |
| FU-037 | Data | Backup/restore tested | P1/P0 real data | restore test | manual restore | Platform | PASS |
| FU-038 | Security | No secrets in repo | P0 | gitleaks | N/A | Security | BLOCKED |
| FU-039 | Security | Dependency scan has no release-blocking issues | P0 | dependency scan | review | Security | BLOCKED |
| FU-040 | Security | Prod-unsafe config blocked or pilot-labeled | P0 | config/startup test | inspect | Platform | PASS |
| FU-041 | UX | User-visible errors are safe and useful | P1 | UI/e2e | smoke | Product/UI | BLOCKED |
| FU-042 | UX | Loading/progress states for upload | P1 | `npm test` import UX assertions + `npm run build` | manual smoke still needed | Product/UI | PARTIAL |
| FU-043 | UX | Keyboard/basic accessibility smoke | P1 | manual | manual | UI | BLOCKED |
| FU-044 | CI | First-user gauntlet script exists | P0 | script run | N/A | Platform | PASS |
| FU-045 | CI | Golden path docs exist | P0 | file check | review | Platform | PASS |
| FU-046 | CI | First-user tests run in CI or documented local gate | P0 | CI/local evidence | approval | Platform | PASS |
| FU-047 | Review | Engineering approval | P0 | checklist | signature | Eng | BLOCKED |
| FU-048 | Review | Product approval | P0 | checklist | signature | Product | BLOCKED |
| FU-049 | Review | Security/privacy approval if any real data | P0 conditional | checklist | signature | Security | BLOCKED |
| FU-050 | Review | Known limitations shown to first user | P0 | release notes | review | Product | PASS |

## Current Evidence Snapshot

Updated 2026-05-14 from local automated gates. The matrix is intentionally not all green: any remaining `BLOCKED` or `PARTIAL` P0 row means first-user release is still NO-GO.

Evidence artifacts:

- `artifacts/first-user/evidence.first_user.current.json`
- `artifacts/first-user/invariant_evaluation.first_user.json`
- `artifacts/first-user/status_bundle.first_user.final.json`
- `artifacts/production-dod/evida-production-dod-report.json`
