# PHASE_3_5_COMPLETED

## Phase 3: Source-bound AI / Control Mode

Implemented:
- Control-mode validator for drafts.
- Required source marker format: `[SRC-...]`.
- Unsupported sentence detection.
- Unknown/weak source marker detection.
- Simple contradiction detection for early legal-control workflow.
- Control report enrichment with mode, source count, chronology count, and risk count.
- Tests for passing source-marked drafts, blocking unsupported claims, and contradiction detection.

Key files:
- `ai-engine/saksrom_ai/control.py`
- `ai-engine/saksrom_ai/citations.py`
- `ai-engine/tests/test_control_mode.py`

## Phase 4: Desktop Hardening

Implemented:
- Tauri CSP changed from `null` to a restrictive policy.
- Release readiness script added.
- Desktop hardening notes added.

Key files:
- `desktop-tauri/src-tauri/tauri.conf.json`
- `ops/check_release_readiness.ps1`
- `docs/DESKTOP_HARDENING.md`

Release-readiness result:
- CSP configured: yes.
- Still blocked by missing Rust/Cargo, Tesseract, and sqlite3 CLI in this environment.

## Phase 5: Enterprise Backend

Implemented:
- Spring Boot enterprise readiness endpoint.
- Device activation evaluation endpoint.
- License capacity evaluation endpoint.
- Tests for readiness, device activation, and license capacity.

Key files:
- `services/saksrom-api/src/main/java/no/saksrom/api/enterprise/EnterpriseController.java`
- `services/saksrom-api/src/test/java/no/saksrom/api/enterprise/EnterpriseControllerTest.java`

## Validation

Passing:
- Python AI engine tests.
- Backend API tests.
- Python lint.
- Desktop npm audit.
- Desktop TypeScript/Vite build.
- Spring Boot tests.

## Known gaps

- Full Tauri Rust compilation still cannot be run until Rust/Cargo is installed.
- OCR engine integration is not complete; current flow marks scanned PDFs as requiring OCR.
- Enterprise endpoints are policy/evaluation scaffold endpoints, not yet a full persistent tenant/license/device admin system.

## Next phase

Phase 6 should harden beta/prod readiness:
- Install Rust/Cargo and run full Tauri build.
- Add OCR/Tesseract integration.
- Add encrypted local DB/SQLCipher.
- Expand enterprise backend persistence for devices/licenses/policies.
- Add end-to-end workflow tests with real PDFs.
